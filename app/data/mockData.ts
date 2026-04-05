import type { PredictedAccount } from "../types";

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Linear congruential step — fast deterministic PRNG
function lcg(seed: number): number {
  return Math.abs((Math.imul(seed, 1664525) + 1013904223) | 0);
}

type PoolEntry = {
  name: string;
  username: string;
  avatarImg: number;
  followers: number;
  category: string;
  categoryKey: string;
};

// 18 accounts across varied niches — username hash picks 5 each run
const POOL: PoolEntry[] = [
  { name: "Kaito Nakamura",  username: "@kaitonakamura",  avatarImg: 33,  followers: 284000,   category: "AI Research",     categoryKey: "ai"       },
  { name: "Priya Mehta",     username: "@priyamehta_x",   avatarImg: 47,  followers: 156000,   category: "Startup Founder", categoryKey: "startup"  },
  { name: "Marcus Webb",     username: "@marcuswebb",     avatarImg: 52,  followers: 412000,   category: "Tech Investor",   categoryKey: "investor" },
  { name: "Sofia Laurent",   username: "@sofialaurent",   avatarImg: 29,  followers: 98700,    category: "Product Design",  categoryKey: "design"   },
  { name: "Elijah Crane",    username: "@elijahcrane",    avatarImg: 68,  followers: 2100000,  category: "Viral Creator",   categoryKey: "creator"  },
  { name: "Dev Sharma",      username: "@devsharma_ai",   avatarImg: 15,  followers: 67400,    category: "AI Engineer",     categoryKey: "ai"       },
  { name: "Lena Fischer",    username: "@lenafischer",    avatarImg: 44,  followers: 143000,   category: "Open Source",     categoryKey: "oss"      },
  { name: "Carlos Ramos",    username: "@carlosramos",    avatarImg: 7,   followers: 89200,    category: "DeFi Builder",    categoryKey: "crypto"   },
  { name: "Zara Moon",       username: "@zaramoon",       avatarImg: 55,  followers: 312000,   category: "NFT Artist",      categoryKey: "crypto"   },
  { name: "Yuki Tanaka",     username: "@yukitanaka_ml",  avatarImg: 9,   followers: 234000,   category: "ML Researcher",   categoryKey: "ai"       },
  { name: "Mia Chen",        username: "@miachen_design", avatarImg: 22,  followers: 178000,   category: "Design Lead",     categoryKey: "design"   },
  { name: "Felix Wagner",    username: "@felixwagner",    avatarImg: 64,  followers: 52300,    category: "Indie Hacker",    categoryKey: "startup"  },
  { name: "Jordan Miles",    username: "@jordanmiles",    avatarImg: 12,  followers: 891000,   category: "Tech Journalist", categoryKey: "media"    },
  { name: "Aria Patel",      username: "@ariapatel_vc",   avatarImg: 38,  followers: 267000,   category: "VC Partner",      categoryKey: "investor" },
  { name: "Niko Petrov",     username: "@nikopetrov",     avatarImg: 71,  followers: 445000,   category: "Crypto Native",   categoryKey: "crypto"   },
  { name: "Oliver Stone",    username: "@oliverstone_x",  avatarImg: 5,   followers: 183000,   category: "Angel Investor",  categoryKey: "investor" },
  { name: "Nina Schulz",     username: "@ninaschulz",     avatarImg: 19,  followers: 71600,    category: "Growth Hacker",   categoryKey: "startup"  },
  { name: "Ravi Kapoor",     username: "@ravikapoor",     avatarImg: 42,  followers: 1400000,  category: "Creator Economy", categoryKey: "creator"  },
];

// Per-category reason templates — {n} is filled with a seeded number
const REASONS: Record<string, string[]> = {
  ai: [
    "Follows {n} accounts in your orbit. Deeply engaged with AI model developments.",
    "Shared {n} threads your network amplified. Strong focus on LLMs and agent research.",
    "Engages daily with AI startup content. {n} mutual connections in shared circles.",
    "Posted about your niche {n} times this week. High signal overlap in AI discourse.",
  ],
  startup: [
    "Retweeted {n} accounts you both follow. Heavily active in VC and product circles.",
    "{n} mutual followers in the founder community. Consistent engagement with build-in-public content.",
    "High overlap in startup and PMF discussions. Follows {n} accounts in your close network.",
    "Active in the same founder communities. {n} shared connections across the network.",
  ],
  investor: [
    "Actively scanning your niche for new investments. {n} overlapping network contacts.",
    "Posted about your sector {n} times recently. Strong match with early-stage tech thesis.",
    "Follows {n} founders in your extended orbit. Frequently engages with content you amplify.",
    "{n} shared connections in VC circles. Alignment with portfolio interests detected.",
  ],
  design: [
    "Shares {n} mutual followers. Engages deeply with AI-product intersection threads.",
    "Consistently reacts to design-meets-tech content. {n} overlapping accounts in common.",
    "Active in product communities you intersect with. {n} mutual network signals detected.",
    "Strong visual content engagement pattern. {n} shared followers across design circles.",
  ],
  crypto: [
    "Follows {n} builders in your ecosystem. High overlap in on-chain activity signals.",
    "{n} shared connections in DeFi and NFT spaces. Engages with content in your niche.",
    "Recently pivoted focus toward your sector. {n} mutual accounts signal strong alignment.",
    "Active across {n} communities you participate in. Strong crypto-native network fit.",
  ],
  oss: [
    "Contributes to {n} repos your network stars. High engagement with open-source content.",
    "{n} shared GitHub connections. Frequently amplifies developer content in your niche.",
    "Follows {n} maintainers in your orbit. Strong signal from open-source community overlap.",
    "Active in the same developer circles. {n} mutual connections across OSS communities.",
  ],
  media: [
    "Covers your exact niche. {n} accounts you follow were recently featured in their threads.",
    "High amplification history with {n} pieces of content your network engaged.",
    "{n} mutual connections in tech journalism. Frequently writes about your topic area.",
    "Follows key voices you engage with. {n} overlapping signals across media networks.",
  ],
  creator: [
    "Outlier signal. Recently pivoted to your content niche. {n}.1M followers. High upside.",
    "Massive reach with strong niche alignment. Follows {n} creators in your immediate orbit.",
    "Engagement spike in your topic area. {n} overlapping audience signals detected.",
    "Cross-category wildcard. {n}00K shared audience members. Rare but high-value match.",
  ],
};

const POSITIONS: PredictedAccount["position"][] = [
  "top-left", "top-right", "lower-left", "lower-right", "bottom-center",
];

/**
 * Generate 5 deterministic predicted accounts for a given username.
 * Same username always returns the same result; different usernames return different sets.
 */
export function generatePredictions(username: string): PredictedAccount[] {
  const h = hash(username);

  // Pick 5 unique accounts by shuffling pool with LCG seeding
  const pool = [...POOL];
  const picked: PoolEntry[] = [];
  let seed = h;

  for (let i = 0; i < 5; i++) {
    seed = lcg(seed);
    const idx = seed % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }

  // Wildcard = highest follower count among the 5
  const wildcardIdx = picked.reduce(
    (best, acc, i) => (acc.followers > picked[best].followers ? i : best),
    0,
  );

  // Base match score: 88–96, each subsequent card drops by a seeded step
  const baseMatch = 88 + (h % 9);
  const drops = [0, 3, 6, 9, 14];

  return picked.map((entry, i) => {
    const s = hash(username + String(i));
    const matchPercent = Math.max(72, baseMatch - drops[i] - (s % 4));

    const reasons = REASONS[entry.categoryKey] ?? REASONS.startup;
    const template = reasons[s % reasons.length];
    const n = 3 + (s % 9); // plausible number: 3–11
    const reason = template.replace(/\{n\}/g, String(n));

    return {
      id: i + 1,
      name: entry.name,
      username: entry.username,
      avatar: `https://i.pravatar.cc/150?img=${entry.avatarImg}`,
      followers: entry.followers,
      category: entry.category,
      matchPercent,
      reason,
      isWildcard: i === wildcardIdx,
      position: POSITIONS[i],
    };
  });
}
