import { NextResponse } from "next/server";
import type { PredictedAccount } from "../../../types";

const BASE = "https://api.sorsa.io/v3";

// ─── Hard blacklist — exact username match after normalisation ────────────────
const HARD_BLACKLIST = new Set([
  "x", "support", "twittersupport", "safety", "premium", "xdevelopers",
  "api", "elonmusk", "binance", "nikitabier", "sama", "meta", "whatsapp",
  "openai", "grok", "google", "youtube", "instagram", "facebook", "telegram",
  "discord", "linkedin", "microsoft", "apple", "samsung", "github",
  "notionhq", "canva", "anthropicai", "moltbook", "openclaw",
  "balajis", "saylor", "jack", "claudeai", "skyecosystem",
  "aave", "wublockchain", "aztecnetwork", "sushiswap",
  "perplexity_ai", "kalshi", "eigencloud", "ethena", "rally_xyz",
  "noise_xyz", "r3achntwrk", "nolimitgains", "jaileddotfun", "gvrt_io", "grvt_io",
  "ethgasofficial", "googlelabs",
]);

/** Normalise a username: lowercase, strip leading @, trim whitespace. */
function normUser(u: string): string {
  return u.toLowerCase().replace(/^@/, "").trim();
}

// ─── Internal candidate type ──────────────────────────────────────────────────

type Candidate = {
  username:  string; // normalised (lowercase, no @)
  name:      string;
  followers: number; // 0 when not provided by API
  score:     number; // 0 when not yet fetched / not indexed
  avatar:    string;
};

// ─── Field extraction helpers ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(obj: Record<string, any>, ...keys: string[]): unknown {
  for (const k of keys) if (obj[k] != null) return obj[k];
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseAccount(raw: Record<string, any>): Candidate {
  const username = normUser(String(
    pick(raw, "username", "handle", "screen_name", "userName", "user_name") ?? "",
  ));
  const name = String(
    pick(raw, "name", "displayName", "display_name", "fullName", "full_name") ??
    username ?? "Unknown",
  ).trim() || username || "Unknown";

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
  ).replace(/^http:\/\//i, "https://").trim();

  return {
    username,
    name,
    followers: isNaN(followers) ? 0 : Math.max(0, followers),
    score:     isNaN(score)     ? 0 : score,
    avatar,
  };
}

/** Extract a normalised account list from any Sorsa envelope shape. */
function extractList(raw: unknown): Candidate[] {
  if (!raw || typeof raw !== "object") return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = raw as Record<string, any>;
  let arr: unknown[] | null = null;
  if (Array.isArray(raw)) {
    arr = raw;
  } else {
    for (const key of ["data", "users", "accounts", "results", "items",
                        "list", "followers", "following", "follows"]) {
      if (Array.isArray(obj[key])) { arr = obj[key]; break; }
    }
  }
  if (!arr) return [];
  return arr
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((item): item is Record<string, any> => !!item && typeof item === "object")
    .map(normaliseAccount)
    .filter((c) => c.username.length > 0);
}

/** Extract a Sorsa score from a /score response envelope. */
function extractScore(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = raw as Record<string, any>;
  const direct = pick(obj, "score", "sorsaScore", "sorsa_score", "orbitScore");
  if (direct != null) { const n = Number(direct); return isNaN(n) ? 0 : n; }
  for (const key of ["data", "user", "result", "profile"]) {
    if (obj[key] && typeof obj[key] === "object") {
      const nested = pick(obj[key], "score", "sorsaScore", "sorsa_score", "orbitScore");
      if (nested != null) { const n = Number(nested); return isNaN(n) ? 0 : n; }
    }
  }
  return 0;
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

/**
 * Fetch up to maxPages × 200 = 1 000 accounts from a paginated Sorsa endpoint.
 * Deduplicates by normalised username. Stops when:
 *   (a) no new accounts added on a page (API exhausted or non-paginating), or
 *   (b) last page returned fewer than PAGE_SIZE items, or
 *   (c) maxPages reached.
 */
const SORSA_PAGE_SIZE = 200;

async function fetchAllPages(basePath: string, maxPages = 5): Promise<Candidate[]> {
  const all: Candidate[]  = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    let raw: unknown;
    try {
      const sep = basePath.includes("?") ? "&" : "?";
      raw = await sorsaFetch(`${basePath}${sep}page=${page}&limit=${SORSA_PAGE_SIZE}`);
    } catch (e) {
      console.log(`[scan] ${basePath.split("?")[0]} page=${page} error — stopping: ${e}`);
      break;
    }
    const batch = extractList(raw);
    let newCount = 0;
    for (const acc of batch) {
      if (acc.username && !seen.has(acc.username)) {
        seen.add(acc.username);
        all.push(acc);
        newCount++;
      }
    }
    console.log(`[scan] ${basePath.split("?")[0]} page=${page}: got=${batch.length} new=${newCount} total=${all.length}`);
    if (newCount === 0 || batch.length < SORSA_PAGE_SIZE) break;
  }
  return all;
}

/**
 * Follower-count → conservative Sorsa-score estimate.
 * Used ONLY as a last resort when Sorsa returns 0 (account unindexed) and
 * fewer than 5 real-score candidates exist. Estimated accounts are always
 * preferred last within any slot so real scores take priority.
 */
function estimateScoreFromFollowers(followers: number): number {
  if (followers >= 1_000_000) return 2800;
  if (followers >=   500_000) return 2300;
  if (followers >=   200_000) return 1900;
  if (followers >=   100_000) return 1600;
  if (followers >=    50_000) return 1400;
  if (followers >=    20_000) return 1200;
  if (followers >=    10_000) return 1000;
  if (followers >=     5_000) return  850;
  if (followers >=     1_000) return  650;
  return 400;
}

/** Fetch the Sorsa score for a single account. Returns 0 on any failure. */
async function fetchScore(username: string): Promise<number> {
  try {
    const raw = await sorsaFetch(`/score?username=${encodeURIComponent(username)}`);
    return extractScore(raw);
  } catch {
    return 0;
  }
}

// ─── Gap-based slot tables ────────────────────────────────────────────────────
//
// Each of the 5 result cards targets a specific score-gap window above the
// searched user's score, creating a natural "orbit ladder" progression.
//
// Standard (profileScore < 1500) — wider gaps, realistic for smaller accounts:
//   Slot 1: +200–300  |  Slot 2: +400–600  |  Slot 3: +600–800
//   Slot 4: +800–1000  |  Slot 5: +1000+ (Rare Pick stretch)
//
// High (profileScore ≥ 1500) — tighter gaps, denser high-score network:
//   Slot 1: +100–300  |  Slot 2: +300–500  |  Slot 3: +500–700
//   Slot 4: +700–1000  |  Slot 5: +1000+ (Rare Pick stretch)

interface SlotDef {
  minGap:     number;  // lower bound for (score − profileScore), inclusive
  maxGap:     number;  // upper bound for (score − profileScore), exclusive; 0 = unbounded
  isRarePick: boolean;
}

const SLOTS_STANDARD: SlotDef[] = [
  { minGap:  200, maxGap:  300, isRarePick: false },
  { minGap:  400, maxGap:  600, isRarePick: false },
  { minGap:  600, maxGap:  800, isRarePick: false },
  { minGap:  800, maxGap: 1000, isRarePick: false },
  { minGap: 1000, maxGap:    0, isRarePick: true  }, // unbounded upper end
];

const SLOTS_HIGH: SlotDef[] = [
  { minGap:  100, maxGap:  300, isRarePick: false },
  { minGap:  300, maxGap:  500, isRarePick: false },
  { minGap:  500, maxGap:  700, isRarePick: false },
  { minGap:  700, maxGap: 1000, isRarePick: false },
  { minGap: 1000, maxGap:    0, isRarePick: true  }, // unbounded upper end
];

type SlottedCandidate = { candidate: Candidate; isRarePick: boolean };

/**
 * Assign valid candidates (score > profileScore) to the five orbit slots.
 *
 * Each slot tries five progressively wider passes before giving up:
 *   Pass 1 — exact range [minGap, maxGap).
 *   Pass 2 — lower bound –25 %, same upper.
 *   Pass 3 — lower bound –50 %, upper +25 %.
 *   Pass 4 — lower bound –75 %, upper +50 %.
 *   Pass 5 — any remaining valid candidate (ignore range entirely).
 *
 * Pass 5 guarantees all 5 slots are filled whenever 5+ valid candidates exist,
 * so the UI always shows a full constellation.  The ascending-score sort means
 * the smallest available gap is always chosen first, keeping the ladder natural.
 */
function selectBySlots(
  validCandidates: Candidate[],
  profileScore:    number,
): SlottedCandidate[] {
  const slots  = profileScore >= 1500 ? SLOTS_HIGH : SLOTS_STANDARD;
  const used   = new Set<string>();
  const result: SlottedCandidate[] = [];

  // Ascending by score — smallest gap wins within every pass.
  const byScore = [...validCandidates].sort((a, b) => a.score - b.score);

  for (const slot of slots) {
    const lo = profileScore + slot.minGap;
    const hi = slot.maxGap === 0 ? Infinity : profileScore + slot.maxGap;

    // Five widening passes — each expands the window until a candidate is found.
    const passes = [
      { lo,                                    hi },                                       // exact
      { lo: profileScore + slot.minGap * 0.75, hi },                                       // –25 % lower
      { lo: profileScore + slot.minGap * 0.50, hi: hi === Infinity ? hi : hi * 1.25 },    // –50 % lower, +25 % upper
      { lo: profileScore + slot.minGap * 0.25, hi: hi === Infinity ? hi : hi * 1.50 },    // –75 % lower, +50 % upper
      { lo: 0,                                  hi: Infinity },                            // any candidate in eligible pool
    ];

    let pick: Candidate | undefined;
    let passUsed = 0;
    for (const p of passes) {
      passUsed++;
      pick = byScore.find(c => !used.has(c.username) && c.score >= p.lo && c.score < p.hi);
      if (pick) break;
    }

    if (pick) {
      used.add(pick.username);
      result.push({ candidate: pick, isRarePick: slot.isRarePick });
      console.log(`  slot[${slot.minGap}–${slot.maxGap || "∞"}] pass${passUsed} → @${pick.username}  score=${Math.round(pick.score)}${slot.isRarePick ? "  ★ Rare Pick" : ""}`);
    } else {
      console.log(`  slot[${slot.minGap}–${slot.maxGap || "∞"}] → (empty — no valid candidates remain)`);
    }
  }

  return result;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function formatScore(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

/** Returns "N/A" when followers is 0 (unavailable), otherwise a formatted count. */
function formatFollowers(n: number): string {
  if (n <= 0)          return "N/A";
  if (n >= 1_000_000)  return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)      return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

function buildReason(
  score:        number,
  profileScore: number,
  followers:    number,
  name:         string,
): string {
  const s   = formatScore(score);
  const f   = formatFollowers(followers);
  const gap = Math.round(score - profileScore);
  const fStr = f !== "N/A" ? `${f} followers · ` : "";

  const lines = [
    `You follow ${name} — no follow-back yet. ${fStr}Score ${s} (+${gap} vs yours).`,
    `${fStr}Score ${s}. You're already in their orbit — strong follow-back signal.`,
    `Score ${s} (+${gap} above yours). You follow ${name} — elevated reciprocation probability.`,
  ];
  return lines[Math.abs(Math.round(score)) % lines.length];
}

/** Category label driven by slot assignment, not score thresholds. */
function categoryLabel(followers: number, isRarePick: boolean): string {
  if (isRarePick) return "Rare Pick";
  if (followers >= 100_000) return "Strong Match";
  return "High Potential";
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
  console.log(`[scan] ▶ @${username}`);
  console.log(`${"═".repeat(60)}`);

  try {
    // ── 1. Profile score + full follow graph (concurrent) ─────────────────────
    // /follows  : up to 5 pages × 200 = 1 000 followed accounts
    // /followers: up to 10 pages × 200 = 2 000 accounts for complete followback set
    const [profileScoreRaw, following, followers] = await Promise.all([
      sorsaFetch(`/score?username=${enc}`).catch((e) => {
        console.log("[scan] /score failed:", e); return null;
      }),
      fetchAllPages(`/follows?username=${enc}`,   5),
      fetchAllPages(`/followers?username=${enc}`, 25),
    ]);

    const profileScore = profileScoreRaw ? extractScore(profileScoreRaw) : 0;

    console.log(`[scan] profileScore=${profileScore}  following=${following.length}  followers=${followers.length}`);

    // ── 2. Build followback exclusion set ─────────────────────────────────────
    const followsBackSet = new Set(followers.map((u) => normUser(u.username)));

    // ── 3. Filter: blacklist + followback removal ─────────────────────────────
    let blacklistRemovedCount  = 0;
    let followBackRemovedCount = 0;
    const rejectionLog: Array<{ username: string; reason: string }> = [];

    const candidates: Candidate[] = [];
    for (const acc of following) {
      const key = normUser(acc.username);
      if (!key) continue;
      if (HARD_BLACKLIST.has(key)) {
        blacklistRemovedCount++;
        rejectionLog.push({ username: key, reason: "blacklisted" });
        continue;
      }
      if (followsBackSet.has(key)) {
        followBackRemovedCount++;
        rejectionLog.push({ username: key, reason: "follows back" });
        continue;
      }
      candidates.push({ ...acc, username: key });
    }

    console.log(`[scan] candidates after filter: ${candidates.length}  (blacklist=${blacklistRemovedCount}  followback=${followBackRemovedCount})`);

    // ── 4. Score every candidate ──────────────────────────────────────────────
    // Sort by followers desc so highest-profile accounts are checked first;
    // they are most likely to have score > profileScore.
    // Two passes to minimise API calls:
    //   Pass A — use score already embedded in the /follows list response.
    //   Pass B — batch-fetch /score for accounts with score=0 in the list;
    //             stops as soon as 5 valid (score > profileScore) are found.
    const sorted = [...candidates].sort((a, b) => b.followers - a.followers);

    const withListScore    = sorted.filter((c) => c.score > 0);
    const withoutListScore = sorted.filter((c) => c.score === 0);

    // Pass A — collect all accounts with a list score > 0.
    // Score-floor filtering is deferred to step 5 so we can relax it if needed.
    const allScoredPool: Candidate[] = [];
    for (const c of withListScore) {
      if (c.score > 0) {
        allScoredPool.push(c);
        console.log(`  scored (list)    @${c.username}: score=${Math.round(c.score)}`);
      } else {
        rejectionLog.push({ username: c.username, reason: "missing score" });
      }
    }

    // Pass B — fetch /score for zero-score accounts in batches of 50.
    // Accounts that return 0 from Sorsa (unindexed) are saved separately for
    // the follower-estimate fallback in step 5.
    const SCORE_BATCH = 50;
    let scoredCount = withListScore.length;
    const unindexedCandidates: Candidate[] = []; // score=0 from Sorsa — used for estimation fallback

    if (withoutListScore.length > 0) {
      console.log(`[scan] Pass B: fetching scores for ${withoutListScore.length} zero-score accounts…`);
      for (let i = 0; i < withoutListScore.length; i += SCORE_BATCH) {
        const batch  = withoutListScore.slice(i, i + SCORE_BATCH);
        const scores = await Promise.all(batch.map((acc) => fetchScore(acc.username)));

        for (let j = 0; j < batch.length; j++) {
          const acc   = batch[j];
          const score = scores[j];
          scoredCount++;

          if (score === 0) {
            rejectionLog.push({ username: acc.username, reason: "missing score" });
            unindexedCandidates.push(acc); // keep for estimation fallback
          } else {
            allScoredPool.push({ ...acc, score });
            console.log(`  scored (fetched) @${acc.username}: score=${score}`);
          }
        }
        console.log(`  Pass B offset=${i + SCORE_BATCH}: poolSize=${allScoredPool.length}`);
      }
    }

    // ── 5. Slot assignment ────────────────────────────────────────────────────
    // Hard requirement: score must ALWAYS be strictly above profileScore.
    // This floor is never relaxed — we never recommend an account with a lower
    // or equal Orbit score than the scanned user.
    // The 5-pass slot widening inside selectBySlots handles cases where not
    // enough candidates fall in the ideal gap ranges.
    const activeFloor = profileScore;
    const eligible = allScoredPool.filter(c => c.score > profileScore);
    console.log(`\n[scan] Eligible (score > ${Math.round(profileScore)}): ${eligible.length} accounts`);
    let slotted: SlottedCandidate[] = selectBySlots(eligible, profileScore);
    console.log(`  → ${slotted.length} slot(s) filled`);

    // ── 5b. Estimation fallback — only when real scores can't fill 5 slots ──────
    // Apply follower-count estimates to Sorsa-unindexed accounts and merge into
    // the pool for one more slot-fill attempt. Estimated entries are filtered
    // by the same hard floor (estimated score > profileScore).
    if (slotted.length < 5 && unindexedCandidates.length > 0) {
      console.log(`\n[scan] Estimation fallback: ${unindexedCandidates.length} unindexed accounts → applying follower estimates…`);
      const estimatedPool = unindexedCandidates
        .map(c => ({ ...c, score: estimateScoreFromFollowers(c.followers) }))
        .filter(c => c.score > profileScore);

      const combined = [...eligible, ...estimatedPool];
      const slotted2 = selectBySlots(combined, profileScore);
      if (slotted2.length > slotted.length) slotted = slotted2;
      console.log(`  Estimation fallback result: ${slotted.length} slot(s) filled`);
    }

    console.log(`\n[scan] RESULTS: ${slotted.length} slot(s) filled (floor=${Math.round(activeFloor)}):`);
    slotted.forEach(({ candidate: c, isRarePick }, i) =>
      console.log(`  ${i + 1}. @${c.username.padEnd(24)}  score=${Math.round(c.score)}  gap=${Math.round(c.score - profileScore) >= 0 ? "+" : ""}${Math.round(c.score - profileScore)}${isRarePick ? "  ★" : ""}`),
    );

    // Log every scored-but-unselected account.
    const selectedKeys = new Set(slotted.map(s => s.candidate.username));
    for (const c of allScoredPool) {
      if (!selectedKeys.has(c.username)) {
        rejectionLog.push({
          username: c.username,
          reason: c.score <= profileScore
            ? `score too low (${Math.round(c.score)} ≤ profileScore ${Math.round(profileScore)})`
            : "not selected by slot assignment",
        });
      }
    }

    // ── 6. Debug object ───────────────────────────────────────────────────────
    const debugInfo = {
      profileScore:            Math.round(profileScore),
      slotTable:               profileScore >= 1500 ? "HIGH" : "STANDARD",
      scoreFloorUsed:          Math.round(activeFloor),
      followingCheckedCount:   following.length,
      followerSetCount:        followers.length,
      blacklistRemovedCount,
      followBackRemovedCount,
      scoredCount,
      aboveProfileScoreCount:  allScoredPool.filter(c => c.score > profileScore).length,
      finalCandidateUsernames: slotted.map(({ candidate: c }) => `@${c.username}`),
      rejections:              rejectionLog,
    };

    console.log(`\n[scan] DEBUG:`);
    console.log(JSON.stringify({
      ...debugInfo,
      rejections: `[${rejectionLog.length} entries — see server log]`,
    }, null, 2));

    // ── 7. Empty state ────────────────────────────────────────────────────────
    if (slotted.length === 0) {
      const hasGraph = following.length > 0 || followers.length > 0;
      const message = !hasGraph && profileScore > 0
        ? "Follow network not indexed yet — Sorsa has your score but no graph data. Try again in a few hours."
        : profileScore === 0
          ? "Could not retrieve your Sorsa score. Make sure the account is indexed."
          : "No accounts you follow currently have a higher Sorsa score than yours.";

      return NextResponse.json({
        predictions: [],
        exhausted:   true,
        message,
        debug: debugInfo,
      });
    }

    // ── 8. Build PredictedAccount array ──────────────────────────────────────
    // The Rare Pick slot (last slot) is the wildcard at bottom-center.
    // Non-rare-pick slots fill the corner positions in slot order.
    const rarePickEntry   = slotted.find(s => s.isRarePick);
    const cornerEntries   = slotted.filter(s => !s.isRarePick);
    // Wildcard = Rare Pick if it exists; otherwise the highest-gap result.
    const wildcardEntry   = rarePickEntry ?? slotted[slotted.length - 1];
    const orderedEntries  = [
      ...cornerEntries.filter(s => s !== wildcardEntry),
      wildcardEntry,
    ];

    const matchRef = Math.max(profileScore, 1);

    const predictions: PredictedAccount[] = orderedEntries.map(({ candidate: entry, isRarePick }, i) => {
      const isWild = i === orderedEntries.length - 1;
      return {
        id:           i + 1,
        name:         entry.name,
        username:     `@${entry.username}`,
        avatar:       entry.avatar,
        followers:    entry.followers,
        category:     categoryLabel(entry.followers, isRarePick),
        score:        entry.score,
        matchPercent: Math.min(100, Math.round((entry.score / matchRef) * 100)),
        reason:       buildReason(entry.score, profileScore, entry.followers, entry.name),
        isWildcard:   isWild,
        position:     isWild ? "bottom-center" : (POSITIONS[i] ?? "bottom-center"),
      };
    });

    return NextResponse.json({
      predictions,
      exhausted: slotted.length < 5,
      debug: debugInfo,
    });

  } catch (err) {
    console.error("[/api/scan] fatal:", err);
    return NextResponse.json(
      { predictions: [], exhausted: true, message: "Scan failed — check server logs.", error: String(err) },
      { status: 500 },
    );
  }
}
