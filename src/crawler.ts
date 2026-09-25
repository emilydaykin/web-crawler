import { parse } from "./parser.js";
import { isSameHost, normalize, pageKey } from "./urlUtils.js";
import type { Fetcher } from "./fetcher.js";

// Orchestrates:
// 1. Normalize seed, mark seen, enqueue.
// 2. Fetch in batches of ~5: dequeue → fetch → if HTML and still same host, parse.
// 3. Print visited URL + all found links.
// 4. Enqueue only same-host, not-yet-seen URLs (seen at enqueue time).
// 5. Stop when the queue is empty.
// Dedupe uses pageKey, so http:// and https:// of the same URL are one page.
type Page = { url: string; links: string[] };

const PROGRESS_EVERY = 100;

async function crawl({
  baseUrl,
  fetcher,
  concurrency = 5,
}: {
  baseUrl: string;
  fetcher: Fetcher;
  concurrency?: number;
}): Promise<Page[]> {
  const seed = normalize(baseUrl);
  // Every page key the crawler has ever queued or landed on (so 2 ways it can enter `seen`). Never shrinks, so a page is only queued once.
  const seen = new Set<string>([pageKey(seed)]);
  // Keys of pages actually printed. Two different URLs can redirect to the same page.
  const visited = new Set<string>();
  const queue: string[] = [seed];
  const pages: Page[] = [];

  function enqueue(url: string) {
    const normalizedURL = normalize(url);
    const key = pageKey(normalizedURL);
    if (seen.has(key)) return;
    if (!isSameHost({ url: normalizedURL, baseUrl: seed })) return;
    seen.add(key);
    queue.push(normalizedURL);
  }

  // visit. Fetch.
  // Error → log, stop this URL.
  // Skip → ignore.
  // Redirect left the host → ignore.
  // Redirect landed on a page already visited → ignore.
  // Else parse HTML, print the page and all links (Facebook included), enqueue only same-host ones.
  async function visit(url: string) {
    if (visited.has(pageKey(url))) return;

    const result = await fetcher(url);

    if (result.kind === "error") {
      console.error(`Failed to fetch ${url}: ${result.message}`);
      return;
    }
    if (result.kind === "skip") return;

    const finalUrl = normalize(result.finalUrl);
    if (!isSameHost({ url: finalUrl, baseUrl: seed })) return;

    const finalKey = pageKey(finalUrl);
    if (visited.has(finalKey)) return;
    visited.add(finalKey);
    seen.add(finalKey);

    if (visited.size % PROGRESS_EVERY === 0) {
      console.error(
        `[progress] ${visited.size} visited, ${queue.length} queued`
      );
    }

    const links = parse({ html: result.body, baseUrl: finalUrl });
    pages.push({ url: finalUrl, links });

    console.log(finalUrl);
    for (const link of links) {
      console.log(`  ${link}`);
      enqueue(link);
    }
  }

  // Loop. While the queue isn’t empty: take up to 5 URLs, Promise.all their visits (five network waits at once), then loop. New links land on the queue for the next batch.
  while (queue.length > 0) {
    const batch: string[] = [];
    while (batch.length < concurrency && queue.length > 0) {
      const url = queue.shift();
      if (url) batch.push(url);
    }
    await Promise.all(batch.map((url) => visit(url)));
  }

  console.error(`[done] ${visited.size} visited`);

  return pages;
}

export { crawl };
export type { Page };
export type { Fetcher, FetchResult } from "./fetcher.js";
