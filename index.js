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
   "https://www.yesstyle.com/en/tocobo-glow-moist-trio-set-3-pcs/info.html/pid.1125556069",
   "https://www.yesstyle.com/en/gege-bear-velvet-mist-lip-powder-cream-4-colors-01-2g/info.html/pid.1132543951",
   "https://www.yesstyle.com/en/3ce-velvet-lip-tint-plush-19-colors-01-speak-up-4g/info.html/pid.1136365210",
   "https://www.yesstyle.com/en/unleashia-non-sticky-dazzle-tint-8-colors-renewed-n-12-flamingo/info.html/pid.1096384825",
   "https://www.yesstyle.com/en/tocobo-cica-calming-gel-cream-75ml/info.html/pid.1129159956",
   "https://www.yesstyle.com/en/tocobo-vita-berry-pore-toner-150ml/info.html/pid.1118784760",
   
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
