// ─────────────────────────────────────────────────────────────────────────────
//  Data access layer — the ONLY file that needs to change when connecting
//  a real API.
//
//  Usage:
//    import { getResults } from "@/lib/getResults";
//    const { profile, predictions } = getResults(username);
//
//  To connect real data:
//    1. Make this function async: async function getResults(...)
//    2. Replace the body with your API call, e.g.:
//         const res = await fetch(`/api/scan/${username}`);
//         return res.json() as ScanResult;
//    3. Update call sites to `await getResults(username)`.
//       The ScanResult shape (types/index.ts) must stay the same.
// ─────────────────────────────────────────────────────────────────────────────

import type { ScanResult } from "../types";
import { generateUserProfile } from "../data/generateProfile";
import { generatePredictions } from "../data/mockData";

/**
 * Returns scan results for a given X username.
 * Currently backed by deterministic mock data.
 */
export function getResults(username: string): ScanResult {
  return {
    profile: generateUserProfile(username),
    predictions: generatePredictions(username),
  };
}
