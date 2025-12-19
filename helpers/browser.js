import { chromium } from "playwright";

const BROWSER_CONFIG = {
  LAUNCH_OPTIONS: {
    headless: true,
    timeout: 30000,
    channel: "chrome",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  },
  CONTEXT_OPTIONS: {
    viewport: { width: 1440, height: 900 }, // ✅ مهم جدًا
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
};

export async function launchBrowser() {
  console.log("🚀 Launching Chromium browser...");
  try {
    const browser = await chromium.launch(BROWSER_CONFIG.LAUNCH_OPTIONS);
    console.log("✅ Browser launched successfully");
    return browser;
  } catch (err) {
    console.log("🔄 Fallback without channel...");
    const fallback = { ...BROWSER_CONFIG.LAUNCH_OPTIONS };
    delete fallback.channel;
    return chromium.launch(fallback);
  }
}

export async function createBrowserContext(browser) {
  console.log("🌐 Creating browser context...");
  const context = await browser.newContext(BROWSER_CONFIG.CONTEXT_OPTIONS);
  console.log("✅ Browser context created successfully");
  return context;
}

export async function createPage(context) {
  console.log("📄 Creating new page...");
  const page = await context.newPage();

  // ✅ تثبيت البيئة (يحل الفرق بين local / server)
  await page.setViewportSize({ width: 1440, height: 900 });

  page.setDefaultTimeout(45000);
  page.setDefaultNavigationTimeout(45000);

  console.log("✅ Page created successfully");
  return page;
}

export async function closeBrowser(browser) {
  try {
    if (browser?.isConnected()) {
      await browser.close();
      console.log("👋 Browser closed successfully");
    }
  } catch (e) {
    console.error("❌ Error closing browser:", e.message);
  }
}
