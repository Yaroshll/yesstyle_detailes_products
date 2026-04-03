import {
  launchBrowser,
  createBrowserContext,
  createPage,
  closeBrowser
} from "./helpers/browser.js";

import { extractProduct } from "./helpers/scraper.js";
import { saveToExcelAndCsv } from "./helpers/fileIO.js";
import { logFailedProduct } from "./helpers/errorLogger.js";

const DEFAULT_CONCURRENCY = 1;

(async () => {
  const browser = await launchBrowser();
  try {
    const context = await createBrowserContext(browser);

    const urls = [
      "https://www.yesstyle.com/en/kaja-jelly-charm-6-colors-06-mocha-glaze/info.html/pid.1120862268",
      "https://www.yesstyle.com/en/romand-juicy-lasting-tint-sparkling-juicy-collection-4-colors-17-plum/info.html/pid.1092461498",
      "https://www.yesstyle.com/en/peripera-ink-glasting-lip-gloss-22-colors-09-grow-on-you/info.html/pid.1117446620",
      "https://www.yesstyle.com/en/heart-percent-dote-on-mood-line-proof-lip-pencil-10-colors-01-nudy/info.html/pid.1135841076"


    ];

    const configuredConcurrency = Number.parseInt(
      process.env.SCRAPER_CONCURRENCY ?? "",
      10
    );
    const concurrency = Math.min(
      urls.length || 1,
      Number.isNaN(configuredConcurrency)
        ? DEFAULT_CONCURRENCY
        : Math.max(1, configuredConcurrency)
    );

    const resultsByUrl = Array.from({ length: urls.length }, () => []);
    let nextIndex = 0;

    async function worker(workerId) {
      const page = await createPage(context);

      try {
        while (true) {
          const currentIndex = nextIndex++;

          if (currentIndex >= urls.length) {
            return;
          }

          const url = urls[currentIndex];
          console.log(
            `🔗 URL ${currentIndex + 1} / ${urls.length} (worker ${workerId})`
          );

          try {
            resultsByUrl[currentIndex] = await extractProduct(
              page,
              url,
              currentIndex,
              urls.length
            );
          } catch (err) {
            console.log("❌ Failed:", url);
            logFailedProduct(url, err);
          }
        }
      } finally {
        await page.close().catch(() => {});
      }
    }

    console.log(`⚙️ Running with ${concurrency} page(s)`);
    await Promise.all(
      Array.from({ length: concurrency }, (_, index) => worker(index + 1))
    );

    await saveToExcelAndCsv(resultsByUrl.flat());
  } finally {
    await closeBrowser(browser);
  }
})();
