import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";


async function openCleanApp(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "25 recipes" })).toBeVisible();
}


test("search, filters, keyboard tabs, and console remain healthy", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await openCleanApp(page);
  await expect(page).toHaveTitle("Ron's Recipes");
  await expect(page.locator("#recipe-list article")).toHaveCount(25);

  await page.getByRole("searchbox", { name: "Search recipes" }).fill("chicken");
  await expect(page.getByRole("heading", { name: "13 recipes" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Outstanding", exact: true }).click();
  await expect(page.getByRole("heading", { name: "3 recipes" })).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("button", { name: "Add Recipe" }).click();
  const formTab = page.getByRole("tab", { name: "Fill in form" });
  const pasteTab = page.getByRole("tab", { name: "Paste recipe" });
  await formTab.focus();
  await formTab.press("ArrowRight");
  await expect(pasteTab).toBeFocused();
  await expect(pasteTab).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Cancel" }).click();

  expect(errors).toEqual([]);
});


test("metadata, install assets, manifest, and offline app shell are valid", async ({ page, context, request }) => {
  await openCleanApp(page);

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://rlukenbaugh.github.io/my-top-25-comfort-food-recipes/");
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Ron's Recipes | Comfort-Food Favorites");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://rlukenbaugh.github.io/my-top-25-comfort-food-recipes/assets/og/rons-recipes-share-1200x630.png");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "manifest.webmanifest");
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", "assets/icons/favicon.svg");

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("Ron's Recipes");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(["192x192", "512x512", "512x512"]);
  expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBeTruthy();

  for (const asset of [
    "/assets/icons/favicon.svg",
    "/assets/icons/favicon.ico",
    "/assets/icons/apple-touch-icon.png",
    "/assets/icons/icon-192.png",
    "/assets/icons/icon-512.png",
    "/assets/icons/icon-maskable-512.png",
    "/assets/og/rons-recipes-share-1200x630.png",
    "/service-worker.js",
  ]) {
    const response = await request.get(asset);
    expect(response.ok(), `${asset} should load`).toBeTruthy();
  }

  const shareImageSize = await page.evaluate(async () => {
    const image = new Image();
    image.src = "assets/og/rons-recipes-share-1200x630.png";
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(shareImageSize).toEqual({ width: 1200, height: 630 });

  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state;
  }), { timeout: 15_000 }).toBe("activated");

  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload();
    await expect(page.getByRole("heading", { name: "25 recipes" })).toBeVisible();
  }
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBeTruthy();

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "25 recipes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "World's Best Lasagna" })).toBeVisible();
  await context.setOffline(false);
});


test("sticky browsing, collection badges, card accents, back-to-top, and install prompt work", async ({ page }) => {
  await openCleanApp(page);

  await expect(page.getByText("25 Favorites", { exact: true })).toBeVisible();
  await expect(page.getByText("Freezer Rated", { exact: true })).toBeVisible();
  await expect(page.getByText("Works Offline", { exact: true })).toBeVisible();
  await expect(page.locator("#recipe-list article").first()).toHaveAttribute("data-rating", "excellent");

  const toolbar = page.locator("#browse-toolbar");
  const backToTop = page.getByRole("button", { name: "Back to top" });
  await expect(backToTop).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect(toolbar).toHaveClass(/is-stuck/);
  await expect(backToTop).toBeVisible();
  await backToTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(20);
  await expect(backToTop).toBeHidden();

  await page.evaluate(() => {
    const promptEvent = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(promptEvent, {
      prompt: { value: () => Promise.resolve() },
      userChoice: { value: Promise.resolve({ outcome: "accepted" }) },
    });
    window.dispatchEvent(promptEvent);
  });
  const installButton = page.getByRole("button", { name: "Install Ron's Recipes" });
  await expect(installButton).toBeVisible();
  await installButton.click();
  await expect(installButton).toBeHidden();
  await expect(page.getByRole("status")).toContainText("installation started");
});


test("measurement converter handles weight, volume, temperature, swapping, and both entry points", async ({ page }) => {
  await openCleanApp(page);

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("button", { name: "Conversions" }).click();
  const dialog = page.getByRole("dialog", { name: "Kitchen Conversion Guide" });
  await expect(dialog).toBeVisible();

  const amount = dialog.getByLabel("Amount");
  const from = dialog.getByLabel("From");
  const to = dialog.getByLabel("To");
  const result = dialog.locator("#conversion-result");
  await expect(result).toHaveText("3.5274 ounces");

  await amount.fill("1");
  await from.selectOption("oz");
  await to.selectOption("g");
  await expect(result).toHaveText("28.3495 grams");
  await dialog.getByRole("button", { name: "Swap conversion units" }).click();
  await expect(result).toHaveText("0.0353 ounces");

  await dialog.getByLabel("Measurement type").selectOption("volume");
  await expect(from).toHaveValue("cup");
  await expect(to).toHaveValue("ml");
  await expect(result).toHaveText("236.5882 milliliters");

  await dialog.getByLabel("Measurement type").selectOption("temperature");
  await amount.fill("350");
  await expect(result).toHaveText("176.6667 °C");
  await expect(dialog.getByRole("row", { name: "1 ounce 28.35 grams" })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include("#conversion-dialog").analyze();
  expect(accessibility.violations).toEqual([]);

  await dialog.getByRole("button", { name: "Close conversion guide" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("contentinfo").getByRole("button", { name: "Conversions" }).click();
  await expect(dialog).toBeVisible();
});


test("mobile details, touch targets, wrapping, contrast, and accessibility pass", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCleanApp(page);

  const firstRecipe = page.locator("#recipe-list article").first();
  const detailsButton = firstRecipe.getByRole("button", { name: "Show details for World's Best Lasagna" });
  await expect(detailsButton).toBeVisible();
  await expect(firstRecipe.locator(".mobile-details")).toBeHidden();
  await detailsButton.click();
  await expect(firstRecipe.locator(".mobile-details")).toBeVisible();
  await expect(firstRecipe.locator(".mobile-why")).toContainText("benchmark lasagna");
  await expect(firstRecipe.locator(".mobile-freeze")).toContainText("freezer-safe pan");

  const mobileConversionButton = page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Conversions" });
  const conversionButtonBox = await mobileConversionButton.boundingBox();
  expect(conversionButtonBox.width).toBeGreaterThanOrEqual(43.9);
  expect(conversionButtonBox.height).toBeGreaterThanOrEqual(43.9);

  for (const control of [firstRecipe.locator(".recipe-link"), firstRecipe.locator(".copy-recipe"), firstRecipe.locator(".remove-recipe")]) {
    const box = await control.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(43.9);
    expect(box.height).toBeGreaterThanOrEqual(43.9);
  }

  const rankContrast = await firstRecipe.locator(".rank").evaluate((element) => {
    const rgb = (value) => value.match(/[\d.]+/g).map(Number).slice(0, 3);
    const luminance = (value) => rgb(value)
      .map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const style = getComputedStyle(element);
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(rankContrast).toBeGreaterThanOrEqual(4.5);

  const filterLayout = await page.locator(".filter-scroller").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    pageClientWidth: document.documentElement.clientWidth,
    pageScrollWidth: document.documentElement.scrollWidth,
  }));
  expect(filterLayout.scrollWidth).toBeGreaterThan(filterLayout.clientWidth);
  expect(filterLayout.pageScrollWidth).toBeLessThanOrEqual(filterLayout.pageClientWidth + 1);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const mobileBackToTop = page.getByRole("button", { name: "Back to top" });
  await expect(mobileBackToTop).toBeVisible();
  const backToTopBox = await mobileBackToTop.boundingBox();
  expect(backToTopBox.width).toBeGreaterThanOrEqual(44);
  expect(backToTopBox.height).toBeGreaterThanOrEqual(44);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});


test("personal recipes can be added, edited, exported, deleted, and imported", async ({ page }) => {
  await openCleanApp(page);
  await page.getByRole("button", { name: "Add Recipe" }).click();
  await page.getByLabel("Recipe name").fill("Sunday Pot Roast");
  await page.getByRole("combobox", { name: "Freezer rating" }).selectOption("Outstanding");
  await page.getByLabel("Why it belongs in the collection").fill("Tender beef and vegetables in rich gravy.");
  await page.getByLabel("Freeze smart note").fill("Cool completely and freeze in meal-size portions.");
  await page.getByLabel("Original recipe link").fill("https://example.com/pot-roast");
  await page.getByRole("button", { name: "Add to Ron's Recipes" }).click();
  await expect(page.getByRole("heading", { name: "26 recipes" })).toBeVisible();

  await page.getByRole("button", { name: "Edit Sunday Pot Roast" }).click();
  await page.getByLabel("Recipe name").fill("Sunday Pot Roast Updated");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("heading", { name: "Sunday Pot Roast Updated" })).toBeVisible();

  await page.getByRole("button", { name: "Manage" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^rons-recipes-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = await download.path();
  const backupBuffer = await readFile(backupPath);
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Permanently delete Sunday Pot Roast Updated" }).click();
  await expect(page.getByRole("heading", { name: "Permanently delete this recipe?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete Recipe" }).click();
  await expect(page.getByRole("heading", { name: "25 recipes" })).toBeVisible();

  await page.getByRole("button", { name: "Manage" }).click();
  await page.locator("#import-backup-file").setInputFiles({
    name: "rons-recipes-backup.json",
    mimeType: "application/json",
    buffer: backupBuffer,
  });
  await expect(page.getByRole("status").filter({ hasText: "Import complete: 1 added" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "26 recipes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sunday Pot Roast Updated" })).toBeVisible();
});
