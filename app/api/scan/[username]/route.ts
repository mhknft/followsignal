import { NextResponse } from "next/server";
import type { PredictedAccount } from "../../../types";

const BASE = "https://api.sorsa.io/v3";

// ─── Normalised internal type ─────────────────────────────────────────────────

type NormalisedAccount = {
  username: string; // always lowercase, no @
  name: string;
  followers: number;
  score: number;
  avatar: string;
};

// ─── Defensive field extraction ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(obj: Record<string, any>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseAccount(raw: Record<string, any>): NormalisedAccount {
  const rawUsername = String(
    pick(raw, "username", "handle", "screen_name", "userName", "user_name") ?? "",
  ).replace(/^@/, "").trim().toLowerCase();

  const name = String(
    pick(raw, "name", "displayName", "display_name", "fullName", "full_name") ??
    rawUsername ?? "Unknown",
  ).trim() || rawUsername || "Unknown";

  const followers = Number(
    pick(raw, "followersCount", "followers_count", "followers", "follower_count",
         "followerscount", "numFollowers") ?? 0,
  );

  const score = Number(
    pick(raw, "score", "sorsaScore", "sorsa_score", "rank", "orbitScore",
         "orbit_score", "influence", "influenceScore") ?? 0,
  );

  const avatar = String(
    pick(raw, "profileImageUrl", "profile_image_url", "profileImage", "profile_image",
         "avatar", "avatarUrl", "avatar_url", "photo", "picture", "image") ?? "",
  ).trim().replace(/^http:\/\//i, "https://");

  return {
    username: rawUsername,
    name,
    followers: isNaN(followers) ? 0 : followers,
    score:     isNaN(score)     ? 0 : score,
    avatar,
  };
}

/** Extract normalised account list from any Sorsa envelope shape. */
function extractList(raw: unknown): NormalisedAccount[] {
  if (!raw || typeof raw !== "object") return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = raw as Record<string, any>;

  let arr: unknown[] | null = null;
  if (Array.isArray(raw)) {
    arr = raw;
  } else {
    console.log("[scan] response top-level keys:", Object.keys(obj));
    for (const key of ["data", "users", "accounts", "results", "items",
                        "list", "followers", "following", "follows"]) {
      if (Array.isArray(obj[key])) {
        console.log(`[scan] found array under key "${key}" (${(obj[key] as unknown[]).length} items)`);
        arr = obj[key];
        break;
      }
    }
  }

  if (!arr) { console.log("[scan] extractList: no array found"); return []; }

  const result = arr
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((item): item is Record<string, any> => !!item && typeof item === "object")
    .map(normaliseAccount);

  if (arr.length > 0) {
    const firstRaw = arr[0] as object;
    console.log("[scan] first item raw keys:", Object.keys(firstRaw));
    console.log("[scan] first item normalised:", JSON.stringify(result[0]));
  }
  return result;
}

/** Extract Sorsa score from a /score response. */
function extractScore(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = raw as Record<string, any>;

  const direct = pick(obj, "score", "sorsaScore", "sorsa_score", "orbitScore");
  if (direct !== undefined) { const n = Number(direct); return isNaN(n) ? 0 : n; }

  for (const key of ["data", "user", "result", "profile"]) {
    if (obj[key] && typeof obj[key] === "object") {
      const nested = pick(obj[key], "score", "sorsaScore", "sorsa_score", "orbitScore");
      if (nested !== undefined) { const n = Number(nested); return isNaN(n) ? 0 : n; }
    }
  }
  return 0;
}

function isValid(acc: NormalisedAccount): boolean {
  return acc.username.length > 0 && !isNaN(acc.score) && isFinite(acc.score);
}

// ─── Relevance filter ─────────────────────────────────────────────────────────
//
// Removes obvious brand / org / protocol / celebrity accounts so only
// individual creators, traders, and CT personalities appear as recommendations.

/** Hard-blocked usernames — always excluded regardless of score. */
const BLOCKED_USERNAMES = new Set([
  "claude",
  "anthropic",
  "ethereum",
  "ethereumfoundation",
  "ethereumfndn",
  "openai",
  "google",
  "tesla",
  "openclaw",
  "xdevelopers",
  "binance",
  "coinbase",
]);

/**
 * Display-name tokens that strongly indicate an organisation, brand, protocol,
 * exchange, or non-personal account.
 */
const ORG_NAME_TOKENS = new Set([
  "foundation", "protocol", "official", "exchange",
  "labs", "lab", "capital", "ventures", "venture",
  "fund", "inc", "llc", "ltd", "corp", "dao",
  "association", "organization", "org", "society",
  "federation", "alliance", "coalition", "collective",
  "institute", "media", "news", "team", "group",
  "magazine", "journal", "network",
]);

/** Username suffix patterns that indicate org / project accounts. */
const ORG_USERNAME_RE = [
  /foundation$/i,
  /official$/i,
  /hq$/i,
  /dao$/i,
  /protocol$/i,
  /exchange$/i,
  /labs?$/i,
  /capital$/i,
  /ventures?$/i,
];

/**
 * Returns true when a candidate looks like an organisation, brand, exchange,
 * or protocol rather than an individual person.
 */
function looksLikeOrg(name: string, username: string): boolean {
  // Split display name on whitespace and common punctuation
  const tokens = name.toLowerCase().split(/[\s\-_.,&|/\\()\[\]+]+/);
  for (const token of tokens) {
    if (token && ORG_NAME_TOKENS.has(token)) return true;
  }
  for (const re of ORG_USERNAME_RE) {
    if (re.test(username)) return true;
  }
  return false;
}

// ─── Score slots ─────────────────────────────────────────────────────────────
//
// Five explicitly defined score-gap slots, each targeting ONE candidate.
// The best candidate (smallest gap from the searched user) within each slot's
// window is selected, producing a natural upward progression such as:
//   800 → 950 → 1 100 → 1 400 → 1 800 → 2 200
//
// If a slot's ideal window is empty, findForSlot() tries six progressively wider
// passes before giving up.  After all slots have been attempted (Pass A), any
// remaining positions are filled greedily from leftover eligible candidates
// sorted by score ascending (Pass B) — so we always try as hard as possible
// to reach 5 cards.

type Tier          = 1 | 2 | 3;
type ScoredAccount = NormalisedAccount & { tier: Tier };

interface SlotDef {
  minGap: number; // lower bound relative to searched score (inclusive)
  maxGap: number; // upper bound relative to searched score (exclusive)
  tier:   Tier;
}

const SLOT_DEFS: SlotDef[] = [
  { minGap:  100, maxGap:  250, tier: 1 }, // Slot 1: ~+175  above searched
  { minGap:  250, maxGap:  450, tier: 1 }, // Slot 2: ~+350
  { minGap:  450, maxGap:  700, tier: 2 }, // Slot 3: ~+575
  { minGap:  700, maxGap: 1100, tier: 2 }, // Slot 4: ~+900
  { minGap: 1100, maxGap: 1600, tier: 3 }, // Slot 5: ~+1 350
];

// Progressive widening applied when a slot's ideal window has no candidates.
// Each pass multiplies [minGap, maxGap] by the lo/hi factors respectively.
const WIDEN: Array<{ lo: number; hi: number }> = [
  { lo: 1.00, hi: 1.00 }, // Pass 0: exact window
  { lo: 0.75, hi: 1.40 }, // Pass 1: slightly wider
  { lo: 0.50, hi: 1.80 }, // Pass 2: noticeably wider
  { lo: 0.25, hi: 2.40 }, // Pass 3: quite wide
  { lo: 0.00, hi: 3.20 }, // Pass 4: very wide (floor = searched score)
  { lo: 0.00, hi: 8.00 }, // Pass 5: catch-all safety net
];

/**
 * Find the single best candidate for one slot.
 * "Best" = lowest score in window (smallest gap → most natural progression).
 * Returns null if every widening pass also comes up empty.
 */
function findForSlot(
  eligible: NormalisedAccount[],
  used:     Set<string>,
  base:     number,
  def:      SlotDef,
): NormalisedAccount | null {
  for (const { lo, hi } of WIDEN) {
    const minScore = base + def.minGap * lo;
    const maxScore = base + def.maxGap * hi;

    const hit = eligible
      .filter((c) => !used.has(c.username) && c.score >= minScore && c.score < maxScore)
      .sort((a, b) => a.score - b.score)[0]; // ascending → pick smallest gap

    if (hit) return hit;
  }
  return null;
}

// ─── Category label (tier + follower count) ──────────────────────────────────

function categoryFromTier(tier: Tier, followers: number): string {
  if (tier === 1) return followers >= 500_000 ? "Rare Pick"      : "Strong Match";
  if (tier === 2) return followers >= 100_000 ? "Near Orbit"     : "High Potential";
  return                 followers >= 50_000  ? "Watchlist"      : "Possible Next";
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function formatScore(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function formatFollowers(value: unknown): string {
  const n = Number(value || 0);
  if (isNaN(n) || !isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

function buildReason(score: number, followers: number, name: string, tier: 1 | 2 | 3): string {
  const s = formatScore(score);
  const f = formatFollowers(followers);

  if (tier === 1) {
    const lines = [
      `Sorsa score ${s}. ${f} followers. You follow them — they haven't followed back yet.`,
      `Score ${s} · ${f} followers. High-value account in your follow graph with no reciprocation.`,
      `${f} followers · score ${s}. You're in their extended orbit — follow-back signal detected.`,
      `High network affinity. Score ${s} places ${name} in the top tier of your non-followback list.`,
    ];
    return lines[Math.abs(Math.round(score)) % lines.length];
  }

  if (tier === 2) {
    const lines = [
      `Score ${s} · ${f} followers. Solid candidate within your extended orbit.`,
      `${f} followers · score ${s}. Near-orbit account with strong follow-back potential.`,
      `Score ${s}. ${name} is in reach — follow-back probability is elevated.`,
    ];
    return lines[Math.abs(Math.round(score)) % lines.length];
  }

  // Tier 3
  const lines = [
    `Score ${s} · ${f} followers. Potential follow-back in your network graph.`,
    `${f} followers · score ${s}. Watchlist candidate — mutual follow signal present.`,
  ];
  return lines[Math.abs(Math.round(score)) % lines.length];
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function sorsaFetch(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ApiKey: process.env.SORSA_API_KEY! },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Fetch individual score for a single username. Returns 0 on any failure. */
async function fetchScore(username: string): Promise<number> {
  try {
    const raw = await sorsaFetch(`/score?username=${encodeURIComponent(username)}`);
    return extractScore(raw);
  } catch {
    return 0;
  }
}

// ─── Positions ────────────────────────────────────────────────────────────────

const POSITIONS: PredictedAccount["position"][] = [
  "top-left", "top-right", "lower-left", "lower-right", "bottom-center",
];

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const enc = encodeURIComponent(username);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`[scan] ▶ Starting scan for: @${username}`);
  console.log(`${"═".repeat(60)}`);

  try {
    // ── 1. Parallel: following list + followers list + profile score ───────────
    const [followsRaw, followersRaw, profileScoreRaw] = await Promise.allSettled([
      sorsaFetch(`/follows?username=${enc}`),
      sorsaFetch(`/followers?username=${enc}`),
      sorsaFetch(`/score?username=${enc}`),
    ]);

    if (followsRaw.status   === "rejected") console.log("[scan] ✗ /follows failed:", followsRaw.reason);
    if (followersRaw.status === "rejected") console.log("[scan] ✗ /followers failed:", followersRaw.reason);
    if (profileScoreRaw.status === "rejected") console.log("[scan] ✗ /score failed:", profileScoreRaw.reason);

    console.log("\n[scan] ── Extracting lists ──");
    const following    = followsRaw.status    === "fulfilled" ? extractList(followsRaw.value)    : [];
    const followers    = followersRaw.status  === "fulfilled" ? extractList(followersRaw.value)  : [];
    const profileScore = profileScoreRaw.status === "fulfilled" ? extractScore(profileScoreRaw.value) : 0;

    // ── 2. Debug summary ──────────────────────────────────────────────────────
    console.log(`\n[scan] DEBUG SUMMARY:`);
    console.log(`  Searched profile score : ${profileScore}`);
    console.log(`  Total following        : ${following.length}`);
    console.log(`  Total followers        : ${followers.length}`);

    // ── 3. Build follower-back exclusion set (lowercase, no @) ────────────────
    const followsBackSet = new Set(followers.map((u) => u.username.toLowerCase().replace(/^@/, "")));

    // ── 4. Find non-followbacks ───────────────────────────────────────────────
    const nonFollowbacks = following
      .filter((acc) => acc.username.length > 0)
      .filter((acc) => !followsBackSet.has(acc.username.toLowerCase().replace(/^@/, "")));

    console.log(`  Total non-followbacks  : ${nonFollowbacks.length}`);
    console.log(`  (following ${following.length} - ${following.length - nonFollowbacks.length} mutual = ${nonFollowbacks.length} candidates)`);

    // ── 5. Sort by followers_count, take top 1 000 ───────────────────────────
    // Apply username blacklist + org-detection heuristic BEFORE scoring so we
    // don't waste API calls on brands, foundations, exchanges, or protocols.
    const top1000 = [...nonFollowbacks]
      .filter((acc) => !BLOCKED_USERNAMES.has(acc.username.toLowerCase()))
      .filter((acc) => !looksLikeOrg(acc.name, acc.username))
      .sort((a, b) => b.followers - a.followers)
      .slice(0, 1000);

    console.log(`\n[scan] Fetching Sorsa scores for ${top1000.length} candidates...`);

    // ── 6. Parallel score lookup for top 1 000 ───────────────────────────────
    const scores = await Promise.all(top1000.map((acc) => fetchScore(acc.username)));

    const withScores: NormalisedAccount[] = top1000.map((acc, i) => ({
      ...acc,
      score: scores[i],
    }));

    const nonZeroCount = withScores.filter((c) => c.score > 0).length;
    console.log(`  Candidates scored      : ${nonZeroCount} (non-zero out of ${top1000.length})`);

    // ── 7. Base eligibility + deduplication ───────────────────────────────────
    //
    // Hard requirements before any slot logic:
    //   • valid username, finite non-zero score
    //   • score >= 800 (absolute floor)
    //   • score strictly > profileScore (never recommend weaker-than-searched)
    //   • unique username

    const seen = new Set<string>();
    const eligible = withScores
      .filter(isValid)
      .filter((c) => c.score > 0)
      .filter((c) => c.score >= 800)
      .filter((c) => c.score > profileScore)
      .filter((c) => {
        const key = c.username.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    // ── 8. Slot-based spread fill ─────────────────────────────────────────────
    //
    // Pass A: attempt to fill each of the 5 explicit slots (with widening).
    //   One candidate per slot → natural upward progression.
    //
    // Pass B: any slots still empty after Pass A are filled greedily with the
    //   next available eligible candidates (ascending by score).
    //   This is the safety net that ensures we always try to return 5 cards.

    const base      = Math.max(profileScore, 800);
    const usedNames = new Set<string>();
    const finalPool: ScoredAccount[] = [];

    // Pass A
    const slotLog: string[] = [];
    for (const def of SLOT_DEFS) {
      const found = findForSlot(eligible, usedNames, base, def);
      if (found) {
        usedNames.add(found.username);
        finalPool.push({ ...found, tier: def.tier });
        slotLog.push(`✓ score=${Math.round(found.score)}`);
      } else {
        slotLog.push("✗ empty");
      }
    }

    // Pass B: fill remaining positions with leftover eligible candidates
    const passACount = finalPool.length;
    if (finalPool.length < 5) {
      const remaining = eligible
        .filter((c) => !usedNames.has(c.username))
        .sort((a, b) => a.score - b.score);

      for (const c of remaining) {
        if (finalPool.length >= 5) break;
        usedNames.add(c.username);
        finalPool.push({ ...c, tier: 3 });
      }
    }

    const filtered = [...finalPool].sort((a, b) => b.score - a.score).slice(0, 5);

    // ── Debug summary ─────────────────────────────────────────────────────────
    const tierCounts = { 1: 0, 2: 0, 3: 0 };
    finalPool.forEach((c) => tierCounts[c.tier]++);

    console.log(`\n[scan] ════ DEBUG SUMMARY ════`);
    console.log(`  Searched username      : @${username}`);
    console.log(`  Searched profile score : ${profileScore}  (base=${base})`);
    console.log(`  Total following        : ${following.length}`);
    console.log(`  Total followers        : ${followers.length}`);
    console.log(`  Total non-followbacks  : ${nonFollowbacks.length}`);
    console.log(`  Total candidates scored: ${nonZeroCount}`);
    console.log(`  Eligible (base filter) : ${eligible.length}`);
    console.log(`  Pass A — slot results:`);
    SLOT_DEFS.forEach((def, i) => {
      console.log(`    Slot ${i + 1} [base+${def.minGap}, base+${def.maxGap})  tier=${def.tier}  →  ${slotLog[i]}`);
    });
    console.log(`  Pass B — filled ${finalPool.length - passACount} extra slot(s) from leftover pool`);
    console.log(`  Tier 1: ${tierCounts[1]}  Tier 2: ${tierCounts[2]}  Tier 3: ${tierCounts[3]}`);
    console.log(`\n[scan] FINAL RESULTS (${filtered.length}):`);
    filtered.forEach((c, i) => {
      const gap = Math.round(c.score - profileScore);
      console.log(`  ${i + 1}. @${c.username.padEnd(24)} score=${Math.round(c.score).toString().padStart(6)}  gap=+${gap}  tier=${c.tier}`);
    });
    console.log(`  Returned: ${filtered.map((c) => `@${c.username}`).join(", ")}`);
    console.log(`${"═".repeat(60)}\n`);

    // ── 10. Empty state ───────────────────────────────────────────────────────
    if (filtered.length === 0) {
      return NextResponse.json({
        predictions: [],
        message: "No stronger non-followback matches found",
      });
    }

    // ── 11. Build PredictedAccount array ─────────────────────────────────────
    const [wildcard, ...corners] = filtered;
    const ordered = [...corners, wildcard];
    const maxScore = wildcard.score || 1;

    const predictions: PredictedAccount[] = ordered.map((entry, i) => {
      const isWild = i === ordered.length - 1;
      return {
        id: i + 1,
        name: entry.name,
        username: `@${entry.username}`,
        avatar: entry.avatar,
        followers: entry.followers,
        category: categoryFromTier(entry.tier, entry.followers),
        score: entry.score,
        matchPercent: Math.round((entry.score / maxScore) * 100),
        reason: buildReason(entry.score, entry.followers, entry.name, entry.tier),
        isWildcard: isWild,
        position: isWild ? "bottom-center" : (POSITIONS[i] ?? "bottom-center"),
      };
    });

    return NextResponse.json({ predictions });
  } catch (err) {
    console.error("[/api/scan] fatal error:", err);
    return NextResponse.json(
      { predictions: [], message: "No stronger non-followback matches found", error: String(err) },
      { status: 500 },
    );
  }
}
