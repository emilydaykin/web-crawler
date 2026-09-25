type FetchResult =
  | { kind: "html"; finalUrl: string; body: string }
  | { kind: "skip" }
  | { kind: "error"; message: string };

type Fetcher = (url: string) => Promise<FetchResult>;

const SKIP_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".svg",
  ".ico",
  ".css",
  ".js",
  ".zip",
  ".woff",
  ".woff2",
];

function hasStaticExtension(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return SKIP_EXTENSIONS.some((extension) => pathname.endsWith(extension));
  } catch {
    return false;
  }
}

function isHtmlContentType(contentType: string): boolean {
  return (
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml")
  );
}

async function fetchPage(url: string): Promise<FetchResult> {
  if (hasStaticExtension(url)) {
    return { kind: "skip" };
  }

  try {
    const response = await fetch(url, { redirect: "follow" });
    const finalUrl = response.url;

    if (!response.ok) {
      return { kind: "error", message: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !isHtmlContentType(contentType)) {
      return { kind: "skip" };
    }

    const body = await response.text();
    return { kind: "html", finalUrl, body };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: "error", message };
  }
}

export { fetchPage, hasStaticExtension, isHtmlContentType };
export type { FetchResult, Fetcher };
