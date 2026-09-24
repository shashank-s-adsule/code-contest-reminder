/**
 * GeeksforGeeks Problem of the Day Fetcher
 * Uses the same JSON endpoint the GfG "Problem of the Day" page itself
 * calls — undocumented but public, no key required.
 */
const { fetchWithTimeout } = require("./fetchWithTimeout.js");

const GFG_POTD_API = "https://practiceapi.geeksforgeeks.org/api/vr/problems-of-day/problem/today/";

/**
 * Fetches today's GeeksforGeeks Problem of the Day.
 * Throws on failure — the caller (background worker) decides how to degrade.
 * @returns {Promise<DailyQuestion>}
 */
async function fetchGfgDaily() {
  const res = await fetchWithTimeout(GFG_POTD_API);
  const data = await res.json();
  if (!data?.problem_name) throw new Error("GeeksforGeeks daily API error");

  return {
    platform: "GeeksforGeeks",
    title: data.problem_name,
    difficulty: data.difficulty,
    url: data.problem_url,
    date: (data.date || "").split(" ")[0],
  };
}

module.exports = { fetchGfgDaily };
