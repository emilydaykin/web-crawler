# Web Crawler

A small, concurrent web crawler written in TypeScript. Given a starting URL, it visits every page on the same host and prints each page along with the links found on it.

## Table of Contents
1. [Problem statement](#1-problem-statement)
2. [How to run](#2-how-to-run)
3. [Output](#3-output)
4. [Architecture](#4-architecture)
5. [Decisions & trade-offs](#5-decisions--trade-offs)
6. [Assumptions](#6-assumptions)
7. [Tests](#7-tests)
8. [Results](#8-results)
9. [Future improvements](#9-future-improvements)

## 1. Problem statement

> Given a starting URL, the crawler should visit each URL it finds on the same domain. It should print each URL visited, and a list of links found on that page. The crawler should be limited to one subdomain - so when you start with *https://crawlme.monzo.com/*, it would crawl all pages on the crawlme.monzo.com website, but not follow external links, for example to facebook.com, monzo.com or community.monzo.com.

## 2. How to run

Requires Node.js 20 (see `.nvmrc`; run `nvm use` if you use nvm).

```sh
npm install
npm run tests                                            # run the test suite
npm start -- https://crawlme.monzo.com                   # crawl and print to the terminal
npm start -- https://crawlme.monzo.com --concurrency 10  # crawl with 10 concurrent fetches
npm start -- https://crawlme.monzo.com > crawl.txt       # save results to a file
```

## 3. Output

Each visited page is printed, followed by every link found on it, indented. External links are listed but not followed.

```
https://crawlme.monzo.com/
  https://crawlme.monzo.com/about.html
  https://crawlme.monzo.com/blog.html
  https://facebook.com/monzo
```

Progress (`[progress] 1200 visited, 64 queued`, every 100 pages), fetch failures and the final `[done]` summary go to stderr (via `console.error`), so redirecting stdout (`console.log`) to a file gives a clean list of results while progress stays visible in the terminal.

## 4. Architecture

| Module | Responsibility |
|---|---|
| `src/index.ts` | Command-line entry point: parses the start URL and optional `--concurrency`, then starts the crawl with the real fetcher. |
| `src/crawler.ts` | The crawl loop: queue, deduplication, same-host filtering, concurrency and printing. |
| `src/fetcher.ts` | HTTP: follows redirects, skips static files, skips non-HTML when `Content-Type` is set, turns failures into results instead of exceptions. |
| `src/parser.ts` | Extracts `<a href>` links from HTML and resolves them to absolute URLs. |
| `src/urlUtils.ts` | Pure URL helpers: resolving, normalising, same-host check and the page key used for deduplication. |

The crawl is a breadth-first search: shallower pages first, and a spider trap on one path does not starve the rest of the site. URLs are taken from a queue in batches and fetched concurrently (default five; the CLI accepts `--concurrency`, and `crawl({ concurrency })` sets it for tests and other callers). Same-host links that are not already in `seen` are enqueued for later batches, including static paths such as `.pdf` links; those are skipped without a network call when dequeued. It ends when the queue is empty.

Two sets prevent repeated work:

- **`seen`** holds every page key ever queued or reached, so a link is only queued once. Keys are never removed; a fetch error or skip still leaves the URL in `seen`, so it is not retried.
- **`visited`** holds the pages actually printed, keyed by the URL after redirects. **Before fetch:** if `pageKey(dequeuedUrl)` is already in `visited`, skip the fetch (e.g. `/about/` is still queued after `/about-us` redirected there and was printed). **After fetch:** if the post-redirect key is already in `visited`, skip printing — so two different queued URLs that redirect to the same page are only printed once.

## 5. Decisions & trade-offs

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Traversal | BFS queue | DFS | Shallower pages first; a trap on one path does not stall the rest |
| Concurrency | Fixed-size batches | Sequential, or a worker pool | Sequential waits for each fetch before starting the next. The crawler dequeues up to N URLs, fetches them together, then repeats (N defaults to 5). No worker pool, so the batch waits for its slowest fetch. More idle time than a pool, where a finished fetch immediately starts the next URL |
| Fetch | Native `fetch` | axios / node-fetch | Built into Node, so no extra HTTP library to install or maintain. Any throughput win is small next to network wait, but the project stays lighter |
| HTML parsing | cheerio | parse5, htmlparser2, or xml2js | Cheerio sits on parse5/htmlparser2 and adds a jQuery-like API to find `a[href]`. parse5/htmlparser2 give a tree with no convenient queries. xml2js parses XML, not HTML |
| Fetcher | Passed into `crawl` | Hard-coded `fetch` inside the crawler | The crawl loop stays HTTP-free, so it is easy to test and swap. Tests can pass a fake that invents two URLs redirecting to one page, or a dead link, without the network. The same slot can later wrap retries or a delay |
| Failures | Log and continue | Abort the crawl | Dead links and non-2xx responses are normal |
| Dedup key | Treat `http` and `https` as the same page (`#` ignored, query kept) | Treat `http` and `https` as different pages | Same content in practice; without this, the two schemes get crawled separately. The printed URL keeps its real scheme |
| Redirects | Key by the URL the fetch landed on | Key only by the requested URL | `/about` and `/about-us` can both 301 to `/about/`; print once |
| Trailing `/` | Keep `/about` and `/about/` distinct | Always collapse | A server can serve both as 200; a redirect still merges them via the row above |
| Links on a page | Each URL once, first-seen order | Print every `href` | Repeats add nothing to the crawl |

## 6. Assumptions

- **Pages are treated as static HTML.** Cheerio parses the response body and does not run JavaScript, so links injected client-side after load are invisible. Only `<a href>` in that HTML is used — not `<img>`, scripts, or stylesheets.
- **Query strings identify different pages.** `/products?page=1` and `/products?page=2` are crawled separately.
- **Only HTML is parsed.** Non-HTML resources on the seed host are not pages — for example `/logo.png` on `crawlme.monzo.com` is skipped by file extension without a fetch, or dropped after fetch when `Content-Type` is present and not HTML. Paths with obvious static extensions (`.pdf`, `.png`, `.css` etc.) are never fetched. When a response has no `Content-Type` header, the body is still parsed as HTML.
- **`<base href>` is ignored.** Relative links are resolved against the URL of the page that was fetched.
- **A redirect to another host ends that page.** It isn't printed or followed.

## 7. Tests

Run with `npm run tests` (Vitest). Tests are grouped by module:

- **`urlUtils`:** resolving relative and absolute links, fragment removal, the scheme-less page key, and the same-host check (including sibling subdomains).
- **`parser`:** link extraction, external links, invalid hrefs and duplicate links on one page.
- **`fetcher`:** skipping static files, skipping non-HTML when `Content-Type` is set, and returning errors instead of throwing. `fetch` is stubbed, so no network access is needed.
- **`crawler`:** fetching each page once, not following external links, carrying on after errors, redirect deduplication, and treating http and https as one page. These use the injected fake fetcher.

## 8. Results

I tested the crawler (with the default concurrency of 5) on the following sites:

- **crawlme.monzo.com:** 42,011 pages in about 27 minutes, with no errors and no duplicate prints in the output. The count matches the site's structure (1,000 product and 1,000 blog listing pages, 20 items each, plus the top-level pages).
  - with concurrency set to 20, the crawl took about 7 minutes with no errors and no duplicates.
  - with concurrency set to 100, the crawl took about 51 seconds with no errors and no duplicates.
  - with concurrency set to 500, the crawl took about 29 seconds with no errors and no duplicates.
- **quotes.toscrape.com:** 214 pages in about 14 seconds. (Before the http/https and redirect handling, the same crawl made 428 visits.)
- **books.toscrape.com:** 1,195 pages in about 46 seconds, with no errors and no duplicate prints in the output. That is every book page (1,000), the 50 catalogue listing pages, the category pages, and `/` plus `/index.html`.

## 9. Future improvements

> [!NOTE]
> Some of the design already scales well. On the 42,011-page crawl, `seen` / `visited` / `pageKey` gave O(1) dedup with no duplicate prints in the output; the host check never left the seed host; static files and non-HTML responses (when `Content-Type` was set) were skipped instead of downloaded; a failed page did not abort the rest; and the fetcher is a function you can wrap (retries, rate limits) without touching the BFS loop. Bounded concurrency and an iterative queue (not recursion) would scale well too.

The 42,011-page crawl was complete and correct, but 27 minutes is too slow. A crash cannot be resumed, a spider trap would run forever, and the crawler is not polite enough to point at a site we do not own. Here is what I would improve:

* **Speed** 
  * Replace fixed batches with a worker pool so a finished request immediately starts the next URL instead of waiting for the slowest fetch in the batch. That matters most on mixed-latency sites, where one slow page leaves slots idle until the whole batch completes.

* **Reliability** 
  * Add a per-request timeout (`AbortController` — `fetch` has none), and retry timeouts / 5xx / 429 with backoff. 
  * Persist the queue and `seen` set (Redis or a database) so a crash can resume, and stream pages out instead of collecting them in memory.
  * Cap pages, depth or wall-clock time so a calendar-style spider trap cannot run forever.

* **Politeness**
  * Respect `robots.txt`, and send a `User-Agent` with a contact address.
  * Rate-limit: the default of five concurrent requests with no delay was acceptable on the sites I tested (that welcome public crawling!); against a site I do not own I would lower concurrency or add a delay or requests-per-second cap.

* **Correctness at scale** 
  * Treat `<link rel="canonical">` or a body hash as the page identity so that `/` and `/index.html` (or `/tag/love/` and `/tag/love/page/1/`) are not crawled twice when they return the same HTML.
  * Strip tracking query params (`utm_*`, and session ids some sites put in every URL for anonymous visitors) so they don’t look like new pages. `?page=1` vs `?page=2` should still count as different pages.
