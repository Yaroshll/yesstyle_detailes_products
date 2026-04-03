const SELECTORS = {
  titleHeading: 'div[class*="productUpper-heading"] h1',
  titleBrand: 'div[class*="productUpper-heading"] h1 a',
  sellingPrice: 'span[class*="sellingPrice"]',
  listPrice: 'span[class*="listPrice"]',
  infoBox: 'div[class*="productInfoBox"]',
  accordionContent: 'div[class*="accordionContent"]',
  mainImage: 'div[class*="productImageCover"] img',
  galleryButton: 'button:has-text("View Gallery")',
  galleryImages: 'section[class*="productMedia"] [class*="img-content"] img',
  standaloneSize:
    'div[role="button"][aria-hidden="true"] span[class*="option-title"]',
  openVariantButton:
    'div[role="button"]:has(span[class*="option-title"]):not([aria-hidden="true"])',
  variantDialog: "#product-options-dialog-content",
  variantDialogCloseButton:
    '[role="dialog"][aria-describedby="product-options-dialog-content"] button[class*="closeButton"]',
  variantButtons: "#product-options-dialog-content button[aria-label]",
};

function isSizeValue(value) {
  if (!value) return false;
  return /\b\d+(\.\d+)?\s?(g|kg|ml|l|oz|pcs|pc|pack)\b/i.test(value);
}

function normalizeText(value) {
  return value?.trim() ?? "";
}

function normalizePrice(value) {
  return normalizeText(value)
    .replace(/[^\d.]/g, "")
    .replace(/\.$/, "");
}

function formatPrice(value) {
  return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
}

function getRandomCompareAtMultiplier() {
  return 1.15 + Math.random() * 0.1;
}

function buildSharedCompareAtPrice(priceValues, multiplier) {
  const numericPrices = priceValues
    .map((priceValue) => Number(priceValue))
    .filter((priceValue) => Number.isFinite(priceValue) && priceValue > 0);

  if (!numericPrices.length) {
    return "";
  }

  return formatPrice(Math.max(...numericPrices) * multiplier);
}

function buildPricingFields(costValue, compareAtPrice = "") {
  const cost = normalizePrice(costValue);

  if (!cost) {
    return {
      cost: "",
      price: "",
      compareAtPrice: "",
    };
  }

  const price = formatPrice(Number(cost) * 1.25);

  return {
    cost,
    price,
    compareAtPrice: compareAtPrice || "",
  };
}

function buildHandle(value) {
  return value
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function buildPrimaryRow({
  handle,
  finalTitle,
  descriptionHtml,
  brand,
  cost = "",
  price,
  compareAtPrice,
  mainImage,
  variantImage = mainImage,
  url,
  option1Name = "",
  option1Value = "",
  option2Name = "",
  option2Value = "",
}) {
  return {
    Handle: handle,
    Title: finalTitle,
    "Body (HTML)": descriptionHtml,
    Vendor: brand,
    "Option1 Name": option1Name,
    "Option1 Value": option1Value,
    "Option2 Name": option2Name,
    "Option2 Value": option2Value,
    "Cost per item": cost,
    price,
    "Variant Compare At Price": compareAtPrice,
    "Variant Fulfillment Service": "manual",
    "Variant Inventory Policy": "deny",
    "Variant Inventory Tracker": "shopify",
    "Image Src": mainImage,
    "Variant Image": variantImage,
    "product.metafields.custom.original_product_url": url,
  };
}

function buildVariantRow({
  handle,
  cost = "",
  price = "",
  compareAtPrice = "",
  option1Value = "",
  option2Value = "",
  variantImage = "",
}) {
  return {
    Handle: handle,
    "Cost per item": cost,
    price,
    "Variant Compare At Price": compareAtPrice,
    "Option1 Value": option1Value,
    "Option2 Value": option2Value,
    "Variant Fulfillment Service": "manual",
    "Variant Inventory Policy": "deny",
    "Variant Inventory Tracker": "shopify",
    "Variant Image": variantImage,
  };
}

async function getTextContent(locator) {
  const firstMatch = locator.first();
  const matchCount = await firstMatch.count().catch(() => 0);

  if (!matchCount) {
    return "";
  }

  return normalizeText(
    await firstMatch.textContent({ timeout: 500 }).catch(() => ""),
  );
}

async function getInnerHtml(locator) {
  return (
    (await locator
      .first()
      .evaluate((el) => el.innerHTML)
      .catch(() => "")) || ""
  );
}

async function getMainImageSrc(page) {
  const image = page.locator(SELECTORS.mainImage).first();
  await image.waitFor({ state: "attached", timeout: 10000 });
  return (await image.getAttribute("src")) || "";
}

async function getDescriptionHtml(page) {
  const accordion = page.locator(SELECTORS.accordionContent).first();

  if (await accordion.count()) {
    return getInnerHtml(accordion);
  }

  const infoBox = page.locator(SELECTORS.infoBox).first();
  await infoBox.waitFor({ state: "attached", timeout: 10000 }).catch(() => {});
  return getInnerHtml(infoBox);
}

async function extractGalleryImages(page) {
  const galleryImages = page.locator(SELECTORS.galleryImages);
  await galleryImages.first().waitFor({ state: "attached", timeout: 10000 });

  return page.$$eval(SELECTORS.galleryImages, (imgs) => [
    ...new Set(
      imgs.map((img) => img.getAttribute("src") || img.src).filter(Boolean),
    ),
  ]);
}

async function openVariantDialog(page) {
  const dialog = page.locator(SELECTORS.variantDialog);

  if (await dialog.isVisible().catch(() => false)) {
    return true;
  }

  const trigger = page.locator(SELECTORS.openVariantButton).first();
  const triggerCount = await trigger.count().catch(() => 0);

  if (!triggerCount) {
    return false;
  }

  await trigger.waitFor({ state: "visible", timeout: 5000 });

  for (let attempt = 0; attempt < 3; attempt++) {
    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    await trigger
      .click({
        timeout: 2000,
        force: attempt > 0,
      })
      .catch(() => {});

    await dialog.waitFor({ state: "visible", timeout: 1500 }).catch(() => {});

    if (await dialog.isVisible().catch(() => false)) {
      return true;
    }
  }

  throw new Error("Variant dialog did not open after retries");
}

async function closeVariantDialog(page) {
  const dialog = page.locator(SELECTORS.variantDialog);

  if (!(await dialog.isVisible().catch(() => false))) {
    return;
  }

  await page.keyboard.press("Escape").catch(() => {});
  await dialog.waitFor({ state: "hidden", timeout: 250 }).catch(() => {});

  if (await dialog.isVisible().catch(() => false)) {
    await page
      .locator(SELECTORS.variantDialogCloseButton)
      .first()
      .click({ timeout: 1000 })
      .catch(() => {});
  }

  await dialog.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});
}

async function waitForSelectedVariant(page, name) {
  await page
    .waitForFunction(
      ({ selector, expectedText }) => {
        const trigger = document.querySelector(selector);
        return trigger?.textContent?.includes(expectedText) ?? false;
      },
      {
        selector: SELECTORS.openVariantButton,
        expectedText: name,
      },
      { timeout: 5000 },
    )
    .catch(() => {});
}

async function getVariantImage(page, previousImage = "") {
  if (previousImage) {
    await page
      .waitForFunction(
        ({ selector, previousSrc }) => {
          const image = document.querySelector(selector);
          const currentSrc = image?.getAttribute("src");
          return Boolean(currentSrc) && currentSrc !== previousSrc;
        },
        {
          selector: SELECTORS.mainImage,
          previousSrc: previousImage,
        },
        { timeout: 2000 },
      )
      .catch(() => {});
  }

  return (
    (await page.locator(SELECTORS.mainImage).first().getAttribute("src")) ||
    previousImage
  );
}

async function getGalleryImages(page) {
  const button = page.locator(SELECTORS.galleryButton).first();

  if (!(await button.count())) {
    return [];
  }

  await closeVariantDialog(page);
  await button.scrollIntoViewIfNeeded().catch(() => {});
  await button.click();

  return extractGalleryImages(page).catch(() => []);
}

export async function extractProduct(page, url, index, total) {
  console.log(`🛒 Product ${index + 1} / ${total}`);

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  const titleHeading = page.locator(SELECTORS.titleHeading).first();
  await titleHeading.waitFor({ state: "visible", timeout: 10000 });

  const [
    fullText,
    brand,
    priceText,
    descriptionHtml,
    mainImage,
  ] = await Promise.all([
    getTextContent(titleHeading),
    getTextContent(page.locator(SELECTORS.titleBrand)),
    getTextContent(page.locator(SELECTORS.sellingPrice)),
    getDescriptionHtml(page),
    getMainImageSrc(page),
  ]);

  let title = fullText;
  if (brand && fullText.includes(brand)) {
    title = fullText.replace(brand, "").trim();
  }
  title = title.replace(/^\s*-\s*/, "").trim();
  const finalTitle = brand ? `${brand}, ${title}` : title;
  const handle = buildHandle(brand ? `${brand} ${title}` : title);
  const productCompareAtMultiplier = getRandomCompareAtMultiplier();
  const defaultPricingBase = buildPricingFields(priceText);
  const defaultCompareAtPrice = buildSharedCompareAtPrice(
    [defaultPricingBase.price],
    productCompareAtMultiplier,
  );
  const defaultPricing = buildPricingFields(priceText, defaultCompareAtPrice);
  const rows = [];
  const standaloneSize = await getTextContent(
    page.locator(SELECTORS.standaloneSize),
  );
  if (standaloneSize && isSizeValue(standaloneSize)) {
    rows.push(
      buildPrimaryRow({
        handle,
        finalTitle,
        descriptionHtml,
        brand,
        ...defaultPricing,
        mainImage,
        url,
        option1Name: "Size",
        option1Value: standaloneSize,
      }),
    );
    const galleryImages = await getGalleryImages(page);
    for (let i = 1; i < galleryImages.length; i++) {
      rows.push({
        Handle: handle,
        "Image Src": galleryImages[i],
        "Cost per item": defaultPricing.cost,
        price: defaultPricing.price,
        "Variant Compare At Price": defaultPricing.compareAtPrice,
      });
    }
    return rows;
  }

  let rawVariants = [];
  const hasVariantDialog = await openVariantDialog(page);
  if (hasVariantDialog) {
    rawVariants = await page.$$eval(SELECTORS.variantButtons, (buttons) =>
      buttons.map((button) => ({
        name: button.getAttribute("aria-label")?.trim(),
        costText: button.querySelector("div:nth-child(1)")?.textContent ?? "",
        disabled:
          button.hasAttribute("disabled") ||
          button.getAttribute("aria-disabled") === "true",
      })),
    );
  }
  let sizeValue = null;
  const colorVariants = [];

  for (const variant of rawVariants) {
    if (!variant.name) continue;

    if (isSizeValue(variant.name)) {
      sizeValue = variant.name;
    } else {
      colorVariants.push(variant);
    }
  }
  const hasSize = Boolean(sizeValue);
  const sharedVariantCompareAtPrice = buildSharedCompareAtPrice(
    colorVariants
      .filter(({ disabled }) => !disabled)
      .map(({ costText }) => buildPricingFields(costText || defaultPricing.cost).price)
      .filter(Boolean),
    productCompareAtMultiplier,
  );

  if (!colorVariants.length && hasSize) {
    rows.push(
      buildPrimaryRow({
        handle,
        finalTitle,
        descriptionHtml,
        brand,
        ...defaultPricing,
        mainImage,
        url,
        option1Name: "Size",
        option1Value: sizeValue,
      }),
    );
    return rows;
  }

  if (!colorVariants.length) {
    rows.push(
      buildPrimaryRow({
        handle,
        finalTitle,
        descriptionHtml,
        brand,
        ...defaultPricing,
        mainImage,
        url,
      }),
    );
    return rows;
  }

  let isFirstRow = true;
  let previousImage = mainImage;
  let firstVariantImage = "";
  let firstVariantPricing = null;
  let shouldUseGallery = false;
  for (const { name, disabled, costText } of colorVariants) {
    if (disabled) continue;

    const button = page
      .locator(SELECTORS.variantButtons)
      .filter({ hasText: name })
      .first();

    const variantPricing = buildPricingFields(
      costText || defaultPricing.cost,
      sharedVariantCompareAtPrice || defaultPricing.compareAtPrice,
    );

    await button.click();
    await waitForSelectedVariant(page, name);
    const variantImage = await getVariantImage(page, previousImage);
    previousImage = variantImage;
    if (!firstVariantImage) {
      firstVariantImage = variantImage;
    } else if (variantImage === firstVariantImage) {
      shouldUseGallery = true;
    }
    if (isFirstRow) {
      firstVariantPricing = variantPricing;
      rows.push(
        buildPrimaryRow({
          handle,
          finalTitle,
          descriptionHtml,
          brand,
          ...variantPricing,
          mainImage,
          variantImage,
          url,
          option1Name: "Color",
          option1Value: name,
          option2Name: hasSize ? "Size" : "",
          option2Value: hasSize ? sizeValue : "",
        }),
      );
      isFirstRow = false;
      continue;
    }
    rows.push(
      buildVariantRow({
        handle,
        ...variantPricing,
        option1Value: name,
        option2Value: hasSize ? sizeValue : "",
        variantImage,
      }),
    );
  }
  if (shouldUseGallery) {
    const galleryImages = await getGalleryImages(page);
    const galleryPricing = firstVariantPricing ?? defaultPricing;
    if (galleryImages.length) {
      rows.length = 0;
      rows.push(
        buildPrimaryRow({
          handle,
          finalTitle,
          descriptionHtml,
          brand,
          ...galleryPricing,
          mainImage: galleryImages[0] || mainImage,
          variantImage: galleryImages[0] || mainImage,
          url,
          option1Name: "Color",
          option1Value: colorVariants[0].name,
          option2Name: hasSize ? "Size" : "",
          option2Value: hasSize ? sizeValue : "",
        }),
      );

      for (let i = 1; i < galleryImages.length; i++) {
        rows.push({
          Handle: handle,
          "Image Src": galleryImages[i],
          "Cost per item": galleryPricing.cost,
          price: galleryPricing.price,
          "Variant Compare At Price": galleryPricing.compareAtPrice,
        });
      }
    }
  }
  return rows;
}
