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
  userFollows: boolean;      // true = searched user follows them but they don't follow back yet
  scoreEstimated?: boolean;  // true = no real Sorsa score; estimate derived from follower count
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
    userFollows: false, // default; overridden after extraction when needed
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
// Five-tier filter removes brand, product, org, bot, and non-personal accounts
// so only individual creators, traders, and CT personalities reach the final
// ranking.  All comparisons are lowercase.  Applied BEFORE scoring so no API
// quota is spent on excluded candidates.

// ── Tier 1: exact username block ─────────────────────────────────────────────
const BLOCKED_USERNAMES = new Set([
  // AI / tech companies
  "claude", "anthropic", "openai", "google", "tesla", "microsoft", "apple",
  "meta", "amazon", "nvidia", "perplexity", "perplexityai",
  // Messaging / platforms
  "discord", "telegram", "whatsapp", "signal", "slack", "zoom",
  // Professional / social platforms
  "linkedin", "moltbook",
  // Twitter / X platform features
  "premium", "xpremium", "x_premium", "verified",
  // Crypto infrastructure
  "ethereum", "ethereumfoundation", "ethereumfndn",
  "solana", "avalanche", "polkadot", "cardano", "tron", "algorand",
  "near", "aptos", "sui", "stellar", "ripple", "litecoin",
  // CEXs
  "binance", "coinbase", "kraken", "okx", "bybit", "kucoin", "bitget",
  "gateio", "huobi", "mexc", "bitfinex", "bitmex",
  // Wallets / DeFi
  "metamask", "phantom", "rabby", "rainbow", "trustwallet", "ledger",
  "uniswap", "aave", "compound", "curve", "gmx", "dydx", "synthetix",
  "opensea", "blur", "rarible", "looksrare",
  // Data / tooling
  "coinmarketcap", "coingecko", "defillama", "dune", "nansen",
  // Twitter / X infra
  "openclaw", "xdevelopers", "twitterdev",
]);

// ── Tier 2: username substring block ─────────────────────────────────────────
// If the username CONTAINS any of these the account is a brand or product.
const BLOCKED_USERNAME_SUBSTRINGS = [
  "discord", "telegram", "metamask", "perplexi",
  "uniswap", "airdrop", "official_", "_official",
  "wallet", "exchange", "protocol", "foundation",
  "defi", "nftmarket",
];

// ── Tier 3: display-name substring block ─────────────────────────────────────
// If the full display name CONTAINS any of these strings (as a substring) it
// is almost certainly a product / brand account.
const BLOCKED_DISPLAY_NAME_SUBSTRINGS = [
  "discord", "telegram", "perplexity", "metamask",
  "phantom wallet", "trust wallet",
  "linkedin", "moltbook",
  "x premium", "x corp", "x safety", "openai",
  "ethereum foundation",
];

// ── Tier 4: display-name token block ─────────────────────────────────────────
// Individual WORDS in the display name that indicate an org or product.
const ORG_NAME_TOKENS = new Set([
  // Legal / corporate
  "foundation", "official", "exchange",
  "labs", "lab", "capital", "ventures", "venture",
  "fund", "inc", "llc", "ltd", "corp",
  "association", "organization", "org", "society",
  "federation", "alliance", "coalition", "collective",
  "institute", "media", "news", "magazine", "journal",
  // Crypto / web3 org types
  "dao", "protocol", "defi", "dex", "yield", "swap",
  // Generic non-personal
  "team", "group", "network",
  // App / bot signals
  "bot", "app",
  // Specific brands appearing as tokens
  "discord", "telegram", "wallet",
  // Platform features that appear as standalone words
  "premium", "linkedin", "moltbook",
]);

// ── Tier 5: username suffix regex ────────────────────────────────────────────
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
  /bot$/i,
];

// ── Tier 6: generic brand / platform heuristic ───────────────────────────────
// Only Signal A is kept: display name is exactly two words and the first word
// is "X" (e.g. "X Premium", "X Corp" — Twitter/X product accounts).
//
// Signal B (single-word name ≥ 500K) was removed because it incorrectly
// excludes real CT personalities like @Zeneca whose display name is one word.
// The first five tiers already handle genuine brand/org accounts.
function looksLikeGenericBrand(name: string, _followers: number): boolean {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 0);

  // Signal A — "X <Anything>" two-word product names
  if (words.length === 2 && words[0] === "X") return true;

  return false;
}

/**
 * Returns true when the account should be EXCLUDED from recommendations.
 * Runs all six tiers in order; returns false (keep) only if none match.
 */
function isFiltered(name: string, username: string, followers = 0): boolean {
  const uLow = username.toLowerCase();
  const nLow = name.toLowerCase();

  // T1 — exact username
  if (BLOCKED_USERNAMES.has(uLow)) return true;

  // T2 — username substring
  for (const sub of BLOCKED_USERNAME_SUBSTRINGS) {
    if (uLow.includes(sub)) return true;
  }

  // T3 — display-name substring
  for (const sub of BLOCKED_DISPLAY_NAME_SUBSTRINGS) {
    if (nLow.includes(sub)) return true;
  }

  // T4 — display-name token
  const tokens = nLow.split(/[\s\-_.,&|/\\()\[\]+:]+/);
  for (const token of tokens) {
    if (token && ORG_NAME_TOKENS.has(token)) return true;
  }

  // T5 — username suffix pattern
  for (const re of ORG_USERNAME_RE) {
    if (re.test(uLow)) return true;
  }

  // T6 — generic brand / platform heuristic
  if (looksLikeGenericBrand(name, followers)) return true;

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

// ─── Dynamic slot tables ──────────────────────────────────────────────────────
//
// Slot windows and widening passes are chosen based on the searched user's
// Sorsa score so that large accounts (2 000+) can find nearby candidates
// without needing huge score jumps that rarely exist in their follow graph.
//
// Standard  (score < 2 000) : gaps of +100 → +1 600 with aggressive widening.
// High-tier (score ≥ 2 000) : tighter gaps of +25 → +500 so we only require
//   accounts that are slightly stronger, matching realistic follow-graph density.

/** Slot windows for accounts with score < 2 000. */
const SLOT_DEFS_STANDARD: SlotDef[] = [
  { minGap:  100, maxGap:  250, tier: 1 },
  { minGap:  250, maxGap:  450, tier: 1 },
  { minGap:  450, maxGap:  700, tier: 2 },
  { minGap:  700, maxGap: 1100, tier: 2 },
  { minGap: 1100, maxGap: 1600, tier: 3 },
];

/** Slot windows for accounts with score ≥ 2 000 (smaller gaps, easier to fill). */
const SLOT_DEFS_HIGH: SlotDef[] = [
  { minGap:  25, maxGap:  80,  tier: 1 },
  { minGap:  80, maxGap: 130,  tier: 1 },
  { minGap: 130, maxGap: 200,  tier: 2 },
  { minGap: 200, maxGap: 300,  tier: 2 },
  { minGap: 300, maxGap: 500,  tier: 3 },
];

/** Widening passes for standard accounts. */
const WIDEN_STANDARD: Array<{ lo: number; hi: number }> = [
  { lo: 1.00, hi: 1.00 }, // Pass 0: exact window
  { lo: 0.75, hi: 1.40 }, // Pass 1: slightly wider
  { lo: 0.50, hi: 1.80 }, // Pass 2: noticeably wider
  { lo: 0.25, hi: 2.40 }, // Pass 3: quite wide
  { lo: 0.00, hi: 3.20 }, // Pass 4: very wide (floor = searched score)
  { lo: 0.00, hi: 8.00 }, // Pass 5: catch-all safety net
];

/**
 * Widening passes for high-tier accounts (≥ 2 000).
 * Starts tight, then expands: +25–80 → +12–320 → 0–600 → 0–2 000.
 * The final pass floor (lo: 0.00) means we accept any score ≥ base, so
 * even a same-score account qualifies as a last resort.
 */
const WIDEN_HIGH: Array<{ lo: number; hi: number }> = [
  { lo: 1.00, hi: 1.00 }, // Pass 0: exact
  { lo: 0.50, hi: 1.60 }, // Pass 1: half-gap lower, 60 % higher
  { lo: 0.00, hi: 2.40 }, // Pass 2: floor = base (+0), ceiling = 2.4×
  { lo: 0.00, hi: 5.00 }, // Pass 3: wide
  { lo: 0.00, hi: 10.0 }, // Pass 4: catch-all
];

/**
 * Find the single best candidate for one slot.
 * "Best" = lowest effective score in window (smallest gap → most natural progression).
 * scoreOf() returns the effective score (real + any boost) used for window matching.
 * Returns null if every widening pass also comes up empty.
 */
function findForSlot(
  eligible: NormalisedAccount[],
  used:     Set<string>,
  base:     number,
  def:      SlotDef,
  widen:    Array<{ lo: number; hi: number }>,
  scoreOf:  (c: NormalisedAccount) => number = (c) => c.score,
): NormalisedAccount | null {
  for (const { lo, hi } of widen) {
    const minScore = base + def.minGap * lo;
    const maxScore = base + def.maxGap * hi;

    const hit = eligible
      .filter((c) => !used.has(c.username) && scoreOf(c) >= minScore && scoreOf(c) < maxScore)
      .sort((a, b) => scoreOf(a) - scoreOf(b))[0]; // ascending → pick smallest effective gap

    if (hit) return hit;
  }
  return null;
}

/**
 * Run eligibility filter + Pass A (slot-based) + Pass B (greedy same-tier) +
 * Pass C (last-resort any scored human account ≥ 800) on a cumulative scored
 * pool.  Called once per expansion round; returns the best ≤ 5 accounts found
 * so far (sorted descending by score).
 *
 * Pass priority:
 *   A — slot-based with progressive widening (prefers accounts above profileScore)
 *   B — greedy fill from accounts still above the primary eligibility floor
 *   C — absolute last resort: any valid scored account ≥ 800, sorted desc by score.
 *       Triggered only when A+B still can't reach 5, so we never show fewer cards
 *       than are genuinely available in the user's follow graph.
 *
 * Slot/widen tables:
 *   profileScore ≥ 2 000 → HIGH (tighter gaps, matches dense large-account graphs)
 *   profileScore < 2 000 → STANDARD
 */
function fillSlots(
  allScored:    NormalisedAccount[],
  base:         number,
  profileScore: number,
): ScoredAccount[] {
  const isHigh   = profileScore >= 2000;
  const slotDefs = isHigh ? SLOT_DEFS_HIGH  : SLOT_DEFS_STANDARD;
  const widen    = isHigh ? WIDEN_HIGH       : WIDEN_STANDARD;

  // Already-followed accounts get a virtual score boost so they are prioritised
  // over 2nd-hop accounts at every tier.  Boost only affects selection order —
  // real Sorsa score is what gets displayed.
  const FOLLOW_BOOST = 200;
  const effectiveScore = (c: NormalisedAccount) => c.score + (c.userFollows ? FOLLOW_BOOST : 0);

  const used = new Set<string>();
  const usedKey = (c: NormalisedAccount) => c.username.toLowerCase();
  const pool: ScoredAccount[] = [];

  // Helper: deduplicated view of allScored filtered to a minimum score floor.
  function eligibleAbove(floor: number): NormalisedAccount[] {
    const seen = new Set<string>();
    return allScored
      .filter(isValid)
      .filter((c) => c.score > 0)
      .filter((c) => effectiveScore(c) > floor)
      .filter((c) => {
        const k = usedKey(c);
        if (used.has(k) || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }

  // ── Pass A: slot-based with progressive widening — strict gate (> profileScore) ─
  {
    const strict = eligibleAbove(profileScore);
    for (const def of slotDefs) {
      const found = findForSlot(strict, used, base, def, widen, effectiveScore);
      if (found) { used.add(usedKey(found)); pool.push({ ...found, tier: def.tier }); }
    }
  }

  // ── Pass B: greedy fill from anything still above profileScore ────────────────
  if (pool.length < 5) {
    const remaining = eligibleAbove(profileScore)
      .sort((a, b) => effectiveScore(b) - effectiveScore(a));
    for (const c of remaining) {
      if (pool.length >= 5) break;
      used.add(usedKey(c));
      pool.push({ ...c, tier: 3 });
    }
  }

  // ── Passes C–F: progressive relaxation — triggered only when < 5 found ───────
  // Each pass lowers the effective-score floor so we always surface the best
  // nearby candidates rather than returning blank cards.
  // Already-followed accounts dominate each pass because of FOLLOW_BOOST.
  // Tier assignment is score-relative so labels stay meaningful:
  //   tier 1 → score > profileScore (strong match)
  //   tier 2 → score > 75 % of profileScore (near orbit)
  //   tier 3 → everything else (possible next / watchlist)
  if (pool.length < 5) {
    const floors = [
      profileScore * 0.80,   // Pass C — within 20 % below
      profileScore * 0.60,   // Pass D — within 40 % below
      profileScore * 0.40,   // Pass E — within 60 % below
      0,                     // Pass F — absolute floor: any score > 0
    ];
    for (const floor of floors) {
      if (pool.length >= 5) break;
      const relaxed = eligibleAbove(floor)
        .sort((a, b) => effectiveScore(b) - effectiveScore(a));
      for (const c of relaxed) {
        if (pool.length >= 5) break;
        used.add(usedKey(c));
        const tier: Tier = c.score > profileScore      ? 1
                         : c.score > profileScore * 0.75 ? 2
                         : 3;
        pool.push({ ...c, tier });
      }
    }
  }

  return pool.sort((a, b) => effectiveScore(b) - effectiveScore(a)).slice(0, 5);
}

// ─── Category label ──────────────────────────────────────────────────────────
//
// Labels are derived from the candidate's actual score relative to the searched
// profile's score, NOT from the slot tier (which only reflects selection order).
// This ensures the UI label honestly reflects how strong each candidate is:
//
//   score > profileScore               → Strong Match / Rare Pick
//   score > 0.75 × profileScore        → Near Orbit / High Potential
//   score > 0.50 × profileScore        → Possible Next
//   score ≤ 0.50 × profileScore        → Watchlist

function categoryForCandidate(
  score:        number,
  profileScore: number,
  followers:    number,
  userFollows:  boolean,
): string {
  if (score > profileScore) {
    // Genuinely above the searched profile — highest-confidence prediction.
    return followers >= 200_000 ? "Rare Pick" : "Strong Match";
  }
  if (score > profileScore * 0.75 || userFollows) {
    // Close to profile score, or the user already follows them (strong orbit signal).
    return followers >= 50_000 ? "Near Orbit" : "High Potential";
  }
  if (score > profileScore * 0.50) {
    return "Possible Next";
  }
  return followers >= 10_000 ? "Watchlist" : "Possible Next";
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

function buildReason(
  score:        number,
  profileScore: number,
  followers:    number,
  name:         string,
  userFollows:  boolean,
): string {
  const s = formatScore(score);
  const f = formatFollowers(followers);

  if (userFollows && score > profileScore) {
    // Best case: user follows them AND their score is higher.
    const lines = [
      `You follow ${name} — they haven't followed back yet. Score ${s} · ${f} followers.`,
      `${f} followers · score ${s}. You're already in their orbit — no reciprocation yet.`,
      `Score ${s} · ${f} followers. Direct orbit match: you follow, they don't yet.`,
      `High-priority. You follow them — score ${s} places them above your current network.`,
    ];
    return lines[Math.abs(Math.round(score)) % lines.length];
  }

  if (userFollows) {
    // User follows them but their score is below profileScore (still a strong signal).
    const lines = [
      `You follow ${name} — they haven't followed back yet. ${f} followers · score ${s}.`,
      `${f} followers · score ${s}. You're already in their orbit — awaiting reciprocation.`,
      `Score ${s} · ${f} followers. Nearby orbit match — you follow, they don't yet.`,
    ];
    return lines[Math.abs(Math.round(score)) % lines.length];
  }

  if (score > profileScore) {
    // 2nd-hop / extended network, above profile.
    const lines = [
      `Score ${s} · ${f} followers. High-value account in your extended orbit.`,
      `${f} followers · score ${s}. Strong niche alignment — follow-back signal detected.`,
      `${f} followers · score ${s}. In your cluster — follow-back probability is elevated.`,
    ];
    return lines[Math.abs(Math.round(score)) % lines.length];
  }

  if (score > profileScore * 0.75) {
    // Near-orbit: slightly below but in the same range.
    const lines = [
      `Score ${s} · ${f} followers. Near your orbit — close match in network proximity.`,
      `${f} followers · score ${s}. Adjacent niche — elevated mutual follow probability.`,
      `Score ${s}. ${name} is in reach — same niche cluster, no follow-back yet.`,
    ];
    return lines[Math.abs(Math.round(score)) % lines.length];
  }

  // Fallback: below 75 % of profileScore — honest watchlist tone.
  const lines = [
    `Score ${s} · ${f} followers. Best available nearby match in your follow graph.`,
    `${f} followers · score ${s}. Watchlist candidate — active in your niche.`,
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

/**
 * Rough follower-count → Sorsa-score estimate used when the Sorsa API returns
 * 0 (account not yet indexed).  The values are intentionally conservative so
 * estimated accounts never crowd out accounts with real scores.
 * Used ONLY as a fallback when score === 0.
 */
function estimateScoreFromFollowers(followers: number): number {
  if (followers >= 1_000_000) return 2800;
  if (followers >= 500_000)   return 2300;
  if (followers >= 200_000)   return 1900;
  if (followers >= 100_000)   return 1600;
  if (followers >=  50_000)   return 1400;
  if (followers >=  20_000)   return 1200;
  if (followers >=  10_000)   return 1000;
  if (followers >=   5_000)   return  850;
  if (followers >=   1_000)   return  650;
  return 400;
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

    // ── 4. Find non-followbacks (accounts user follows but who haven't followed back) ──
    // These are the primary candidate pool: the user already orbits these accounts,
    // making them the most plausible follow-back predictions.
    const nonFollowbacks: NormalisedAccount[] = following
      .filter((acc) => acc.username.length > 0)
      .filter((acc) => !followsBackSet.has(acc.username.toLowerCase().replace(/^@/, "")))
      .map((acc) => ({ ...acc, userFollows: true })); // mark: user already follows them

    console.log(`  Total non-followbacks  : ${nonFollowbacks.length}`);
    console.log(`  (following ${following.length} - ${following.length - nonFollowbacks.length} mutual = ${nonFollowbacks.length} candidates)`);

    // ── 4b. 2nd-hop expansion: fetch follows of the top non-followback accounts ──
    // Expands the candidate pool to include accounts that are connected to
    // accounts the user follows but whom the user doesn't follow directly yet.
    // These are in the same niche cluster and often have high Sorsa scores.
    const TOP_N_2ND_HOP = 12;
    const searchedUserLow = username.toLowerCase().replace(/^@/, "");
    const followingUsernameSet = new Set(following.map((u) => u.username.toLowerCase().replace(/^@/, "")));
    const topForSecondHop = [...nonFollowbacks]
      .sort((a, b) => b.followers - a.followers)
      .slice(0, TOP_N_2ND_HOP);

    console.log(`\n[scan] ── 2nd-hop expansion: fetching follows of top ${topForSecondHop.length} non-followbacks…`);

    const secondHopResults = await Promise.allSettled(
      topForSecondHop.map((acc) => sorsaFetch(`/follows?username=${encodeURIComponent(acc.username)}`))
    );

    const secondHopSeen  = new Set<string>();
    const secondHopAccounts: NormalisedAccount[] = [];

    for (const result of secondHopResults) {
      if (result.status !== "fulfilled") continue;
      const accounts = extractList(result.value);
      for (const acc of accounts) {
        const uLow = acc.username.toLowerCase().replace(/^@/, "");
        if (!uLow || uLow === searchedUserLow) continue;       // skip self
        if (followsBackSet.has(uLow))         continue;       // already follows back → exclude
        if (followingUsernameSet.has(uLow))   continue;       // already in primary pool → skip
        if (secondHopSeen.has(uLow))          continue;       // de-duplicate
        secondHopSeen.add(uLow);
        secondHopAccounts.push({ ...acc, userFollows: false }); // 2nd-hop: user doesn't follow yet
      }
    }

    console.log(`  2nd-hop new candidates : ${secondHopAccounts.length}`);

    // ── 5. Pre-filter candidates (5-tier relevance filter) then sort ──────────
    // Combine primary (already-followed) and 2nd-hop candidates.
    // Sort by followers desc so we score the most prominent accounts first —
    // they are most likely to have a Sorsa score and to beat profileScore.
    const base = Math.max(profileScore, 800);
    const combinedPool = [...nonFollowbacks, ...secondHopAccounts];
    const candidateList = combinedPool
      .filter((acc) => !isFiltered(acc.name, acc.username, acc.followers))
      .sort((a, b) => b.followers - a.followers);

    const excludedCount = combinedPool.length - candidateList.length;
    console.log(`  Excluded by relevance filter   : ${excludedCount}`);
    console.log(`  Human candidates remaining     : ${candidateList.length} (${nonFollowbacks.length} primary + ${secondHopAccounts.length} 2nd-hop, minus ${excludedCount} filtered)`);

    // ── 6. Multi-round scoring: keep expanding until 5 results are found ──────
    //
    // Round 1 : score top 1 500 human candidates by followers count.
    // Round 2 : score the next 1 500 if < 5 found after round 1.
    // Round 3 : score the next 1 500 (up to 4 500 total) as a last resort.
    //
    // Each round appends to allScored and re-runs fillSlots() on the full
    // cumulative pool (Pass A slot-fill → Pass B greedy → Pass C last-resort).
    // The loading screen stays up naturally while rounds 2–3 execute.

    const ROUND_SIZE = 1500;
    const MAX_ROUNDS = 3;

    let allScored:    NormalisedAccount[] = [];
    let filtered:     ScoredAccount[]     = [];
    let totalNonZero  = 0;
    let totalEstimated = 0;
    let exhausted     = false;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const batch = candidateList.slice(round * ROUND_SIZE, (round + 1) * ROUND_SIZE);
      if (batch.length === 0) { exhausted = true; break; }

      console.log(`\n[scan] Round ${round + 1}: scoring ${batch.length} candidates (offset ${round * ROUND_SIZE})…`);

      const batchScores = await Promise.all(batch.map((acc) => fetchScore(acc.username)));

      // For accounts with score=0 (not in Sorsa DB), use a follower-based estimate
      // so they aren't silently dropped by the score>0 gate.  Estimated scores are
      // intentionally conservative and flagged with scoreEstimated=true.
      const batchScored = batch.map((acc, i) => {
        const realScore = batchScores[i];
        if (realScore > 0) return { ...acc, score: realScore };
        const est = estimateScoreFromFollowers(acc.followers);
        return { ...acc, score: est, scoreEstimated: true };
      });

      allScored     = [...allScored, ...batchScored];
      totalNonZero  = allScored.filter((c) => c.score > 0 && !c.scoreEstimated).length;
      totalEstimated = allScored.filter((c) => c.scoreEstimated).length;

      // ── Per-stage debug counts ────────────────────────────────────────────────
      const afterScoreGate = allScored.filter((c) => c.score > profileScore);
      console.log(`  After round ${round + 1}:`);
      console.log(`    Real scores (non-zero) : ${totalNonZero}`);
      console.log(`    Estimated scores       : ${totalEstimated}`);
      console.log(`    Passing score gate     : ${afterScoreGate.length}  (score > ${profileScore})`);
      console.log(`    Already-followed in pool: ${afterScoreGate.filter((c) => c.userFollows).length}`);

      filtered = fillSlots(allScored, base, profileScore);
      console.log(`    fillSlots result       : ${filtered.length} candidate(s)`);

      if (filtered.length >= 5) break;
      if (round < MAX_ROUNDS - 1) {
        console.log(`  < 5 results — expanding to round ${round + 2}…`);
      }
    }

    // ── 6b. Pass D: reverse-follow fallback ───────────────────────────────────
    // Triggered when the primary follow-graph pool yielded < 5 results.
    // Looks at accounts that FOLLOW the searched user but haven't been followed
    // back yet — "influential fans."  Uses the same progressive-relaxation
    // approach as fillSlots (no hard score > profileScore gate) so sparse
    // networks (like @zaimiri) still surface meaningful candidates.
    let fallbackUsed  = false;
    let emergencyUsed = false;

    if (filtered.length < 5 && followers.length > 0) {
      fallbackUsed = true;
      console.log(`\n[scan] ── Pass D (reverse-follow fallback): ${5 - filtered.length} slot(s) still needed…`);

      const alreadyUsed  = new Set(filtered.map((c) => c.username.toLowerCase()));
      const followingSet = new Set(following.map((u) => u.username.toLowerCase().replace(/^@/, "")));
      const FOLLOW_BOOST_D = 200;

      // Followers the user hasn't followed back — sorted by followers desc
      // so we score the most prominent fans first (better Sorsa coverage).
      const reverseCandidates = followers
        .filter((acc) => acc.username.length > 0)
        .filter((acc) => !followingSet.has(acc.username.toLowerCase().replace(/^@/, "")))
        .filter((acc) => !alreadyUsed.has(acc.username.toLowerCase()))
        .filter((acc) => !isFiltered(acc.name, acc.username, acc.followers))
        .sort((a, b) => b.followers - a.followers)
        .slice(0, 300);

      console.log(`  Reverse candidates (followers not followed back): ${reverseCandidates.length}`);

      if (reverseCandidates.length > 0) {
        const reverseRaw    = await Promise.all(reverseCandidates.map((acc) => fetchScore(acc.username)));
        // Apply follower-based estimate when Sorsa returns 0
        const reverseScored = reverseCandidates.map((acc, i) => {
          const real = reverseRaw[i];
          if (real > 0) return { ...acc, score: real, userFollows: false };
          return { ...acc, score: estimateScoreFromFollowers(acc.followers), scoreEstimated: true, userFollows: false };
        });

        // Sort by effective score desc; no hard gate — use same progressive
        // floors as fillSlots so we always fill slots when candidates exist.
        const effD = (c: NormalisedAccount) => c.score + (c.userFollows ? FOLLOW_BOOST_D : 0);
        const floors = [profileScore, profileScore * 0.80, profileScore * 0.60, profileScore * 0.40, 0];
        for (const floor of floors) {
          if (filtered.length >= 5) break;
          const needed = 5 - filtered.length;
          const valid = reverseScored
            .filter(isValid)
            .filter((c) => c.score > 0)
            .filter((c) => effD(c) > floor)
            .filter((c) => !alreadyUsed.has(c.username.toLowerCase()))
            .sort((a, b) => effD(b) - effD(a))
            .slice(0, needed);

          for (const c of valid) {
            const tier: Tier = c.score > profileScore ? 1 : (c.score > profileScore * 0.75 ? 2 : 3);
            filtered.push({ ...c, tier });
            alreadyUsed.add(c.username.toLowerCase());
          }
        }

        console.log(`  Pass D added: ${filtered.length - (5 - (5 - filtered.length))} new candidate(s) (total now: ${filtered.length})`);
      }
    }

    // ── 6c. Emergency fallback ────────────────────────────────────────────────
    // Still < 5 after all primary + reverse-follow passes.
    // Re-scores the top 200 candidates from all available pools with the same
    // progressive relaxation — no hard score gate.
    if (filtered.length < 5) {
      emergencyUsed = true;
      console.log(`\n[scan] ── Emergency fallback: ${5 - filtered.length} slot(s) still empty…`);

      const alreadyUsed = new Set(filtered.map((c) => c.username.toLowerCase()));
      const emergencyPool = [...candidateList, ...followers]
        .filter((acc) => acc.username.length > 0)
        .filter((acc) => !followsBackSet.has(acc.username.toLowerCase().replace(/^@/, "")))
        .filter((acc) => !alreadyUsed.has(acc.username.toLowerCase().replace(/^@/, "")))
        .filter((acc) => !isFiltered(acc.name, acc.username, acc.followers))
        .sort((a, b) => b.followers - a.followers)
        .slice(0, 200);

      const emergencyRaw    = await Promise.all(emergencyPool.map((acc) => fetchScore(acc.username)));
      const emergencyScored = emergencyPool.map((acc, i) => {
        const real = emergencyRaw[i];
        const score = real > 0 ? real : estimateScoreFromFollowers(acc.followers);
        return { ...acc, score, scoreEstimated: real === 0 };
      });

      const floors = [profileScore, profileScore * 0.80, profileScore * 0.60, 0];
      for (const floor of floors) {
        if (filtered.length >= 5) break;
        const needed = 5 - filtered.length;
        const valid = emergencyScored
          .filter(isValid)
          .filter((c) => c.score > 0)
          .filter((c) => c.score > floor)
          .filter((c) => !alreadyUsed.has(c.username.toLowerCase()))
          .sort((a, b) => b.score - a.score)
          .slice(0, needed);

        for (const c of valid) {
          const tier: Tier = c.score > profileScore ? 1 : (c.score > profileScore * 0.75 ? 2 : 3);
          filtered.push({ ...c, tier });
          alreadyUsed.add(c.username.toLowerCase());
        }
      }
      console.log(`  Emergency fallback total now: ${filtered.length}`);
    }

    if (!exhausted && filtered.length < 5) exhausted = true;

    // ── 7. Debug summary ──────────────────────────────────────────────────────
    const seenLog  = new Set<string>();
    const minEl    = profileScore >= 2000 ? profileScore : profileScore + 1;
    const eligibleCount = allScored
      .filter(isValid)
      .filter((c) => c.score > 0)
      .filter((c) => c.score >= 800)
      .filter((c) => c.score >= minEl)
      .filter((c) => {
        const k = c.username.toLowerCase();
        if (seenLog.has(k)) return false;
        seenLog.add(k);
        return true;
      }).length;

    const tierCounts = { 1: 0, 2: 0, 3: 0 };
    filtered.forEach((c) => tierCounts[c.tier]++);

    console.log(`\n[scan] ════ FINAL SUMMARY ════`);
    console.log(`  Searched username              : @${username}`);
    console.log(`  Searched profile score         : ${profileScore}  (base=${base})`);
    console.log(`  Total following                : ${following.length}`);
    console.log(`  Total followers                : ${followers.length}`);
    console.log(`  Total non-followbacks (primary): ${nonFollowbacks.length}`);
    console.log(`  2nd-hop expansion accounts     : ${secondHopAccounts.length}`);
    console.log(`  Excluded by relevance filter   : ${excludedCount}`);
    console.log(`  Human candidates remaining     : ${candidateList.length}`);
    console.log(`  Total candidates scored        : ${allScored.length} (${totalNonZero} non-zero)`);
    console.log(`  Eligible (primary floor)       : ${eligibleCount}`);
    console.log(`  Exhausted pool                 : ${exhausted}`);
    console.log(`  Fallback Pass D used           : ${fallbackUsed}`);
    console.log(`  Emergency fallback used        : ${emergencyUsed}`);
    console.log(`  Tier 1: ${tierCounts[1]}  Tier 2: ${tierCounts[2]}  Tier 3: ${tierCounts[3]}`);
    console.log(`\n[scan] FINAL RESULTS (${filtered.length}):`);
    filtered.forEach((c, i) => {
      const gap    = Math.round(c.score - profileScore);
      const origin = c.userFollows ? "primary(follows)" : "2nd-hop";
      console.log(`  ${i + 1}. @${c.username.padEnd(24)} score=${Math.round(c.score).toString().padStart(6)}  gap=+${gap}  tier=${c.tier}  [${origin}]`);
    });
    console.log(`  Returned: ${filtered.map((c) => `@${c.username}`).join(", ")}`);
    console.log(`${"═".repeat(60)}\n`);

    // ── 9b. FINAL VALIDATION GATE ────────────────────────────────────────────────
    // Hard rules that can never be relaxed:
    //   1. Non-empty username
    //   2. Score > 0  (zero = no data at all; estimated scores are already > 0)
    //   3. Not already following back
    //   4. Not blacklisted
    //   5. Unique
    //
    // NOTE: score > profileScore is NOT enforced here.  Progressive relaxation in
    // fillSlots already handles ordering — the top candidates are shown regardless
    // of whether they beat profileScore exactly.  Rejecting them here would produce
    // blank cards, which is worse than showing the best available match.
    console.log(`\n[scan] ── FINAL VALIDATION GATE (${filtered.length} candidates) ──`);
    console.log(`  Searched username : @${username}`);
    console.log(`  Searched score   : ${profileScore}`);
    console.log(`  Follower set size: ${followsBackSet.size}`);

    const finalSeen = new Set<string>();
    const validated = filtered.filter((c) => {
      const key = c.username.toLowerCase().replace(/^@/, "");

      if (!c.username || key.length === 0) {
        console.log(`  REJECT @${c.username || "?"}: empty username`);
        return false;
      }
      if (finalSeen.has(key)) {
        console.log(`  REJECT @${key}: duplicate`);
        return false;
      }
      if (c.score <= 0) {
        console.log(`  REJECT @${key}: score is 0 (no data)`);
        return false;
      }
      if (followsBackSet.has(key)) {
        console.log(`  REJECT @${key}: already follows back`);
        return false;
      }
      if (isFiltered(c.name, key, c.followers)) {
        console.log(`  REJECT @${key}: brand/org filter`);
        return false;
      }

      finalSeen.add(key);
      const aboveProfile = c.score > profileScore ? "✓above" : `↓${Math.round(profileScore - c.score)}below`;
      console.log(`  PASS   @${key}: score=${Math.round(c.score)}${c.scoreEstimated ? "(est)" : ""} [${aboveProfile}] follows=${c.userFollows}`);
      return true;
    });

    console.log(`  Gate result: ${validated.length} / ${filtered.length} passed`);

    // ── Build debug info (returned in every response for diagnostics) ─────────
    const afterScoreFilter = allScored.filter((c) => c.score > profileScore);
    // Which accounts did the brand/org filter drop?
    const brandFiltered = combinedPool
      .filter((acc) => isFiltered(acc.name, acc.username, acc.followers))
      .map((acc) => ({ u: acc.username, name: acc.name, followers: acc.followers }));

    // Top 20 candidates by effectiveScore before slicing to 5
    const FOLLOW_BOOST_DBG = 200;
    const effScoreDbg = (c: NormalisedAccount) => c.score + (c.userFollows ? FOLLOW_BOOST_DBG : 0);
    const top20 = [...allScored]
      .filter(isValid)
      .filter((c) => c.score > 0)
      .filter((c) => !followsBackSet.has(c.username.toLowerCase()))
      .sort((a, b) => effScoreDbg(b) - effScoreDbg(a))
      .slice(0, 20)
      .map((c) => ({
        u:         c.username,
        score:     Math.round(c.score),
        effScore:  Math.round(effScoreDbg(c)),
        estimated: !!c.scoreEstimated,
        follows:   c.userFollows,
        aboveProfile: c.score > profileScore,
      }));

    const debugInfo = {
      profileScore:            Math.round(profileScore),
      followingApiCount:       following.length,
      followersApiCount:       followers.length,
      followedByUserCount:     nonFollowbacks.length,
      secondHopCount:          secondHopAccounts.length,
      totalCandidatePool:      candidateList.length,
      afterScoreFilter:        afterScoreFilter.length,
      afterScoreFilterFollows: afterScoreFilter.filter((c) => c.userFollows).length,
      realScores:              allScored.filter((c) => c.score > 0 && !c.scoreEstimated).length,
      estimatedScores:         allScored.filter((c) => c.scoreEstimated).length,
      brandFilteredCount:      brandFiltered.length,
      brandFilteredAccounts:   brandFiltered,
      finalCandidateUsernames: validated.map((c) => `@${c.username}`),
      top20BeforeSlice:        top20,
    };

    console.log(`\n[scan] DEBUG INFO:`);
    console.log(JSON.stringify(debugInfo, null, 2));

    // ── 10. Empty state ───────────────────────────────────────────────────────
    if (validated.length === 0) {
      // Distinguish between "no graph data" and "graph exists but no matches"
      const hasGraphData = following.length > 0 || followers.length > 0;
      const emptyMessage = !hasGraphData && profileScore > 0
        ? "Follow network not indexed yet — Sorsa has your score but no follow graph data. Try again in a few hours."
        : "No follow-back candidates found in your current network.";

      return NextResponse.json({
        predictions: [],
        exhausted: true,
        message: emptyMessage,
        debug: debugInfo,
      });
    }

    // Use validated list from here on
    const finalFiltered = validated;

    // ── 11. Build PredictedAccount array ─────────────────────────────────────
    const [wildcard, ...corners] = finalFiltered;
    const ordered = [...corners, wildcard];
    const maxScore = wildcard.score || 1;

    console.log(`\n[scan] RETURNING ${finalFiltered.length} accounts:`);
    finalFiltered.forEach((c, i) => {
      console.log(`  ${i + 1}. @${c.username}  score=${Math.round(c.score)}${c.scoreEstimated ? " (est)" : ""}  follows=${c.userFollows}`);
    });

    // matchPercent: 100 = equal to or above profileScore; scales linearly below.
    // Capped at 100 so accounts above profileScore all show 100 % (strong match).
    const matchRef = Math.max(profileScore, 1);

    const predictions: PredictedAccount[] = ordered.map((entry, i) => {
      const isWild = i === ordered.length - 1;
      return {
        id: i + 1,
        name: entry.name,
        username: `@${entry.username}`,
        avatar: entry.avatar,
        followers: entry.followers,
        category: categoryForCandidate(entry.score, profileScore, entry.followers, entry.userFollows),
        score: entry.score,
        matchPercent: Math.min(100, Math.round((entry.score / matchRef) * 100)),
        reason: buildReason(entry.score, profileScore, entry.followers, entry.name, entry.userFollows),
        isWildcard: isWild,
        position: isWild ? "bottom-center" : (POSITIONS[i] ?? "bottom-center"),
      };
    });

    return NextResponse.json({ predictions, exhausted, debug: debugInfo });
  } catch (err) {
    console.error("[/api/scan] fatal error:", err);
    return NextResponse.json(
      { predictions: [], exhausted: true, message: "No stronger non-followback matches found", error: String(err) },
      { status: 500 },
    );
  }
}
