/**
 * CodeChef Contest Fetcher
 * Uses the same JSON endpoint codechef.com's own contests page calls —
 * undocumented but public, no key required.
 */
const { fetchWithTimeout } = require("./fetchWithTimeout.js");

const CODECHEF_API = "https://www.codechef.com/api/list/contests/all";

function guessDivision(name) {
  const m = name.match(/div\s*([1-4])/i);
  return m ? `Div ${m[1]}` : "Other";
}

/**
 * Fetches upcoming CodeChef contests.
 * Throws on failure — the caller (background worker) decides how to degrade.
 * @returns {Promise<Contest[]>}
 */
async function fetchCodeChefContests() {
  const res = await fetchWithTimeout(CODECHEF_API);
  const data = await res.json();
  if (data.status !== "success") throw new Error("CodeChef API error");

  const now = Date.now();

  return (data.future_contests || [])
    .map((c) => {
      const startTime = new Date(c.contest_start_date_iso);
      return {
        id: `codechef-${c.contest_code}`,
        platform: "CodeChef",
        name: c.contest_name,
        startTime: startTime.toISOString(),
        durationMinutes: parseInt(c.contest_duration, 10) || 0,
        url: `https://www.codechef.com/${c.contest_code}`,
        registerUrl: `https://www.codechef.com/${c.contest_code}`,
        type: guessDivision(c.contest_name),
        msUntilStart: startTime - now,
      };
    })
    .filter((c) => c.msUntilStart > 0)
    .sort((a, b) => a.msUntilStart - b.msUntilStart);
}

module.exports = { fetchCodeChefContests };
