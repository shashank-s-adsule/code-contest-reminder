/**
 * Data polling for the desktop widget — same logic/shape as
 * extension/background/worker.js's pollAndCache() and pollDailyQuestions(),
 * adapted to the JSON store instead of chrome.storage.
 */
const { fetchCodeforcesContests } = require("./fetchers/codeforces.js");
const { fetchLeetCodeContests } = require("./fetchers/leetcode.js");
const { fetchCodeChefContests } = require("./fetchers/codechef.js");
const { fetchAtCoderContests } = require("./fetchers/atcoder.js");
const { fetchLeetCodeDaily } = require("./fetchers/leetcodeDaily.js");
const { fetchGfgDaily } = require("./fetchers/gfgDaily.js");
const { getStore, updateStore, getSettings } = require("./store.js");

const PLATFORM_ORDER = ["Codeforces", "LeetCode", "CodeChef", "AtCoder"];
const FETCHERS = {
  Codeforces: fetchCodeforcesContests,
  LeetCode: fetchLeetCodeContests,
  CodeChef: fetchCodeChefContests,
  AtCoder: fetchAtCoderContests,
};

async function pollContests() {
  const settings = await getSettings();
  const { platforms } = settings;
  const store = await getStore();
  const prevContests = store.contests || [];

  const results = await Promise.allSettled(
    PLATFORM_ORDER.map((p) => (platforms[p] ? FETCHERS[p]() : Promise.resolve([])))
  );

  const fetchErrors = {};
  const now = Date.now();
  const merged = [];

  results.forEach((result, i) => {
    const platform = PLATFORM_ORDER[i];
    if (!platforms[platform]) return;

    if (result.status === "fulfilled") {
      merged.push(...result.value);
    } else {
      console.error(`[getData] ${platform} fetch failed:`, result.reason);
      fetchErrors[platform] = now;
      merged.push(
        ...prevContests
          .filter((c) => c.platform === platform && new Date(c.startTime) > now)
          .map((c) => ({ ...c, msUntilStart: new Date(c.startTime) - now }))
      );
    }
  });

  merged.sort((a, b) => a.msUntilStart - b.msUntilStart);

  await updateStore({ contests: merged, lastUpdated: now, fetchErrors });
  return { contests: merged, lastUpdated: now, fetchErrors };
}

async function pollDailyQuestions() {
  const [lcResult, gfgResult] = await Promise.allSettled([
    fetchLeetCodeDaily(),
    fetchGfgDaily(),
  ]);

  const store = await getStore();
  const prev = store.dailyQuestions || {};
  const dailyQuestions = {};
  const dailyErrors = {};
  const now = Date.now();

  for (const [platform, result] of [["LeetCode", lcResult], ["GeeksforGeeks", gfgResult]]) {
    if (result.status === "fulfilled") {
      dailyQuestions[platform] = result.value;
    } else {
      console.error(`[getData] ${platform} daily fetch failed:`, result.reason);
      dailyErrors[platform] = now;
      if (prev[platform]) dailyQuestions[platform] = prev[platform];
    }
  }

  await updateStore({ dailyQuestions, dailyErrors });
  return { dailyQuestions, dailyErrors };
}

async function pollAll() {
  const [contestsResult, dailyResult] = await Promise.all([pollContests(), pollDailyQuestions()]);
  return { ...contestsResult, ...dailyResult };
}

module.exports = { pollContests, pollDailyQuestions, pollAll };
