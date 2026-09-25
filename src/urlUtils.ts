// Turn an href into an absolute URL using the page it was found on.
// Returns null for invalid or non-http(s) hrefs (mailto:, javascript:, empty).
function resolveUrl({
  href,
  baseUrl,
}: {
  href: string;
  baseUrl: string;
}): string | null {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

// Normalize URL
function normalize(url: string): string {
  const urlObj = new URL(url);
  urlObj.hash = "";
  return urlObj.toString();
}

// Identity of a page for dedupe. Scheme is ignored so http:// and https://
// versions of the same URL count as one page.
function pageKey(url: string): string {
  const urlObj = new URL(normalize(url));
  return `${urlObj.host}${urlObj.pathname}${urlObj.search}`;
}

// Check if URL is on the same domain
function isSameHost({
  url,
  baseUrl,
}: {
  url: string;
  baseUrl: string;
}): boolean {
  const urlHostname = new URL(url).hostname;
  const baseUrlHostname = new URL(baseUrl).hostname;
  return urlHostname === baseUrlHostname;
}

export { resolveUrl, normalize, pageKey, isSameHost };
