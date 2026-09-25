import { describe, it, expect } from "vitest";
import { resolveUrl, normalize, pageKey, isSameHost } from "../src/urlUtils.js";

const baseUrl = "https://crawlme.monzo.com/";

describe("urlUtils", () => {
  describe("resolveUrl", () => {
    it("resolves a relative path against the page URL", () => {
      expect(
        resolveUrl({
          href: "/about",
          baseUrl,
        })
      ).toBe("https://crawlme.monzo.com/about");
    });

    it("leaves an absolute URL unchanged", () => {
      expect(
        resolveUrl({
          href: "https://facebook.com/monzo",
          baseUrl,
        })
      ).toBe("https://facebook.com/monzo");
    });

    it("resolves parent-relative paths from a nested page", () => {
      expect(
        resolveUrl({
          href: "../careers",
          baseUrl: "https://crawlme.monzo.com/team/",
        })
      ).toBe("https://crawlme.monzo.com/careers");
    });

    it("returns null for invalid or non-http hrefs", () => {
      expect(
        resolveUrl({
          href: "mailto:help@monzo.com",
          baseUrl,
        })
      ).toBeNull();

      expect(
        resolveUrl({
          href: "javascript:void(0)",
          baseUrl,
        })
      ).toBeNull();

      expect(
        resolveUrl({
          href: "",
          baseUrl,
        })
      ).toBeNull();
    });
  });

  describe("normalize", () => {
    it("should keep the path and query params in the URL and preserve their case", () => {
      expect(
        normalize("https://crawlme.monzo.com/About?test=Yes&Marketing=no")
      ).toBe("https://crawlme.monzo.com/About?test=Yes&Marketing=no");
    });

    it("should remove the fragment from the URL", () => {
      expect(normalize("https://crawlme.monzo.com/about#team")).toBe(
        "https://crawlme.monzo.com/about"
      );
    });

    it("treats /about and /about/ as different paths", () => {
      expect(normalize("https://crawlme.monzo.com/about")).not.toBe(
        normalize("https://crawlme.monzo.com/about/")
      );
    });

    it("treats origin slash and no slash as the same path", () => {
      expect(normalize("https://crawlme.monzo.com")).toBe(
        normalize("https://crawlme.monzo.com/")
      );
    });
  });

  describe("pageKey", () => {
    it("ignores the scheme", () => {
      expect(pageKey("http://crawlme.monzo.com/about")).toBe(
        pageKey("https://crawlme.monzo.com/about")
      );
    });

    it("keeps the query in the key", () => {
      expect(pageKey("https://crawlme.monzo.com/about?x=1")).not.toBe(
        pageKey("https://crawlme.monzo.com/about?x=2")
      );
    });
  });

  describe("isSameHost", () => {
    it("returns true for the same host, ignoring path", () => {
      expect(
        isSameHost({
          url: "https://crawlme.monzo.com/",
          baseUrl,
        })
      ).toBe(true);

      expect(
        isSameHost({
          url: "https://crawlme.monzo.com/about",
          baseUrl,
        })
      ).toBe(true);
    });

    it("returns false for a different host, including sibling subdomains", () => {
      expect(
        isSameHost({
          url: "https://monzo.com/",
          baseUrl,
        })
      ).toBe(false);

      expect(
        isSameHost({
          url: "https://community.monzo.com/",
          baseUrl,
        })
      ).toBe(false);
    });
  });
});
