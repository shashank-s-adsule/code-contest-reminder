/**
 * fetch() with a hard timeout.
 * A hung connection to one contest API shouldn't block the others from
 * ever getting cached (see Promise.allSettled in the background worker).
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
