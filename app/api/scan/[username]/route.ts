import { NextResponse } from "next/server";
import type { PredictedAccount } from "../../../types";

const BASE = "https://api.sorsa.io/v3";

// ─── Normalised internal type ─────────────────────────────────────────────────

type NormalisedAccount = {
  username: string; // without @
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
  ).replace(/^@/, "").trim();

  const name = String(
    pick(raw, "name", "displayName", "display_name", "fullName", "full_name") ??
    rawUsername ??
    "Unknown",
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
  ).trim();

  return {
    username: rawUsername,
    name,
    followers: isNaN(followers) ? 0 : followers,
    score:     isNaN(score)     ? 0 : score,
    avatar,
  };
}

/** Extract an array of normalised accounts from any Sorsa envelope shape. */
function extractList(raw: unknown): NormalisedAccount[] {
  if (!raw || typeof raw !== "object") return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = raw as Record<string, any>;

  let arr: unknown[] | null = null;
  if (Array.isArray(raw)) {
    arr = raw;
  } else {
    for (const key of ["data", "users", "accounts", "results", "items", "list",
                        "followers", "following", "follows"]) {
      if (Array.isArray(obj[key])) { arr = obj[key]; break; }
    }
  }

  if (!arr) return [];

  return arr
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((item): item is Record<string, any> => !!item && typeof item === "object")
    .map(normaliseAccount);
}

/** Extract the searched user's own Sorsa score from the /score response. */
function extractProfileScore(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = raw as Record<string, any>;

  const direct = pick(obj, "score", "sorsaScore", "sorsa_score", "orbitScore");
  if (direct !== undefined) {
    const n = Number(direct);
    return isNaN(n) ? 0 : n;
  }

  for (const key of ["data", "user", "result", "profile"]) {
    if (obj[key] && typeof obj[key] === "object") {
      const nested = pick(obj[key], "score", "sorsaScore", "sorsa_score", "orbitScore");
      if (nested !== undefined) {
        const n = Number(nested);
        return isNaN(n) ? 0 : n;
      }
    }
  }

  return 0;
}

/** Drop accounts with empty username, NaN score, or non-finite score. */
function isValid(acc: NormalisedAccount): boolean {
  return (
    acc.username.length > 0 &&
    typeof acc.score === "number" &&
    !isNaN(acc.score) &&
    isFinite(acc.score)
  );
}

// ─── Score threshold logic ────────────────────────────────────────────────────

/**
 * Minimum Sorsa score a candidate must have.
 *  - profile score < 800   → threshold 800
 *  - profile score 800–3000 → threshold = profileScore + 500
 *  - profile score > 3000   → threshold 3500
 * Floor of 800 is always enforced.
 */
function getScoreThreshold(profileScore: number): number {
  if (profileScore < 800)   return 800;
  if (profileScore <= 3000) return profileScore + 500;
  return 3500;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function formatScore(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatFollowers(value: unknown): string {
  const n = Number(value || 0);
  if (isNaN(n) || !isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

function categoryFromFollowers(n: number): string {
  if (n >= 1_000_000) return "Top Creator";
  if (n >= 500_000)   return "Major Voice";
  if (n >= 100_000)   return "Influencer";
  if (n >= 10_000)    return "Key Voice";
  return "Rising Star";
}

function buildReason(score: number, followers: number, name: string): string {
  const s = formatScore(score);
  const f = formatFollowers(followers);
  const lines = [
    `Sorsa score ${s}. ${f} followers. You follow them — they haven't followed back yet.`,
    `Score ${s} · ${f} followers. High-value account in your follow graph with no reciprocation.`,
    `${f} followers · score ${s}. You're in their extended orbit — follow-back signal detected.`,
    `High network affinity. Score ${s} places ${name} in the top tier of your non-followback list.`,
  ];
  return lines[Math.abs(Math.round(score)) % lines.length];
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function sorsaFetch(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ApiKey: process.env.SORSA_API_KEY! },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Sorsa ${path} → HTTP ${res.status}`);
  return res.json();
}

// ─── Positions ────────────────────────────────────────────────────────────────

const POSITIONS: PredictedAccount["position"][] = [
  "top-left",
  "top-right",
  "lower-left",
  "lower-right",
  "bottom-center", // wildcard slot — highest score
];

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  try {
    // ── 1. Parallel fetch ─────────────────────────────────────────────────────
    //
    // Relationship rule:
    //   candidates  = /following  (accounts the searched user follows)
    //   exclusions  = /followers  (accounts that already follow them back)
    //   result      = candidates NOT in exclusions  →  non-followback accounts
    //
    const [followingRaw, followersRaw, scoreRaw] = await Promise.allSettled([
      sorsaFetch(`/following?username=${encodeURIComponent(username)}`),
      sorsaFetch(`/followers?username=${encodeURIComponent(username)}`),
      sorsaFetch(`/score?username=${encodeURIComponent(username)}`),
    ]);

    // ── 2. Log raw shapes ─────────────────────────────────────────────────────
    console.log("[scan] /following raw:",
      JSON.stringify(followingRaw.status === "fulfilled" ? followingRaw.value : followingRaw.reason));
    console.log("[scan] /followers raw:",
      JSON.stringify(followersRaw.status === "fulfilled" ? followersRaw.value : followersRaw.reason));
    console.log("[scan] /score raw:",
      JSON.stringify(scoreRaw.status === "fulfilled" ? scoreRaw.value : scoreRaw.reason));

    // ── 3. Extract lists ──────────────────────────────────────────────────────
    const following     = followingRaw.status === "fulfilled" ? extractList(followingRaw.value) : [];
    const followers     = followersRaw.status === "fulfilled" ? extractList(followersRaw.value) : [];
    const profileScore  = scoreRaw.status     === "fulfilled" ? extractProfileScore(scoreRaw.value) : 0;

    console.log(`[scan] profileScore=${profileScore}  following=${following.length}  followers=${followers.length}`);

    // ── 4. Build follower-back exclusion set ──────────────────────────────────
    //  Anyone already in the followers list is excluded — they follow back.
    const followsBackSet = new Set(
      followers
        .filter(isValid)
        .map((u) => u.username.toLowerCase()),
    );

    // ── 5. Candidates = the following list, deduped ───────────────────────────
    const seen = new Set<string>();
    const candidates: NormalisedAccount[] = [];

    for (const entry of following) {
      const key = entry.username.toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        candidates.push(entry);
      }
    }

    console.log(`[scan] candidates before filter: ${candidates.length}`);

    // ── 6. Apply filters ──────────────────────────────────────────────────────
    const threshold = getScoreThreshold(profileScore);
    console.log(`[scan] score threshold: ${threshold}`);

    const filtered = candidates
      .filter(isValid)
      .filter((c) => !followsBackSet.has(c.username.toLowerCase())) // not following back
      .filter((c) => c.score >= threshold && c.score >= 800)        // score floor
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log(`[scan] filtered results: ${filtered.length}`);

    // ── 7. Empty state ────────────────────────────────────────────────────────
    if (filtered.length === 0) {
      return NextResponse.json({
        predictions: [],
        message: "No stronger non-followback matches found",
      });
    }

    // ── 8. Build PredictedAccount array ──────────────────────────────────────
    // Highest scorer → wildcard (bottom-center); rest fill corners in score order
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
        category: categoryFromFollowers(entry.followers),
        score: entry.score,
        matchPercent: Math.round((entry.score / maxScore) * 100),
        reason: buildReason(entry.score, entry.followers, entry.name),
        isWildcard: isWild,
        position: POSITIONS[i] ?? "bottom-center",
      };
    });

    return NextResponse.json({ predictions });
  } catch (err) {
    console.error("[/api/scan] fatal error:", err);
    return NextResponse.json(
      {
        predictions: [],
        message: "No stronger non-followback matches found",
        error: String(err),
      },
      { status: 500 },
    );
  }
}
