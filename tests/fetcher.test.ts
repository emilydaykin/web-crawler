import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPage,
  hasStaticExtension,
  isHtmlContentType,
} from "../src/fetcher.js";

const pageUrl = "https://crawlme.monzo.com/about";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hasStaticExtension", () => {
  it("skips obvious static files", () => {
    expect(hasStaticExtension("https://crawlme.monzo.com/guide.pdf")).toBe(
      true
    );
    expect(hasStaticExtension("https://crawlme.monzo.com/logo.PNG")).toBe(true);
  });

  it("does not skip HTML paths", () => {
    expect(hasStaticExtension(pageUrl)).toBe(false);
  });
});

describe("isHtmlContentType", () => {
  it("accepts HTML content types, including charset", () => {
    expect(isHtmlContentType("text/html")).toBe(true);
    expect(isHtmlContentType("text/html; charset=utf-8")).toBe(true);
    expect(isHtmlContentType("application/xhtml+xml")).toBe(true);
  });

  it("rejects non-HTML content types", () => {
    expect(isHtmlContentType("image/png")).toBe(false);
    expect(isHtmlContentType("application/pdf")).toBe(false);
  });
});

describe("fetchPage", () => {
  it("skips static extensions without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchPage("https://crawlme.monzo.com/guide.pdf")
    ).resolves.toEqual({ kind: "skip" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips non-HTML content types", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        url: pageUrl,
        headers: { get: () => "image/png" },
        text: async () => "not html",
      })
    );

    await expect(fetchPage(pageUrl)).resolves.toEqual({ kind: "skip" });
  });

  it("returns an error instead of throwing when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );

    await expect(fetchPage(pageUrl)).resolves.toEqual({
      kind: "error",
      message: "network down",
    });
  });
});
