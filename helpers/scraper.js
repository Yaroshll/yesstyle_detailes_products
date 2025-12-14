export async function extractProduct(page, url) {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  // ---------------- TITLE + BRAND ----------------
  await page.waitForSelector('div[class*="productUpper-heading"] h1', {
    timeout: 300000
  });

  const fullText = await page.textContent(
    'div[class*="productUpper-heading"] h1'
  );

  const brand = await page.textContent(
    'div[class*="productUpper-heading"] h1 a'
  );

  let title = fullText.replace(brand, "").trim();
  title = title.replace(/^\s*-\s*/, "").trim();

  const finalTitle = `${brand}, ${title}`;

  // Handle WITHOUT extra dashes
const handle = `${brand} ${title}`
  .toLowerCase()
  .replace(/,/g, "")          // remove commas
  .replace(/&/g, "and")       // normalize &
  .replace(/[^a-z0-9\s]/g, "") // keep letters, numbers, spaces only
  .trim()
  .replace(/\s+/g, "-");      // spaces → single dash

  // ---------------- PRICE ----------------
  let price = "";
  let compareAtPrice = "";

  try {
    price = await page.textContent(
      'span.productDetailPage-module-scss-module__dKBM_W__sellingPrice'
    );
    price = price.replace(/[^\d.]/g, "");
  } catch {}

  try {
    compareAtPrice = await page.textContent(
      'span.productDetailPage-module-scss-module__dKBM_W__listPrice'
    );
    compareAtPrice = compareAtPrice.replace(/[^\d.]/g, "");
  } catch {}

  // ---------------- DESCRIPTION (YESSTYLE SAFE) ----------------
let descriptionHtml = "";

try {
  // Scroll to product info area
  const infoBox = page.locator(
    'div[class*="productInfoBox"]'
  );

  await infoBox.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // Try to extract accordion content if exists
  const accordionContent = page.locator(
    'div[class*="accordionContent"]'
  );

  if (await accordionContent.count() > 0) {
    descriptionHtml = await accordionContent.first().evaluate(
      el => el.innerHTML
    );
  }

  // Fallback – full info box HTML
  if (!descriptionHtml) {
    descriptionHtml = await infoBox.first().evaluate(
      el => el.innerHTML
    );
  }

} catch {
  console.log("⚠️ Features description not found");
  descriptionHtml = "";
}


  // ---------------- MAIN IMAGE (FIXED) ----------------
  let mainImage = "";

  try {
    mainImage = await page.getAttribute(
      'div.productDetailPage_productImageCover__chqZe img',
      "src"
    );
  } catch {
    mainImage = "";
  }
  // -------- VARIANT SELECTORS (MUST BE DEFINED) --------
const OPEN_VARIANT_BTN =
  'div[role="button"]:has-text("Select size or color")';

const VARIANT_DIALOG =
  '#product-options-dialog-content';

const VARIANT_BUTTONS =
  '#product-options-dialog-content button[aria-label]';

const MAIN_IMAGE =
  'img[src*="yesstyle"]';
// ----------------------------------------------------


// ================= VARIANTS WITH DIALOG CLOSE FIX =================

// 1️⃣ Open variant dialog
await page.waitForSelector(OPEN_VARIANT_BTN, { timeout: 15000 });
await page.click(OPEN_VARIANT_BTN);

// 2️⃣ Wait for dialog
await page.waitForSelector(VARIANT_DIALOG, { timeout: 15000 });

// 3️⃣ Collect variant names FIRST (important)
const variants = await page.$$eval(
  VARIANT_BUTTONS,
  btns => btns.map(b => b.getAttribute("aria-label"))
);

if (variants.length === 0) {
  console.log("⚠️ No variants found");
  return [];
}

const rows = [];

// 4️⃣ Loop variants by index
for (let i = 0; i < variants.length; i++) {

  // 🔁 Re-open dialog if not first variant
  if (i !== 0) {
    await page.click(OPEN_VARIANT_BTN);
    await page.waitForSelector(VARIANT_DIALOG, { timeout: 15000 });
  }

  // 5️⃣ Click variant by index
  const variantBtn = page.locator(VARIANT_BUTTONS).nth(i);
  const variantName = variants[i];

  await variantBtn.click();
  await page.waitForTimeout(300);

  // 6️⃣ Close dialog (ESC)
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// 7️⃣ Wait for the correct variant image to load
// - Ensure the main image container exists
// - Ensure the image alt contains the current variant name
// - Ensure the src has changed from the previous value (to handle dynamic updates)
const variantImage = await page.waitForFunction(
  (variantName, previousSrc) => {
    const container = document.querySelector('div.productDetailPage-module-scss-module__dKBM_W__productImageCover');
    if (!container) return false;
    const img = container.querySelector('img');
    if (!img) return false;
    // Check that alt includes the current variant name
    if (!img.alt.includes(variantName)) return false;
    // Check that the src changed from previous (ensures the new variant image loaded)
    return img.src !== previousSrc && img.naturalWidth > 300;
  },
  {},
  variantName,
  mainImage // previous main image src before variant selection
);

// 8️⃣ Get the updated src of the main variant image
const finalVariantImage = await page.$eval(
  'div.productDetailPage-module-scss-module__dKBM_W__productImageCover img',
  img => img.src
);



  rows.push({
    Handle: handle,
    Title: finalTitle,
    Body_HTML: descriptionHtml,
    Vendor: brand,
    Price: price,
    Compare_At_Price: compareAtPrice,
    Option1_Name: "Color",
    Option1_Value: variantName,
    Image_Src: variantImage
  });
}

// ================================================================

return rows;


}