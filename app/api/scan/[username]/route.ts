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
  ).trim().replace(/^http:\/\//i, "https://"); // force https for Next.js Image

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

// ─── Score threshold ──────────────────────────────────────────────────────────

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
    //
    // NOTE: /follows and /followers do NOT include Sorsa scores.
    //       We use followers_count as an initial proxy to rank candidates,
    //       then call /score individually for the top 20 non-followbacks.
    //
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

    console.log(`\n[scan] STEP 1 — Raw counts:`);
    console.log(`  profileScore : ${profileScore}`);
    console.log(`  /follows     : ${following.length} accounts (outgoing, no score field)`);
    console.log(`  /followers   : ${followers.length} accounts (incoming, no score field)`);

    // ── 2. Build follower-back exclusion set ──────────────────────────────────
    const followsBackSet = new Set(followers.map((u) => u.username));

    console.log(`\n[scan] STEP 2 — Follow-back exclusion set: ${followsBackSet.size} usernames`);

    // ── 3. Find non-followbacks from following list ───────────────────────────
    //  Relationship rule:
    //    candidate IS in /follows (user follows them)
    //    candidate is NOT in /followers (they have NOT followed back)
    const nonFollowbacks = following
      .filter((acc) => acc.username.length > 0)
      .filter((acc) => !followsBackSet.has(acc.username));

    console.log(`\n[scan] STEP 3 — Non-followbacks: ${nonFollowbacks.length}`);
    console.log(`  (following ${following.length}, followers ${followers.length}, removed ${following.length - nonFollowbacks.length} mutual)`);

    // ── 4. Sort by followers_count (proxy for influence), take top 20 ─────────
    const top20 = [...nonFollowbacks]
      .sort((a, b) => b.followers - a.followers)
      .slice(0, 20);

    console.log(`\n[scan] STEP 4 — Top 20 non-followbacks by followers_count:`);
    top20.forEach((c, i) => {
      console.log(`  ${i + 1}. @${c.username.padEnd(24)} followers=${String(c.followers).padStart(8)}`);
    });

    // ── 5. Parallel score lookup for the top 20 ───────────────────────────────
    console.log(`\n[scan] STEP 5 — Fetching Sorsa scores for ${top20.length} candidates...`);
    const scores = await Promise.all(top20.map((acc) => fetchScore(acc.username)));

    const withScores: NormalisedAccount[] = top20.map((acc, i) => ({
      ...acc,
      score: scores[i],
    }));

    console.log(`\n[scan] STEP 5 — Scores received:`);
    withScores.forEach((c) => {
      console.log(`  @${c.username.padEnd(24)} score=${c.score}`);
    });

    // ── 6. Apply score threshold ──────────────────────────────────────────────
    const threshold = getScoreThreshold(profileScore);
    console.log(`\n[scan] STEP 6 — Score threshold: ${threshold}  (profileScore=${profileScore})`);

    const afterValid  = withScores.filter(isValid);
    const afterScore  = afterValid.filter((c) => c.score >= threshold && c.score >= 800);

    console.log(`  valid      : ${afterValid.length}`);
    console.log(`  after score filter : ${afterScore.length}  (removed ${afterValid.length - afterScore.length} below ${threshold})`);

    if (afterScore.length === 0 && afterValid.length > 0) {
      console.log(`\n[scan] DEBUG — All candidates failed score filter:`);
      afterValid.sort((a, b) => b.score - a.score).forEach((c) => {
        console.log(`  @${c.username.padEnd(24)} score=${c.score}  needed=${threshold}  ✗`);
      });
    }

    const filtered = afterScore.sort((a, b) => b.score - a.score).slice(0, 5);

    console.log(`\n[scan] STEP 7 — Final results (${filtered.length}):`);
    filtered.forEach((c, i) => {
      console.log(`  ${i + 1}. @${c.username}  score=${c.score}  followers=${c.followers}`);
    });
    console.log(`${"═".repeat(60)}\n`);

    // ── 7. Empty state ────────────────────────────────────────────────────────
    if (filtered.length === 0) {
      return NextResponse.json({
        predictions: [],
        message: "No stronger non-followback matches found",
      });
    }

    // ── 8. Build PredictedAccount array ──────────────────────────────────────
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
        // wildcard always goes to bottom-center regardless of array length
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
