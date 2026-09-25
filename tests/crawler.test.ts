import { describe, it, expect } from "vitest";
import { crawl, type Fetcher } from "../src/crawler.js";

const baseUrl = "https://crawlme.monzo.com/";

function createFetcher({
  pages,
  failures = {},
  redirects = {},
}: {
  pages: Record<string, string>;
  failures?: Record<string, string>;
  redirects?: Record<string, string>;
}) {
  const fetched: string[] = [];
  const fetcher: Fetcher = async (url) => {
    fetched.push(url);
    if (url in failures) {
      return { kind: "error", message: failures[url] ?? "error" };
    }
    const finalUrl = redirects[url] ?? url;
    const body = pages[finalUrl];
    if (body === undefined) {
      return { kind: "skip" };
    }
    return { kind: "html", finalUrl, body };
  };
  return { fetcher, fetched };
}

describe("crawl", () => {
  it("fetches a URL once even when two pages link to it", async () => {
    const foo = `${baseUrl}foo`;
    const { fetcher, fetched } = createFetcher({
      pages: {
        [baseUrl]: `<a href="/a">A</a><a href="/b">B</a>`,
        [`${baseUrl}a`]: `<a href="/foo">Foo</a>`,
        [`${baseUrl}b`]: `<a href="/foo">Foo</a>`,
        [foo]: `<p>foo</p>`,
      },
    });

    const pages = await crawl({ baseUrl, fetcher });

    expect(fetched.filter((url) => url === foo)).toHaveLength(1);
    expect(pages.filter((page) => page.url === foo)).toHaveLength(1);
  });

  it("prints external links but does not fetch them", async () => {
    const facebook = "https://facebook.com/monzo";
    const { fetcher, fetched } = createFetcher({
      pages: {
        [baseUrl]: `<a href="/about">About</a><a href="${facebook}">Facebook</a>`,
        [`${baseUrl}about`]: `<p>about</p>`,
      },
    });

    const pages = await crawl({ baseUrl, fetcher });

    expect(fetched.some((url) => url.includes("facebook.com"))).toBe(false);
    expect(pages[0]?.links).toContain(facebook);
  });

  it("continues crawling after a fetch error", async () => {
    const { fetcher, fetched } = createFetcher({
      pages: {
        [baseUrl]: `<a href="/ok">Ok</a><a href="/fail">Fail</a>`,
        [`${baseUrl}ok`]: `<p>ok</p>`,
      },
      failures: { [`${baseUrl}fail`]: "boom" },
    });

    const pages = await crawl({ baseUrl, fetcher });

    expect(fetched).toContain(`${baseUrl}fail`);
    expect(fetched).toContain(`${baseUrl}ok`);
    expect(pages.map((page) => page.url)).toContain(`${baseUrl}ok`);
    expect(pages.map((page) => page.url)).not.toContain(`${baseUrl}fail`);
  });

  it("visits a page once when two URLs redirect to it", async () => {
    const target = `${baseUrl}team/`;
    const { fetcher } = createFetcher({
      pages: {
        [baseUrl]: `<a href="/team">Team</a><a href="/people">People</a>`,
        [target]: `<p>team</p>`,
      },
      redirects: {
        [`${baseUrl}team`]: target,
        [`${baseUrl}people`]: target,
      },
    });

    const pages = await crawl({ baseUrl, fetcher });

    expect(pages.filter((page) => page.url === target)).toHaveLength(1);
  });

  it("does not fetch a page that a redirect already reached", async () => {
    const target = `${baseUrl}team/`;
    const { fetcher, fetched } = createFetcher({
      pages: {
        [baseUrl]: `<a href="/team">Team</a>`,
        [target]: `<a href="/team/">Team</a>`,
      },
      redirects: { [`${baseUrl}team`]: target },
    });

    await crawl({ baseUrl, fetcher });

    expect(fetched).not.toContain(target);
  });

  it("treats http and https versions of a URL as the same page", async () => {
    const httpsAbout = `${baseUrl}about`;
    const httpAbout = "http://crawlme.monzo.com/about";
    const { fetcher, fetched } = createFetcher({
      pages: {
        [baseUrl]: `<a href="/about">About</a><a href="${httpAbout}">About</a>`,
        [httpsAbout]: `<p>about</p>`,
        [httpAbout]: `<p>about</p>`,
      },
    });

    const pages = await crawl({ baseUrl, fetcher });

    expect(
      fetched.filter((url) => url === httpsAbout || url === httpAbout)
    ).toHaveLength(1);
    expect(pages.filter((page) => page.url.endsWith("/about"))).toHaveLength(1);
  });
});
