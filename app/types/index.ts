// ─────────────────────────────────────────────
//  Shared domain types for FollowSignal
//
//  When connecting a real API, keep these shapes
//  as the contract between the data layer and UI.
// ─────────────────────────────────────────────

/** The profile being analysed (the scanned account). */
export interface UserProfile {
  name: string;
  username: string; // always includes the leading @
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  orbitScore: number; // 0–100
  verified: boolean;
}

/** One entry in the "predicted followers" constellation. */
export interface PredictedAccount {
  id: number;
  name: string;
  username: string; // always includes the leading @
  avatar: string;
  followers: number;
  category: string;
  matchPercent: number; // 0–100, used for bar width normalisation
  score?: number;       // Raw Sorsa score (displayed instead of matchPercent% when present)
  reason: string;
  isWildcard: boolean;
  /** Layout hint used by ConstellationLayout */
  position: "top-left" | "top-right" | "lower-left" | "lower-right" | "bottom-center";
}

/** Full result returned for one scan. */
export interface ScanResult {
  profile: UserProfile;
  predictions: PredictedAccount[];
}

/**
 * The real profile of the searched user, fetched from Sorsa /info + /score.
 * This is the single source of truth for the center card, loading screen,
 * and share card. Never contains hardcoded or mock values.
 */
export interface SearchedProfile {
  displayName: string;   // real display name or fallback to username
  username: string;      // without @
  avatar: string;        // https URL or empty string
  bio: string;
  followers: number;
  following: number;
  score: number;         // Sorsa score, minimum 800
  verified: boolean;
}
