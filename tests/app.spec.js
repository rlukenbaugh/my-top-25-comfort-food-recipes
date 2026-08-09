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

  for (const control of [firstRecipe.locator(".recipe-link"), firstRecipe.locator(".copy-recipe"), firstRecipe.locator(".remove-recipe")]) {
    const box = await control.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
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

  const filterLayout = await page.locator(".filters").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(filterLayout.scrollWidth).toBeLessThanOrEqual(filterLayout.clientWidth + 1);

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
