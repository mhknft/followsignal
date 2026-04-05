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
  matchPercent: number; // 0–100
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
