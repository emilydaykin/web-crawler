import { load } from "cheerio/slim";
import { resolveUrl } from "./urlUtils.js";

function parse({ html, baseUrl }: { html: string; baseUrl: string }): string[] {
  const $ = load(html);
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const resolved = resolveUrl({ href, baseUrl });
    if (resolved) links.add(resolved);
  });

  return [...links];
}

export { parse };
