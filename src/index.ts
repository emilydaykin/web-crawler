import process from "node:process";
import { crawl } from "./crawler.js";
import { fetchPage } from "./fetcher.js";

const [startUrl, flag, concurrencyArg] = process.argv.slice(2);
let concurrency = 5;
if (flag === "--concurrency") {
  concurrency = Number.parseInt(concurrencyArg ?? "", 10);
}

if (!startUrl || !Number.isInteger(concurrency) || concurrency < 1) {
  console.error("Usage: npm start -- <url> [--concurrency <n>]");
  process.exit(1);
}

try {
  new URL(startUrl);
} catch {
  console.error(`Invalid URL: ${startUrl}`);
  process.exit(1);
}

await crawl({
  baseUrl: startUrl,
  fetcher: fetchPage,
  concurrency,
});
