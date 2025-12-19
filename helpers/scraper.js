function isSizeValue(value) {
  return /\b\d+(\.\d+)?\s?(g|kg|ml|l|oz|pcs|pc|pack)\b/i.test(value || "");
}

async function scrollToBottom(page) {
  await page.evaluate(() => {
    document.body.scrollIntoView({ block: "end" });
  });
  await page.waitForTimeout(800);
}

async function extractGalleryImages(page) {
  await page.waitForSelector(
    'section.productMedia-module-scss-module__MBnCyq__img-content img',
    { timeout: 15000 }
  );

  return await page.$$eval(
    'section.productMedia-module-scss-module__MBnCyq__img-content img',
    imgs => [...new Set(imgs.map(img => img.src).filter(Boolean))]
  );
}

export async function extractProduct(page, url, index, total) {
  console.log(`🛒 Product ${index + 1} / ${total}`);

  await page.goto(url, {
    waitUntil: "networkidle", // ✅ فرق كبير على السيرفر
    timeout: 60000,
  });

  await scrollToBottom(page);

  // ================= TITLE + BRAND =================
  await page.waitForSelector('div[class*="productUpper-heading"] h1');

  const fullText = await page.textContent(
    'div[class*="productUpper-heading"] h1'
  );
  const brand = await page.textContent(
    'div[class*="productUpper-heading"] h1 a'
  );

  const title = fullText.replace(brand, "").replace(/^\s*-\s*/, "").trim();
  const finalTitle = `${brand}, ${title}`;

  const handle = `${brand} ${title}`
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  // ================= PRICE =================
  let price = "";
  let compareAtPrice = "";

  try {
    price = (await page.textContent(
      'span.productDetailPage-module-scss-module__dKBM_W__sellingPrice'
    )).replace(/[^\d.]/g, "");
  } catch {}

  try {
    compareAtPrice = (await page.textContent(
      'span.productDetailPage-module-scss-module__dKBM_W__listPrice'
    )).replace(/[^\d.]/g, "");
  } catch {}

  // ================= DESCRIPTION =================
  let descriptionHtml = "";
  try {
    const infoBox = page.locator('div[class*="productInfoBox"]');
    await infoBox.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    descriptionHtml = await infoBox.first().evaluate(el => el.innerHTML);
  } catch {}

  // ================= MAIN IMAGE =================
  await page.waitForSelector(
    'div.productDetailPage-module-scss-module__dKBM_W__productImageCover img'
  );

  const mainImage = await page.$eval(
    'div.productDetailPage-module-scss-module__dKBM_W__productImageCover img',
    img => img.src
  );

  const rows = [];

  // ================= STANDALONE SIZE =================
  const standaloneSize = await page
    .locator(
      'div[role="button"][aria-hidden="true"] span.buyOptions-module-scss-module__Zum4na__option-title'
    )
    .first()
    .textContent()
    .catch(() => null);

  if (standaloneSize && isSizeValue(standaloneSize)) {
    rows.push({
      Handle: handle,
      Title: finalTitle,
      "Body (HTML)": descriptionHtml,
      Vendor: brand,
      "Option1 Name": "Size",
      "Option1 Value": standaloneSize.trim(),
      "Cost per item": price,
      "Variant Compare At Price": compareAtPrice,
      "Variant Fulfillment Service": "manual",
      "Variant Inventory Policy": "deny",
      "Variant Inventory Tracker": "shopify",
      "Image Src": mainImage,
      "Variant Image": mainImage,
      "product.metafields.custom.original_product_url": url,
    });

    return rows;
  }

  // ================= VARIANTS =================
  const OPEN_VARIANT_BTN =
    'div[role="button"]:has(span.buyOptions-module-scss-module__Zum4na__option-title):not([aria-hidden="true"])';

  const VARIANT_DIALOG = "#product-options-dialog-content";
  const VARIANT_BUTTONS =
    "#product-options-dialog-content button[aria-label]";

  let variants = [];

  try {
    await page.click(OPEN_VARIANT_BTN);
    await page.waitForSelector(VARIANT_DIALOG, { timeout: 15000 });

    variants = await page.$$eval(VARIANT_BUTTONS, btns =>
      btns.map(b => ({
        name: b.getAttribute("aria-label"),
        disabled:
          b.hasAttribute("disabled") ||
          b.getAttribute("aria-disabled") === "true",
      }))
    );
  } catch {}

  let isFirstRow = true;

  for (const v of variants) {
    if (v.disabled) continue;

    const btn = page
      .locator(VARIANT_BUTTONS)
      .filter({ hasText: v.name })
      .first();

    await btn.click();
    await page.waitForTimeout(500);

    const variantImage = await page.$eval(
      'div.productDetailPage-module-scss-module__dKBM_W__productImageCover img',
      img => img.src
    );

    if (isFirstRow) {
      rows.push({
        Handle: handle,
        Title: finalTitle,
        "Body (HTML)": descriptionHtml,
        Vendor: brand,
        "Option1 Name": "Color",
        "Option1 Value": v.name,
        "Cost per item": price,
        "Variant Compare At Price": compareAtPrice,
        "Variant Fulfillment Service": "manual",
        "Variant Inventory Policy": "deny",
        "Variant Inventory Tracker": "shopify",
        "Image Src": mainImage, // ✅ كما طلبت
        "Variant Image": variantImage,
        "product.metafields.custom.original_product_url": url,
      });
      isFirstRow = false;
    } else {
      rows.push({
        Handle: handle,
        "Option1 Value": v.name,
        "Variant Image": variantImage,
        "Variant Fulfillment Service": "manual",
        "Variant Inventory Policy": "deny",
        "Variant Inventory Tracker": "shopify",
      });
    }
  }

  // ================= FAILSAFE =================
  if (!rows.length) {
    console.log("⚠️ Fallback row saved");
    rows.push({
      Handle: handle,
      Title: finalTitle,
      Vendor: brand,
      "Image Src": mainImage,
      "Variant Image": mainImage,
    });
  }

  return rows;
}
