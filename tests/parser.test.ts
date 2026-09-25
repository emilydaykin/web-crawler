import { describe, it, expect } from "vitest";
import { parse } from "../src/parser.js";

const baseUrl = "https://crawlme.monzo.com/";

describe("parse", () => {
  it("resolves relative hrefs against the page URL", () => {
    const html = `<a href="/about">About</a>`;
    expect(parse({ html, baseUrl })).toEqual([
      "https://crawlme.monzo.com/about",
    ]);
  });

  it("includes external links", () => {
    const html = `<a href="https://facebook.com/monzo">Facebook</a>`;
    expect(parse({ html, baseUrl })).toEqual(["https://facebook.com/monzo"]);
  });

  it("lists each link once, in the order first found", () => {
    const html = `
      <a href="/b">B</a>
      <a href="/a">A</a>
      <a href="https://crawlme.monzo.com/b">B again</a>
    `;
    expect(parse({ html, baseUrl })).toEqual([
      "https://crawlme.monzo.com/b",
      "https://crawlme.monzo.com/a",
    ]);
  });

  it("ignores non-anchor URLs and invalid hrefs", () => {
    const html = `
      <img src="/logo.png" />
      <a href="mailto:help@monzo.com">Email</a>
      <a href="javascript:void(0)">JavaScript</a>
      <a href="">Empty</a>
      <a>No href</a>
    `;
    expect(parse({ html, baseUrl })).toEqual([]);
  });
});
