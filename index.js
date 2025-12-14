import { launchBrowser, createBrowserContext, createPage, closeBrowser } from "./helpers/browser.js";
import { extractProduct } from "./helpers/scraper.js";
import { saveToExcelAndCsv } from "./helpers/fileIO.js";

(async () => {
  const browser = await launchBrowser();
  const context = await createBrowserContext(browser);
  const page = await createPage(context);

  const urls = [
    "https://www.yesstyle.com/en/kaja-jelly-charm-6-colors-06-mocha-glaze/info.html/pid.1120862268",
  ];

  const results = [];

  for (const url of urls) {
    console.log("Scraping:", url);
    try {
      const data = await extractProduct(page, url);
      results.push(...data);
    } catch (err) {
      console.log("Error:", err.message);
    }
  }

  await saveToExcelAndCsv(results);
  await closeBrowser(browser);
})();
