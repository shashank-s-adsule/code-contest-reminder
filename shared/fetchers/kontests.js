/**
 * Kontests.net API Fetcher
 * Free aggregator API — covers LeetCode, CodeChef, AtCoder and more.
 * Docs: https://kontests.net/api
 *
 * We use this for LC, CodeChef, AtCoder since their native APIs
 * are either private, require auth, or are harder to scrape.
 */

const ENDPOINTS = {
  LeetCode: "https://kontests.net/api/v1/leet_code",
  CodeChef: "https://kontests.net/api/v1/code_chef",
  AtCoder: "https://kontests.net/api/v1/at_coder",
};

/**
 * Normalize a Kontests entry into our common Contest shape.
 */
function normalize(entry, platform) {
  const startTime = new Date(entry.start_time);
  const endTime = new Date(entry.end_time);
  const durationMs = endTime - startTime;
  const now = Date.now();

  return {
    id: `${platform.toLowerCase()}-${btoa(entry.name).slice(0, 8)}`,
    platform,
    name: entry.name,
    startTime: startTime.toISOString(),
    durationMinutes: Math.floor(durationMs / 60000),
    url: entry.url,
    registerUrl: entry.url,
    type: entry.name,                 // Kontests doesn't give type metadata
    msUntilStart: startTime - now,
    inSeconds: entry.in_24_hours === "Yes",
  };
}

/**
 * Fetch contests for a single platform via Kontests.
 * @param {"LeetCode"|"CodeChef"|"AtCoder"} platform
 */
async function fetchPlatform(platform) {
  try {
    const res = await fetch(ENDPOINTS[platform]);
    const data = await res.json();
    const now = Date.now();

    return data
      .filter((c) => new Date(c.start_time) > now) // upcoming only
      .map((c) => normalize(c, platform))
      .sort((a, b) => a.msUntilStart - b.msUntilStart);
  } catch (err) {
    console.error(`[${platform}] Fetch failed:`, err);
    return [];
  }
}

export const fetchLeetCodeContests  = () => fetchPlatform("LeetCode");
export const fetchCodeChefContests  = () => fetchPlatform("CodeChef");
export const fetchAtCoderContests   = () => fetchPlatform("AtCoder");
