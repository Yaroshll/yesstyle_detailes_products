import {
  launchBrowser,
  createBrowserContext,
  createPage,
  closeBrowser,
} from "./helpers/browser.js";
import { logFailedProduct } from "./helpers/errorLogger.js";

const collectionUrl =
  "https://www.yesstyle.com/en/beauty-mascaras/list.html/bcc.15490_bpt.46";

const BREADCRUMB_TAG_SELECTOR = 'div[class*="breadcrumbWrapper"] li';
const PRODUCT_LINK_SELECTOR = "main div div div section a";
const NEXT_PAGE_SELECTORS = [
  "a.listPagniation-module-scss-module__7Rf_Hq__pageDirectionButton.listPagniation-module-scss-module__7Rf_Hq__nextPage",
  "button.button-module-scss-module__zwkijW__blackButton.productListingMain-module-scss-module__1cWHBG__blackButton",
  "a.listPagniation-module-scss-module__7Rf_Hq__simpleDirectionButton.listPagniation-module-scss-module__7Rf_Hq__nextPage",
];

function getCollectionOrigin(url) {
  return new URL(url).origin;
}

async function extractProductUrlsFromCurrentPage(page, origin) {
  await page.waitForSelector(PRODUCT_LINK_SELECTOR, { timeout: 10000 });

  return page.$$eval(
    PRODUCT_LINK_SELECTOR,
    (anchors, baseUrl) => {
      const productUrls = anchors
        .map((anchor) => anchor.getAttribute("href"))
        .filter((href) => href?.startsWith("/en/"))
        .map((href) => new URL(href, baseUrl).href);

      return [...new Set(productUrls)];
    },
    origin,
  );
}

async function extractCollectionTags(page) {
  return page
    .$$eval(BREADCRUMB_TAG_SELECTOR, (items) =>
      [...new Set(items.map((item) => item.textContent?.trim()).filter(Boolean))],
    )
    .catch(() => []);
}

function buildProductItems(productUrls, tags) {
  return productUrls.map((url) => ({
    url,
    tags: [...tags],
  }));
}

async function getPageMarker(page) {
  return page.evaluate((selector) => {
    const firstHref =
      document.querySelector(selector)?.getAttribute("href") ?? null;

    return {
      url: location.href,
      firstHref,
    };
  }, PRODUCT_LINK_SELECTOR);
}

async function getNextPageButton(page) {
  for (const selector of NEXT_PAGE_SELECTORS) {
    const button = page.locator(selector).first();

    if (await button.count().catch(() => 0)) {
      return button;
    }
  }

  return null;
}

async function isButtonDisabled(button) {
  return button
    .evaluate((element) => {
      const className =
        typeof element.className === "string" ? element.className : "";

      return Boolean(
        ("disabled" in element && element.disabled) ||
          element.hasAttribute("disabled") ||
          element.getAttribute("aria-disabled") === "true" ||
          className.includes("Mui-disabled"),
      );
    })
    .catch(() => true);
}

async function waitForPageChange(page, previousMarker) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(500);

    const currentMarker = await getPageMarker(page).catch(() => previousMarker);

    if (
      currentMarker.url !== previousMarker.url ||
      currentMarker.firstHref !== previousMarker.firstHref
    ) {
      return true;
    }
  }

  return false;
}

(async () => {
  const browser = await launchBrowser();
  try {
    const context = await createBrowserContext(browser);
    const page = await createPage(context);
    const origin = getCollectionOrigin(collectionUrl);

    try {
      await page.goto(collectionUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      const collectionTags = await extractCollectionTags(page);
      console.log("Collection tags:");
      console.log(JSON.stringify(collectionTags, null, 2));

      let pageNumber = 1;

      while (true) {
        try {
          const productUrls = await extractProductUrlsFromCurrentPage(page, origin);
          const productItems = buildProductItems(productUrls, collectionTags);
          console.log(`Page ${pageNumber}:`);
          console.log(JSON.stringify(productItems, null, 2));

          const nextPageButton = await getNextPageButton(page);

          if (!nextPageButton) {
            break;
          }

          if (await isButtonDisabled(nextPageButton)) {
            break;
          }

          const previousMarker = await getPageMarker(page);

          await nextPageButton.scrollIntoViewIfNeeded().catch(() => {});
          await nextPageButton.click({ timeout: 5000 });

          const pageChanged = await waitForPageChange(page, previousMarker);

          if (!pageChanged) {
            break;
          }

          await page.waitForLoadState("domcontentloaded").catch(() => {});
          pageNumber += 1;
        } catch (err) {
          console.log("❌ Failed:", page.url());
          logFailedProduct(page.url(), err);
          break;
        }
      }
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    await closeBrowser(browser);
  }
})();
