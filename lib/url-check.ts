/**
 * Submission-time URL check (PRD v2.2). If the server cannot reach the host, we still
 * accept https URLs (open item: CDN may block server-side pings).
 */
export async function validateContentUrl(urlString: string): Promise<{ ok: boolean; reason?: string }> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "Must use https://" };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(urlString, {
      method: "HEAD",
      signal: ac.signal,
      redirect: "follow",
    }).catch(async () => {
      return fetch(urlString, { method: "GET", signal: ac.signal, redirect: "follow" });
    });
    clearTimeout(timer);
    if (!res.ok && res.status >= 400) {
      return { ok: false, reason: `URL did not return success (HTTP ${res.status})` };
    }
    return { ok: true };
  } catch {
    clearTimeout(timer);
    return { ok: true };
  }
}
