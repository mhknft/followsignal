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

// ─── Score-gap ranges ─────────────────────────────────────────────────────────
//
// Five ordered ranges of score gaps relative to the searched user's score.
// Slots are filled from the closest (smallest gap) range first, then gradually
// widened — so a searched user with score 800 gets recommendations like
// 900 · 1 100 · 1 300 · 1 700 · 2 200  rather than jumping straight to 3 500+.
//
// Each range maps to a display tier (1-3) that drives category labels.

type Tier        = 1 | 2 | 3;
type ScoredAccount = NormalisedAccount & { tier: Tier };

interface ScoreGapRange {
  minGap: number;   // candidate must be at least (base + minGap)
  maxGap: number;   // candidate must be below (base + maxGap)  [Infinity = no cap]
  tier:   Tier;
}

function getGapRanges(profileScore: number): ScoreGapRange[] {
  // Use a floor of 800 when the /score call fails (profileScore = 0).
  const base = Math.max(profileScore, 800);
  return [
    { minGap:    0, maxGap:  300, tier: 1 }, // R1: +0  → +300  above base  (closest)
    { minGap:  300, maxGap:  500, tier: 1 }, // R2: +300 → +500
    { minGap:  500, maxGap: 1000, tier: 2 }, // R3: +500 → +1 000
    { minGap: 1000, maxGap: 1500, tier: 2 }, // R4: +1 000 → +1 500
    { minGap: 1500, maxGap: Infinity, tier: 3 }, // R5: 1 500+ above base   (last resort)
  ].map((r) => ({
    ...r,
    // Translate relative gaps into absolute score bounds.
    min: base + r.minGap,
    max: r.maxGap === Infinity ? Infinity : base + r.maxGap,
  })) as (ScoreGapRange & { min: number; max: number })[];
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

    // ── 5. Sort by followers_count, take top 300 ─────────────────────────────
    // Larger pool means more candidates to score, giving the tiered windows a
    // better chance to fill all 5 slots for users with many mutual follows.
    const top300 = [...nonFollowbacks]
      .sort((a, b) => b.followers - a.followers)
      .slice(0, 300);

    console.log(`\n[scan] Fetching Sorsa scores for ${top300.length} candidates...`);

    // ── 6. Parallel score lookup for top 300 ─────────────────────────────────
    const scores = await Promise.all(top300.map((acc) => fetchScore(acc.username)));

    const withScores: NormalisedAccount[] = top300.map((acc, i) => ({
      ...acc,
      score: scores[i],
    }));

    const nonZeroCount = withScores.filter((c) => c.score > 0).length;
    console.log(`  Candidates scored      : ${nonZeroCount} (non-zero scores out of ${top300.length} fetched)`);

    // ── 7. Base eligibility + deduplication ───────────────────────────────────
    //
    // Every candidate must satisfy ALL of these before entering any range:
    //   • valid username, finite non-zero score
    //   • score >= 800 (absolute floor)
    //   • score strictly > profileScore (never recommend weaker-than-searched)
    //   • unique username (first occurrence wins)

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

    // ── 8. Range-gap waterfall fill ───────────────────────────────────────────
    //
    // Fill 5 slots starting from the closest score-gap range, widening outward
    // only when a nearer range can't supply enough candidates.  Within each range,
    // candidates are sorted ascending so the smallest gaps appear first, giving
    // gradual score progressions (e.g. 900 · 1100 · 1300 · 1700 · 2200).

    const ranges = getGapRanges(profileScore) as (ScoreGapRange & { min: number; max: number })[];
    const SLOTS  = 5;

    const finalPool: ScoredAccount[] = [];
    const usedNames = new Set<string>(); // safety guard across ranges

    const rangeCounts: number[] = [];

    for (const range of ranges) {
      if (finalPool.length >= SLOTS) break;

      const inRange = eligible
        .filter((c) => c.score >= range.min && c.score < range.max && !usedNames.has(c.username))
        .sort((a, b) => a.score - b.score); // ascending: closest gap first

      const needed = SLOTS - finalPool.length;
      const taken  = inRange.slice(0, needed);

      taken.forEach((c) => {
        usedNames.add(c.username);
        finalPool.push({ ...c, tier: range.tier });
      });
      rangeCounts.push(taken.length);
    }

    // Final output sorted by score desc (highest = wildcard card)
    const filtered = [...finalPool].sort((a, b) => b.score - a.score).slice(0, SLOTS);

    // ── Debug summary ─────────────────────────────────────────────────────────
    const tierCounts = { 1: 0, 2: 0, 3: 0 };
    finalPool.forEach((c) => tierCounts[c.tier]++);

    console.log(`\n[scan] ════ DEBUG SUMMARY ════`);
    console.log(`  Searched username      : @${username}`);
    console.log(`  Searched profile score : ${profileScore}`);
    console.log(`  Total following        : ${following.length}`);
    console.log(`  Total followers        : ${followers.length}`);
    console.log(`  Total non-followbacks  : ${nonFollowbacks.length}`);
    console.log(`  Total candidates scored: ${nonZeroCount}`);
    console.log(`  Eligible (base filter) : ${eligible.length}`);
    console.log(`  Gap ranges used:`);
    ranges.forEach((r, i) => {
      const maxLabel = r.max === Infinity ? "∞" : String(Math.round(r.max));
      console.log(`    R${i + 1} [${Math.round(r.min)}, ${maxLabel})  tier=${r.tier}  →  ${rangeCounts[i] ?? 0} used`);
    });
    console.log(`  Tier 1 total: ${tierCounts[1]},  Tier 2 total: ${tierCounts[2]},  Tier 3 total: ${tierCounts[3]}`);
    console.log(`\n[scan] FINAL RESULTS (${filtered.length}):`);
    filtered.forEach((c, i) => {
      console.log(`  ${i + 1}. @${c.username.padEnd(24)} score=${Math.round(c.score).toString().padStart(6)}  tier=${c.tier}  followers=${c.followers}`);
    });
    console.log(`  Returned usernames: ${filtered.map((c) => `@${c.username}`).join(", ")}`);
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
