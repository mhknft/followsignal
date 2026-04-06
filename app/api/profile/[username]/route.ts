import { NextResponse } from "next/server";
import type { SearchedProfile } from "../../../types";

const BASE = "https://api.sorsa.io/v3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(obj: Record<string, any>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

/** Unwrap nested Sorsa envelope shapes to find the real user-data object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = raw as Record<string, any>;
  for (const key of ["data", "user", "result", "profile", "account", "info"]) {
    if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      return obj[key];
    }
  }
  return obj;
}

/** Remove the Twitter _normal suffix to get a higher-res image. */
function upgradeTwitterAvatar(url: string): string {
  return url.replace(/_normal(\.[a-z]+)$/i, "_400x400$1");
}

/** Extract Sorsa score defensively from /score response. */
function extractScore(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const top = raw as Record<string, any>;

  const direct = pick(top, "score", "sorsaScore", "sorsa_score", "orbitScore", "orbit_score");
  if (direct !== undefined) {
    const n = Number(direct);
    return isNaN(n) ? 0 : n;
  }

  for (const key of ["data", "user", "result", "profile", "account"]) {
    if (top[key] && typeof top[key] === "object") {
      const nested = pick(top[key], "score", "sorsaScore", "sorsa_score", "orbitScore", "orbit_score");
      if (nested !== undefined) {
        const n = Number(nested);
        return isNaN(n) ? 0 : n;
      }
    }
  }
  return 0;
}

/**
 * Parse a numeric field from raw API data.
 * Returns the parsed number if the field exists, or null if not present.
 * Callers must distinguish "API returned 0" from "field absent" — never default
 * a missing field to 0 silently.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseNumber(src: Record<string, any>, ...keys: string[]): number | null {
  const val = pick(src, ...keys);
  if (val === undefined || val === null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

async function sorsaFetch(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ApiKey: process.env.SORSA_API_KEY! },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const enc = encodeURIComponent(username);

  const [infoResult, scoreResult] = await Promise.allSettled([
    sorsaFetch(`/info?username=${enc}`),
    sorsaFetch(`/score?username=${enc}`),
  ]);

  const infoRaw  = infoResult.status  === "fulfilled" ? infoResult.value  : null;
  const scoreRaw = scoreResult.status === "fulfilled" ? scoreResult.value : null;

  // Detailed logs so we can diagnose missing-field cases
  console.log("[profile] /info status:", infoResult.status);
  if (infoResult.status === "rejected") {
    console.log("[profile] /info error:", infoResult.reason);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawObj = infoRaw as Record<string, any> | null;
    console.log("[profile] /info top-level keys:", rawObj ? Object.keys(rawObj) : "null");
    console.log("[profile] /info raw:", JSON.stringify(infoRaw).slice(0, 800));
  }

  console.log("[profile] /score status:", scoreResult.status);
  if (scoreResult.status === "rejected") {
    console.log("[profile] /score error:", scoreResult.reason);
  } else {
    console.log("[profile] /score raw:", JSON.stringify(scoreRaw).slice(0, 400));
  }

  const src = unwrap(infoRaw);
  console.log("[profile] unwrapped keys:", Object.keys(src));

  const displayName = String(
    pick(src, "name", "displayName", "display_name", "fullName", "full_name") ?? username,
  ).trim() || username;

  const rawUsername = String(
    pick(src, "username", "handle", "screen_name", "userName", "user_name") ?? username,
  ).replace(/^@/, "").trim() || username;

  const rawAvatar = String(
    pick(src,
      "profileImageUrl", "profile_image_url", "profileImage", "profile_image",
      "avatarUrl", "avatar_url", "avatar", "photo", "picture", "image",
      "profile_image_url_https",
    ) ?? "",
  ).trim();

  const avatar = rawAvatar
    ? upgradeTwitterAvatar(rawAvatar.replace(/^http:\/\//i, "https://"))
    : "";

  const bio = String(
    pick(src, "description", "bio", "about", "summary") ?? "",
  ).trim();

  const verified = Boolean(
    pick(src, "verified", "isVerified", "is_verified", "blue_verified"),
  );

  // Parse followers / following as nullable: null means "not returned by API".
  // We store -1 as a sentinel so the UI can hide counters vs showing fake zeros.
  const followersRaw = parseNumber(
    src,
    "followers_count", "followersCount", "followers", "follower_count",
    "followerscount", "numFollowers",
  );
  const followingRaw = parseNumber(
    src,
    "friends_count", "followings_count", "followingCount", "following",
    "following_count", "followingcount",
  );

  console.log("[profile] parsed followers:", followersRaw, "  following:", followingRaw);

  // -1 = field was absent from API response (not a real 0)
  const followers = followersRaw !== null ? followersRaw : -1;
  const following = followingRaw !== null ? followingRaw : -1;

  const score = extractScore(scoreRaw);

  const profile: SearchedProfile = {
    displayName,
    username: rawUsername,
    avatar,
    bio,
    followers,
    following,
    score,
    verified,
  };

  console.log("[profile] resolved:", JSON.stringify(profile));
  return NextResponse.json(profile);
}
