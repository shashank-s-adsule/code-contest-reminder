/**
 * LeetCode Contest Fetcher
 * Uses LeetCode's own (undocumented but stable) GraphQL endpoint —
 * the same one leetcode.com/contest/ itself calls.
 */
import { fetchWithTimeout } from "./fetchWithTimeout.js";

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";
const QUERY = `query { allContests { title titleSlug startTime duration } }`;

/**
 * Fetches upcoming LeetCode contests.
 * Throws on failure — the caller (background worker) decides how to degrade.
 * @returns {Promise<Contest[]>}
 */
export async function fetchLeetCodeContests() {
  const res = await fetchWithTimeout(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY }),
  });
  const { data } = await res.json();
  if (!data?.allContests) throw new Error("LeetCode API error");

  const now = Date.now();

  return data.allContests
    .filter((c) => c.startTime * 1000 > now)
    .map((c) => ({
      id: `leetcode-${c.titleSlug}`,
      platform: "LeetCode",
      name: c.title,
      startTime: new Date(c.startTime * 1000).toISOString(),
      durationMinutes: Math.floor(c.duration / 60),
      url: `https://leetcode.com/contest/${c.titleSlug}/`,
      registerUrl: `https://leetcode.com/contest/${c.titleSlug}/`,
      type: c.title.includes("Biweekly") ? "Biweekly"
          : c.title.includes("Weekly") ? "Weekly"
          : "Other",
      msUntilStart: c.startTime * 1000 - now,
    }))
    .sort((a, b) => a.msUntilStart - b.msUntilStart);
}
