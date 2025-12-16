function isSizeValue(value) {
  if (!value) return false;
  return /\b\d+(\.\d+)?\s?(g|kg|ml|l|oz|pcs|pc|pack)\b/i.test(value);
}

async function extractGalleryImages(page) {
  await page.waitForSelector(
    'section.productMedia-module-scss-module__MBnCyq__img-content img',
    { timeout: 10000 }
  );

  return await page.$$eval(
    'section.productMedia-module-scss-module__MBnCyq__img-content img',
    imgs => [...new Set(imgs.map(img => img.src).filter(Boolean))]
  );
}

export async function extractProduct(page, url, index, total) {
  console.log(`🛒 Product ${index + 1} / ${total}`);

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  // ================= TITLE + BRAND =================
  await page.waitForSelector('div[class*="productUpper-heading"] h1');

  const fullText = await page.textContent(
    'div[class*="productUpper-heading"] h1'
  );

  const brand = await page.textContent(
    'div[class*="productUpper-heading"] h1 a'
  );

  let title = fullText.replace(brand, "").trim();
  title = title.replace(/^\s*-\s*/, "").trim();

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
    ))
      .replace(/[^\d.]/g, "")
      .replace(/\.$/, "");
  } catch {}

  try {
    compareAtPrice = (await page.textContent(
      'span.productDetailPage-module-scss-module__dKBM_W__listPrice'
    ))
      .replace(/[^\d.]/g, "")
      .replace(/\.$/, "");
  } catch {}

  // ================= DESCRIPTION =================
  let descriptionHtml = "";

  try {
    const infoBox = page.locator('div[class*="productInfoBox"]');
    await infoBox.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const accordion = page.locator('div[class*="accordionContent"]');
    descriptionHtml =
      (await accordion.count()) > 0
        ? await accordion.first().evaluate(el => el.innerHTML)
        : await infoBox.first().evaluate(el => el.innerHTML);
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

  // ============================================================
  // 🟢 CASE 1: STANDALONE SIZE (aria-hidden=true, no dialog)
  // ============================================================
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

      "product.metafields.custom.original_product_url": url
    });

    // 👇 حتى في حالة standalone size نحتاج gallery
    const viewGalleryBtn = page.locator('button:has-text("View Gallery")');
    if (await viewGalleryBtn.count()) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(300);
      await viewGalleryBtn.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await viewGalleryBtn.first().click();
      await page.waitForTimeout(800);

      const galleryImages = await extractGalleryImages(page);

      // أضف باقي صور الـ gallery
      for (let i = 1; i < galleryImages.length; i++) {
        rows.push({
          Handle: handle,
          "Image Src": galleryImages[i]
        });
      }
    }

    return rows;
  }

  // ============================================================
  // 🔵 NORMAL VARIANTS FLOW
  // ============================================================
  const OPEN_VARIANT_BTN =
    'div[role="button"]:has(span.buyOptions-module-scss-module__Zum4na__option-title):not([aria-hidden="true"])';

  const VARIANT_DIALOG = '#product-options-dialog-content';
  const VARIANT_BUTTONS =
    '#product-options-dialog-content button[aria-label]';

  let rawVariants = [];

  try {
    await page.click(OPEN_VARIANT_BTN);
    await page.waitForSelector(VARIANT_DIALOG);

    rawVariants = await page.$$eval(VARIANT_BUTTONS, btns =>
      btns.map(b => ({
        name: b.getAttribute("aria-label")?.trim(),
        disabled:
          b.hasAttribute("disabled") ||
          b.getAttribute("aria-disabled") === "true"
      }))
    );
  } catch {
    rawVariants = [];
  }

  // ================= SPLIT COLOR / SIZE =================
  let sizeValue = null;
  let colorVariants = [];

  for (const v of rawVariants) {
    if (isSizeValue(v.name)) {
      sizeValue = v.name;
    } else {
      colorVariants.push(v);
    }
  }

  const hasSize = !!sizeValue;

  // ============================================================
  // 🟡 CASE 2: SIZE ONLY (dialog exists but one size)
  // ============================================================
  if (!colorVariants.length && hasSize) {
    rows.push({
      Handle: handle,
      Title: finalTitle,
      "Body (HTML)": descriptionHtml,
      Vendor: brand,

      "Option1 Name": "Size",
      "Option1 Value": sizeValue,

      "Cost per item": price,
      "Variant Compare At Price": compareAtPrice,

      "Variant Fulfillment Service": "manual",
      "Variant Inventory Policy": "deny",
      "Variant Inventory Tracker": "shopify",

      "Image Src": mainImage,
      "Variant Image": mainImage,

      "product.metafields.custom.original_product_url": url
    });

    return rows;
  }

  // ============================================================
  // 🟣 COLOR (WITH OR WITHOUT SIZE)
  // ============================================================
  let isFirstRow = true;
  let firstVariantImage = null;
  let shouldUseGallery = false;

  for (let i = 0; i < colorVariants.length; i++) {
    const { name, disabled } = colorVariants[i];
    if (disabled) continue;

    if (i !== 0) {
      await page.click(OPEN_VARIANT_BTN);
      await page.waitForSelector(VARIANT_DIALOG);
    }

    const btn = page
      .locator(VARIANT_BUTTONS)
      .filter({ hasText: name })
      .first();

    await btn.click();
    await page.waitForTimeout(500);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    const variantImage = await page.$eval(
      'div.productDetailPage-module-scss-module__dKBM_W__productImageCover img',
      img => img.src
    );

    if (!firstVariantImage) {
      firstVariantImage = variantImage;
    } else if (variantImage === firstVariantImage) {
      shouldUseGallery = true;
    }

    if (isFirstRow) {
      rows.push({
        Handle: handle,
        Title: finalTitle,
        "Body (HTML)": descriptionHtml,
        Vendor: brand,

        "Option1 Name": "Color",
        "Option1 Value": name,

        "Option2 Name": hasSize ? "Size" : "",
        "Option2 Value": hasSize ? sizeValue : "",

        "Cost per item": price,
        "Variant Compare At Price": compareAtPrice,

        "Variant Fulfillment Service": "manual",
        "Variant Inventory Policy": "deny",
        "Variant Inventory Tracker": "shopify",

        "Image Src": mainImage, // ✅
"Variant Image": variantImage,


        "product.metafields.custom.original_product_url": url
      });

      isFirstRow = false;
    } else {
      rows.push({
        Handle: handle,
        "Option1 Value": name,
        "Option2 Value": hasSize ? sizeValue : "",

        "Variant Fulfillment Service": "manual",
        "Variant Inventory Policy": "deny",
        "Variant Inventory Tracker": "shopify",

        "Variant Image": variantImage
      });
    }
  }

  // ============================================================
  // 🔴 VIEW GALLERY FALLBACK (IMAGES NOT CHANGING)
  // ============================================================
  if (shouldUseGallery) {
    const viewGalleryBtn = page.locator('button:has-text("View Gallery")');

    if (await viewGalleryBtn.count()) {
      // scroll عام
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(300);

      // scroll مباشر للزر
      await viewGalleryBtn.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);

      // click
      await viewGalleryBtn.first().click();
      await page.waitForTimeout(800);

      const galleryImages = await extractGalleryImages(page);

      // إعادة بناء rows بالـ gallery
      rows.length = 0;

      rows.push({
        Handle: handle,
        Title: finalTitle,
        "Body (HTML)": descriptionHtml,
        Vendor: brand,

        "Option1 Name": "Color",
        "Option1 Value": colorVariants[0].name,

        "Option2 Name": hasSize ? "Size" : "",
        "Option2 Value": hasSize ? sizeValue : "",

        "Cost per item": price,
        "Variant Compare At Price": compareAtPrice,

        "Variant Fulfillment Service": "manual",
        "Variant Inventory Policy": "deny",
        "Variant Inventory Tracker": "shopify",

        "Image Src": galleryImages[0] || mainImage,

        "product.metafields.custom.original_product_url": url
      });

      for (let i = 1; i < galleryImages.length; i++) {
        rows.push({
          Handle: handle,
          "Image Src": galleryImages[i]
        });
      }
    }
  }

  return rows;
}
