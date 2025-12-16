import {
  launchBrowser,
  createBrowserContext,
  createPage,
  closeBrowser
} from "./helpers/browser.js";

import { extractProduct } from "./helpers/scraper.js";
import { saveToExcelAndCsv } from "./helpers/fileIO.js";
import { logFailedProduct } from "./helpers/errorLogger.js";

(async () => {
  const browser = await launchBrowser();
  const context = await createBrowserContext(browser);
  const page = await createPage(context);

  const urls = [
   "https://www.yesstyle.com/en/kaja-jelly-charm-6-colors-06-mocha-glaze/info.html/pid.1120862268",
   ];

  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`🔗 URL ${i + 1} / ${urls.length}`);

    try {
      const data = await extractProduct(page, url, i, urls.length);
      results.push(...data);
    } catch (err) {
      console.log("❌ Failed:", url);
      logFailedProduct(url, err);
    }
  }

  await saveToExcelAndCsv(results);
  await closeBrowser(browser);
})();
