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

/** Unwrap a nested Sorsa envelope to find the real data object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = raw as Record<string, any>;
  for (const key of ["data", "user", "result", "profile"]) {
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

  const direct = pick(top, "score", "sorsaScore", "sorsa_score", "orbitScore");
  if (direct !== undefined) {
    const n = Number(direct);
    return isNaN(n) ? 0 : n;
  }

  for (const key of ["data", "user", "result", "profile"]) {
    if (top[key] && typeof top[key] === "object") {
      const nested = pick(top[key], "score", "sorsaScore", "sorsa_score", "orbitScore");
      if (nested !== undefined) {
        const n = Number(nested);
        return isNaN(n) ? 0 : n;
      }
    }
  }
  return 0;
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

  // Fetch /info and /score in parallel
  const [infoResult, scoreResult] = await Promise.allSettled([
    sorsaFetch(`/info?username=${enc}`),
    sorsaFetch(`/score?username=${enc}`),
  ]);

  const infoRaw  = infoResult.status  === "fulfilled" ? infoResult.value  : null;
  const scoreRaw = scoreResult.status === "fulfilled" ? scoreResult.value : null;

  console.log("[profile] /info raw:", JSON.stringify(infoRaw));
  console.log("[profile] /score raw:", JSON.stringify(scoreRaw));

  const src = unwrap(infoRaw);

  const displayName = String(
    pick(src, "name", "displayName", "display_name", "fullName", "full_name") ?? username,
  ).trim() || username;

  const rawUsername = String(
    pick(src, "username", "handle", "screen_name", "userName") ?? username,
  ).replace(/^@/, "").trim() || username;

  const rawAvatar = String(
    pick(src, "profileImageUrl", "profile_image_url", "profileImage",
         "profile_image", "avatar", "avatarUrl", "avatar_url", "photo") ?? "",
  ).trim();

  const avatar = rawAvatar
    ? upgradeTwitterAvatar(rawAvatar.replace(/^http:\/\//i, "https://"))
    : "";

  const bio = String(
    pick(src, "description", "bio", "about", "summary") ?? "",
  ).trim();

  const followers = Number(
    pick(src, "followers_count", "followersCount", "followers", "follower_count") ?? 0,
  );

  const following = Number(
    pick(src, "followings_count", "followingCount", "following", "following_count",
         "friends_count") ?? 0,
  );

  const verified = Boolean(
    pick(src, "verified", "isVerified", "is_verified"),
  );

  const rawScore  = extractScore(scoreRaw);
  const score     = Math.max(rawScore, 800); // floor of 800 per requirements

  const profile: SearchedProfile = {
    displayName,
    username: rawUsername,
    avatar,
    bio,
    followers: isNaN(followers) ? 0 : followers,
    following: isNaN(following) ? 0 : following,
    score,
    verified,
  };

  console.log("[profile] resolved:", JSON.stringify(profile));
  return NextResponse.json(profile);
}
