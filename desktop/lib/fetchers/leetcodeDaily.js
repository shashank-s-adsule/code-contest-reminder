/**
 * LeetCode Daily Challenge Fetcher
 * Same GraphQL endpoint as leetcode.js, different query.
 */
const { fetchWithTimeout } = require("./fetchWithTimeout.js");

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";
const QUERY = `query questionOfToday {
  activeDailyCodingChallengeQuestion {
    date
    link
    question { title difficulty }
  }
}`;

/**
 * Fetches today's LeetCode daily challenge.
 * Throws on failure — the caller (background worker) decides how to degrade.
 * @returns {Promise<DailyQuestion>}
 */
async function fetchLeetCodeDaily() {
  const res = await fetchWithTimeout(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY }),
  });
  const { data } = await res.json();
  const q = data?.activeDailyCodingChallengeQuestion;
  if (!q) throw new Error("LeetCode daily API error");

  return {
    platform: "LeetCode",
    title: q.question.title,
    difficulty: q.question.difficulty,
    url: `https://leetcode.com${q.link}`,
    date: q.date,
  };
}

module.exports = { fetchLeetCodeDaily };
