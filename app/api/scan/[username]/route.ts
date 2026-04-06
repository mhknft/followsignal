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

/** Fetch the Sorsa score for a single account. Returns 0 on any failure. */
async function fetchScore(username: string): Promise<number> {
  try {
    const raw = await sorsaFetch(`/score?username=${encodeURIComponent(username)}`);
    return extractScore(raw);
  } catch {
    return 0;
  }
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

/** Simple category label — all results are above profileScore so labels reflect how far above. */
function categoryLabel(score: number, profileScore: number, followers: number): string {
  const delta = score - profileScore;
  if (delta > profileScore * 0.5 || followers >= 200_000) return "Rare Pick";
  if (delta > profileScore * 0.2 || followers >= 50_000)  return "Strong Match";
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
      fetchAllPages(`/followers?username=${enc}`, 10),
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

    // Pass A — instant classification from list scores
    const validCandidates: Candidate[] = [];
    for (const c of withListScore) {
      if (c.score > profileScore) {
        validCandidates.push(c);
        console.log(`  VALID (list)    @${c.username}: score=${Math.round(c.score)}`);
      } else {
        rejectionLog.push({
          username: c.username,
          reason: `score too low (${Math.round(c.score)} ≤ ${Math.round(profileScore)})`,
        });
      }
    }

    // Pass B — fetch /score for zero-score accounts in batches of 50
    // Early-stop once we have ≥ 5 valid candidates.
    const SCORE_BATCH = 50;
    let scoredCount = withListScore.length;

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
          } else if (score > profileScore) {
            validCandidates.push({ ...acc, score });
            console.log(`  VALID (fetched) @${acc.username}: score=${score}`);
          } else {
            rejectionLog.push({
              username: acc.username,
              reason: `score too low (${score} ≤ ${Math.round(profileScore)})`,
            });
          }
        }
        console.log(`  Pass B offset=${i + SCORE_BATCH}: validSoFar=${validCandidates.length}`);
      }
    }

    // ── 5. Sort descending by score, take top 5 ───────────────────────────────
    const finalCandidates = validCandidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log(`\n[scan] RESULTS: ${finalCandidates.length} valid candidate(s):`);
    finalCandidates.forEach((c, i) =>
      console.log(`  ${i + 1}. @${c.username.padEnd(24)}  score=${Math.round(c.score)}`),
    );

    // ── 6. Debug object ───────────────────────────────────────────────────────
    const debugInfo = {
      profileScore:            Math.round(profileScore),
      followingCheckedCount:   following.length,
      followerSetCount:        followers.length,
      blacklistRemovedCount,
      followBackRemovedCount,
      scoredCount,
      aboveProfileScoreCount:  validCandidates.length,
      finalCandidateUsernames: finalCandidates.map((c) => `@${c.username}`),
      rejections:              rejectionLog,
    };

    console.log(`\n[scan] DEBUG:`);
    console.log(JSON.stringify({
      ...debugInfo,
      rejections: `[${rejectionLog.length} entries — see server log]`,
    }, null, 2));

    // ── 7. Empty state ────────────────────────────────────────────────────────
    if (finalCandidates.length === 0) {
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
    // Wildcard = the strongest account (index 0 after sort desc).
    // Corners  = the remaining ≤ 4.
    const [wildcard, ...corners] = finalCandidates;
    const ordered = [...corners, wildcard];

    const matchRef = Math.max(profileScore, 1);

    const predictions: PredictedAccount[] = ordered.map((entry, i) => {
      const isWild = i === ordered.length - 1;
      return {
        id:           i + 1,
        name:         entry.name,
        username:     `@${entry.username}`,
        avatar:       entry.avatar,
        followers:    entry.followers,
        category:     categoryLabel(entry.score, profileScore, entry.followers),
        score:        entry.score,
        matchPercent: Math.min(100, Math.round((entry.score / matchRef) * 100)),
        reason:       buildReason(entry.score, profileScore, entry.followers, entry.name),
        isWildcard:   isWild,
        position:     isWild ? "bottom-center" : (POSITIONS[i] ?? "bottom-center"),
      };
    });

    return NextResponse.json({
      predictions,
      exhausted: finalCandidates.length < 5,
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
