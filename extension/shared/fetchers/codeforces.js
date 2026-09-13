/**
 * Codeforces Contest Fetcher
 * Uses the official public API — no key required.
 * Docs: https://codeforces.com/apiHelp/methods#contest.list
 */

import { fetchWithTimeout } from "./fetchWithTimeout.js";

const CF_API = "https://codeforces.com/api/contest.list?gym=false";

/**
 * Fetches upcoming Codeforces contests.
 * Throws on failure — the caller (background worker) decides how to
 * degrade (e.g. falling back to cached data) rather than us hiding it here.
 * @returns {Promise<Contest[]>} normalized contest objects
 */
export async function fetchCodeforcesContests() {
  const res = await fetchWithTimeout(CF_API);
  const data = await res.json();

  if (data.status !== "OK") throw new Error("CF API error");

  const now = Date.now();

  return data.result
    .filter((c) => c.phase === "BEFORE") // only upcoming
    .map((c) => ({
      id: `cf-${c.id}`,
      platform: "Codeforces",
      name: c.name,
      startTime: new Date(c.startTimeSeconds * 1000).toISOString(),
      durationMinutes: Math.floor(c.durationSeconds / 60),
      url: `https://codeforces.com/contest/${c.id}`,
      registerUrl: `https://codeforces.com/contestRegistration/${c.id}`,
      type: c.name.includes("Div. 1") ? "Div 1"
          : c.name.includes("Div. 2") ? "Div 2"
          : c.name.includes("Educational") ? "Educational"
          : c.name.includes("Div. 3") ? "Div 3"
          : "Other",
      msUntilStart: c.startTimeSeconds * 1000 - now,
    }))
    .sort((a, b) => a.msUntilStart - b.msUntilStart);
}
