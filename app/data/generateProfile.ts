/** Deterministic int hash of a string (always positive) */
function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Turn a raw X username into a readable display name.
 *
 * Rules (applied in order):
 *  1. Split on underscores → capitalise each word  → "crypto_builder" → "Crypto Builder"
 *  2. Split on camelCase boundaries                → "alexRivera"    → "Alex Rivera"
 *  3. If length ≥ 6 with no natural split, halve it→ "mhknft"        → "Mhk Nft"
 *  4. Otherwise just capitalise the first letter   → "alice"          → "Alice"
 */
export function generateDisplayName(username: string): string {
  // 1. Underscore split
  if (username.includes("_")) {
    return username
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  // 2. camelCase split  e.g. alexRivera → ["alex","Rivera"]
  const camel = username.replace(/([a-z])([A-Z])/g, "$1 $2");
  if (camel !== username) {
    return camel
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  // 3. Halve for ≥ 6 char all-lowercase/digit names
  if (username.length >= 6) {
    const mid = Math.ceil(username.length / 2);
    const a = username.slice(0, mid);
    const b = username.slice(mid);
    return (
      a.charAt(0).toUpperCase() +
      a.slice(1).toLowerCase() +
      " " +
      b.charAt(0).toUpperCase() +
      b.slice(1).toLowerCase()
    );
  }

  // 4. Short name — just capitalise
  return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
}

const BIOS = [
  "Building the future one post at a time. Passionate about AI and emerging tech.",
  "Founder · Builder · Creator. Exploring the edges of what's possible.",
  "Crypto native. DeFi enthusiast. Building in public every day.",
  "Growth strategist and product thinker. Ship fast, learn faster.",
  "AI researcher turned founder. Turning complex ideas into real products.",
  "Serial entrepreneur. Investing in people and ideas that actually matter.",
  "Designer and engineer. Making the internet more beautiful, one pixel at a time.",
  "Community builder. Open-source advocate. Chronically online.",
  "Startups, systems, and side projects. Always building something new.",
  "Content creator meets technologist. Where creativity meets code.",
];

import type { UserProfile } from "../types";

/** Generate a consistent mock profile from a username string */
export function generateUserProfile(username: string): UserProfile {
  const h = hash(username);

  // Orbit score: 58–96
  const orbitScore = 58 + (h % 39);

  // Followers: 4K – 280K, on a curve so most are mid-range
  const followerBuckets = [4200, 8800, 14500, 22000, 38000, 61000, 95000, 142000, 198000, 277000];
  const followers = followerBuckets[h % followerBuckets.length];

  // Following: 80 – 1 400
  const following = 80 + ((h >> 4) % 1320);

  const bio = BIOS[h % BIOS.length];

  // Deterministic but visually distinct avatar — pravatar uses `u` param as seed
  const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(username)}`;

  // ~1 in 4 accounts verified
  const verified = h % 4 === 0;

  return {
    name: generateDisplayName(username),
    username: `@${username}`,
    avatar,
    bio,
    followers,
    following,
    orbitScore,
    verified,
  };
}
