/**
 * AtCoder Contest Fetcher
 * AtCoder has no public JSON API for upcoming contests (the well-known
 * kenkoooo.com/AtCoder-Problems mirror only tracks contests once they've
 * started, since it's built from problem archives). So this parses the
 * "Upcoming Contests" table straight off atcoder.jp/contests/ itself.
 *
 * This is HTML scraping, not an API — it's fragile by nature. If AtCoder
 * changes this table's markup, fetchAtCoderContests() will throw (missing
 * "Upcoming Contests" heading) and the worker falls back to cached data;
 * the row regex below is what needs updating to match the new markup.
 */
import { fetchWithTimeout } from "./fetchWithTimeout.js";

const ATCODER_CONTESTS_PAGE = "https://atcoder.jp/contests/?lang=en";

// Each row: <time class='fixtime fixtime-full'>2026-09-19 21:00:00+0900</time>
// ... <a href="/contests/abc476">Contest Name</a> ... <td class="text-center">01:40</td>
const ROW_RE =
  /<time class='fixtime fixtime-full'>([^<]+)<\/time>[\s\S]*?<a href="\/contests\/([\w-]+)">([^<]+)<\/a>[\s\S]*?<td class="text-center">(\d+):(\d+)<\/td>/g;

function toIsoWithColonOffset(atcoderTimestamp) {
  // "2026-09-19 21:00:00+0900" -> "2026-09-19T21:00:00+09:00"
  return atcoderTimestamp.trim().replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
}

function guessType(contestId) {
  if (contestId.startsWith("abc")) return "Beginner";
  if (contestId.startsWith("arc")) return "Regular";
  if (contestId.startsWith("agc")) return "Grand";
  if (contestId.startsWith("ahc")) return "Heuristic";
  return "Other";
}

/**
 * Fetches upcoming AtCoder contests.
 * Throws on failure — the caller (background worker) decides how to degrade.
 * @returns {Promise<Contest[]>}
 */
export async function fetchAtCoderContests() {
  const res = await fetchWithTimeout(ATCODER_CONTESTS_PAGE);
  const html = await res.text();

  const sectionStart = html.indexOf("Upcoming Contests");
  if (sectionStart === -1) {
    throw new Error("AtCoder page layout changed — 'Upcoming Contests' section not found");
  }
  const sectionEnd = html.indexOf("<h3>", sectionStart + 1);
  const section = html.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd);

  const now = Date.now();
  const contests = [];
  let match;
  while ((match = ROW_RE.exec(section))) {
    const [, rawStart, id, name, hours, minutes] = match;
    const startTime = new Date(toIsoWithColonOffset(rawStart));
    const durationMinutes = parseInt(hours, 10) * 60 + parseInt(minutes, 10);
    const msUntilStart = startTime - now;

    if (msUntilStart > 0) {
      contests.push({
        id: `atcoder-${id}`,
        platform: "AtCoder",
        name,
        startTime: startTime.toISOString(),
        durationMinutes,
        url: `https://atcoder.jp/contests/${id}`,
        registerUrl: `https://atcoder.jp/contests/${id}`,
        type: guessType(id),
        msUntilStart,
      });
    }
  }

  return contests.sort((a, b) => a.msUntilStart - b.msUntilStart);
}
