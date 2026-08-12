import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";


async function openCleanApp(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "26 recipes" })).toBeVisible();
}


test("search, filters, keyboard tabs, and console remain healthy", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("http://127.0.0.1:9931/health", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4173" },
    body: JSON.stringify({ ok: true }),
  }));

  await openCleanApp(page);
  await expect(page).toHaveTitle("Ron's Recipes");
  await expect(page.locator("#recipe-list article")).toHaveCount(26);

  await page.getByRole("searchbox", { name: "Search recipes" }).fill("chicken");
  await expect(page.getByRole("heading", { name: "13 recipes" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Outstanding", exact: true }).click();
  await expect(page.getByRole("heading", { name: "3 recipes" })).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.locator("#tag-filter").selectOption("Chicken");
  await expect(page.getByRole("heading", { name: "13 recipes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chicken Pot Pie" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("button", { name: "Add Recipe" }).click();
  const formTab = page.getByRole("tab", { name: "Fill in form" });
  const importTab = page.getByRole("tab", { name: "Import URL" });
  const pasteTab = page.getByRole("tab", { name: "Paste recipe" });
  await formTab.focus();
  await formTab.press("ArrowRight");
  await expect(importTab).toBeFocused();
  await expect(importTab).toHaveAttribute("aria-selected", "true");
  await importTab.press("ArrowRight");
  await expect(pasteTab).toBeFocused();
  await expect(pasteTab).toHaveAttribute("aria-selected", "true");
  await page.locator("#paste-recipe").fill("Title: Test Soup\nWhy: Cozy.\nFreezer rating: Good\nFreeze smart: Freeze flat.\nIngredients:\n2 cups stock\n1 onion\nInstructions:\nSimmer the stock and onion.\nServe hot.\nURL: https://example.com/test-soup");
  await page.getByRole("button", { name: "Use Pasted Details" }).click();
  await expect(page.locator("#recipe-ingredients")).toHaveValue("2 cups stock\n1 onion");
  await expect(page.locator("#recipe-instructions")).toHaveValue("Simmer the stock and onion.\nServe hot.");
  await page.getByRole("button", { name: "Cancel" }).click();

  expect(errors).toEqual([]);
});


test("each recipe can print its own details, ingredients, and instructions", async ({ page }) => {
  await openCleanApp(page);
  await expect(page.getByRole("button", { name: /^Print / })).toHaveCount(26);
  await expect(page.getByRole("button", { name: "Print Recipes" })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const printButton = page.getByRole("button", { name: "Print World's Best Lasagna" });
  const printButtonBox = await printButton.boundingBox();
  expect(printButtonBox).not.toBeNull();
  expect(printButtonBox.x).toBeGreaterThanOrEqual(0);
  expect(printButtonBox.x + printButtonBox.width).toBeLessThanOrEqual(390);

  await page.evaluate(() => {
    window.__printCallCount = 0;
    window.print = () => { window.__printCallCount += 1; };
  });
  await printButton.click();
  await expect.poll(() => page.evaluate(() => window.__printCallCount)).toBe(1);
  await expect(page.locator("body")).toHaveClass(/print-single-recipe/);
  await expect(page.locator("#print-recipe-title")).toHaveText("World's Best Lasagna");
  await expect(page.locator("#print-recipe-rating")).toHaveText("Excellent");
  await expect(page.locator("#print-recipe-tags")).toContainText("Italian");
  await expect(page.locator("#print-recipe-ingredients li")).toHaveCount(20);
  await expect(page.locator("#print-recipe-ingredients li").first()).toHaveText("1 pound sweet Italian sausage");
  await expect(page.locator("#print-recipe-instructions li")).toHaveCount(7);
  await expect(page.locator("#print-recipe-instructions li").first()).toHaveText("Brown the sausage, beef, onion, and garlic together in a Dutch oven over medium heat.");
  await expect(page.locator("#print-recipe-link")).toHaveAttribute("href", "https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/");

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#recipe-print-sheet")).toBeVisible();
  await expect(page.locator("main")).toBeHidden();

  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await page.emulateMedia({ media: "screen" });
  await expect(page.locator("body")).not.toHaveClass(/print-single-recipe/);
  await expect(page.locator("#recipe-print-sheet")).toBeHidden();
});


test("recipe edits saved before instructions were added inherit the bundled directions", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("rons-recipes.overrides.v1", JSON.stringify({
      "base:https://www.allrecipes.com/recipe/23600/worlds-best-lasagna": {
        title: "World's Best Lasagna (My Notes)",
        why: "My locally saved lasagna notes.",
        rating: "Excellent",
        tags: ["Italian", "Pasta", "Beef"],
        freeze: "Freeze individual portions.",
        url: "https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/",
        ingredients: ["1 pound sweet Italian sausage"],
      },
    }));
    window.print = () => {};
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "World's Best Lasagna (My Notes)" })).toBeVisible();
  await page.getByRole("button", { name: "Print World's Best Lasagna (My Notes)" }).click();
  await expect(page.locator("#print-recipe-instructions li")).toHaveCount(7);
  await expect(page.locator("#print-recipe-instructions li").first()).toContainText("Brown the sausage");
});


test("Mealie URL import previews and fills the curated recipe form", async ({ page }) => {
  const importedRecipe = {
    title: "Test Kitchen Harvest Soup",
    description: "Tender vegetables in a rich tomato broth.",
    sourceUrl: "https://www.example.com/test-kitchen-harvest-soup",
    image: "https://www.cookingclassy.com/example.jpg",
    recipeYield: "8 servings",
    prepTime: "PT25M",
    cookTime: "PT1H35M",
    totalTime: "PT2H",
    ingredients: ["1 1/2 pounds beef stew meat", "2 tablespoons olive oil", "1 yellow onion, chopped"],
    instructions: ["Brown the beef.", "Add vegetables.", "Simmer until tender."],
    tags: ["American", "Soup", "Weeknight"],
  };
  await page.route("http://127.0.0.1:9931/**", async (route) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const requestUrl = new URL(route.request().url());
    const body = requestUrl.pathname === "/health"
      ? { ok: true, service: "Ron's Recipes Mealie Bridge" }
      : { ok: true, recipe: importedRecipe };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify(body),
    });
  });

  await openCleanApp(page);
  await page.getByRole("button", { name: "Add Recipe" }).click();
  await page.getByRole("tab", { name: "Import URL" }).click();
  await expect(page.locator("#import-message")).toHaveText("Connected securely to Mealie on this PC.");
  await expect(page.locator(".import-heading")).toContainText("allow this site to access your local network");
  await page.getByLabel("Recipe webpage").fill(importedRecipe.sourceUrl);
  await page.getByRole("button", { name: "Preview Recipe" }).click();

  const preview = page.locator("#import-preview");
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("heading", { name: importedRecipe.title })).toBeVisible();
  await expect(preview.locator("#import-preview-yield")).toHaveText("8 servings");
  await expect(preview.locator("#import-preview-prep")).toHaveText("25 min");
  await expect(preview.locator("#import-preview-total")).toHaveText("2 hr");
  await expect(preview.locator("#import-preview-summary")).toContainText("3 ingredients, 3 instruction steps, and 3 suggested tags");
  const accessibility = await new AxeBuilder({ page }).include("#recipe-dialog").analyze();
  expect(accessibility.violations).toEqual([]);

  await preview.getByRole("button", { name: "Use Imported Recipe" }).click();
  await expect(page.getByLabel("Recipe name")).toHaveValue(importedRecipe.title);
  await expect(page.getByLabel("Why it belongs in the collection")).toHaveValue(importedRecipe.description);
  await expect(page.locator("#recipe-tags")).toHaveValue("American, Soup, Weeknight");
  await expect(page.locator("#recipe-ingredients")).toHaveValue(importedRecipe.ingredients.join("\n"));
  await expect(page.locator("#recipe-instructions")).toHaveValue(importedRecipe.instructions.join("\n"));
  await expect(page.getByLabel("Original recipe link")).toHaveValue(importedRecipe.sourceUrl);
  await expect(page.getByLabel("Freeze smart note")).toBeFocused();
  await expect(page.getByLabel("Freeze smart note")).toHaveValue("");
  await expect(page.locator("#form-message")).toContainText("Add your freezer note");

  await page.getByLabel("Freeze smart note").fill("Cool completely and freeze in meal-size portions.");
  await page.getByRole("button", { name: "Add to Ron's Recipes" }).click();
  await expect(page.getByRole("heading", { name: "27 recipes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: importedRecipe.title })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "26 recipes" })).toBeVisible();
  }
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBeTruthy();

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "26 recipes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "World's Best Lasagna" })).toBeVisible();
  await context.setOffline(false);
});


test("sticky browsing, collection badges, card accents, back-to-top, and install prompt work", async ({ page }) => {
  await openCleanApp(page);

  await expect(page.getByText("26 Favorites", { exact: true })).toBeVisible();
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


test("cooking shortcuts, pantry matching, and surprise selection work", async ({ page }) => {
  await openCleanApp(page);

  await expect(page.locator("#day-greeting")).toHaveText(/Good (morning|afternoon|evening), Ron!/);
  await expect(page.locator(".quick-action")).toHaveCount(5);

  await page.locator("#quick-add-recipe").click();
  await expect(page.getByRole("dialog", { name: "Add a Recipe" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.locator("#quick-shopping-list").click();
  await expect(page.getByRole("dialog", { name: "Shopping List" })).toBeVisible();
  await page.getByRole("dialog", { name: "Shopping List" }).getByRole("button", { name: "Done" }).click();

  await page.locator("#quick-pantry-match").click();
  const pantryDialog = page.getByRole("dialog", { name: "What Can I Make?" });
  await pantryDialog.getByLabel("What ingredients do you have?").fill("coriander");
  await pantryDialog.getByRole("button", { name: "Find Recipes" }).click();
  await expect(pantryDialog.getByRole("status")).toContainText("synonyms and close spellings");
  await expect(pantryDialog.locator(".pantry-result")).toContainText("White Chicken Chili Enchilada Casserole");

  await pantryDialog.getByLabel("What ingredients do you have?").fill("chicken, potatoes, cheddr");
  await pantryDialog.getByRole("button", { name: "Find Recipes" }).click();
  await expect(pantryDialog.getByRole("status")).toContainText("matches");
  await expect(pantryDialog.locator(".pantry-result").first()).toContainText("Million Dollar Soup");
  await expect(pantryDialog.locator(".pantry-result").first()).toContainText(/Still needed:/);
  const addMissing = pantryDialog.locator(".pantry-result").first().getByRole("button", { name: /Add missing ingredients/ });
  await addMissing.click();
  await expect(addMissing).toHaveText("Added to List");
  await expect(pantryDialog.getByRole("status")).toContainText("added");
  await expect(page.locator("#quick-shopping-count")).not.toHaveText("0");
  const accessibility = await new AxeBuilder({ page }).include("#pantry-dialog").analyze();
  expect(accessibility.violations).toEqual([]);
  await pantryDialog.locator(".pantry-result").first().getByRole("button", { name: /View/ }).click();
  await expect(page.getByRole("heading", { name: "1 recipe" })).toBeVisible();

  await page.locator("#quick-my-recipes").click();
  await expect(page.getByRole("heading", { name: "26 recipes" })).toBeVisible();
  await page.locator("#quick-surprise").click();
  await expect(page.locator("#recipe-list article.is-surprise")).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText("Tonight's pick:");
  const firstSurprise = await page.locator("#recipe-list article.is-surprise").getAttribute("data-recipe-id");
  await page.locator("#quick-surprise").click();
  await expect(page.locator("#recipe-list article.is-surprise")).not.toHaveAttribute("data-recipe-id", firstSurprise);
});


test("collections can be created, assigned, and used as a recipe filter", async ({ page }) => {
  await openCleanApp(page);

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("button", { name: "Collections" }).click();
  const collectionsDialog = page.getByRole("dialog", { name: "Collections" });
  await expect(collectionsDialog).toBeVisible();
  for (const starter of ["Crockpot", "Easy", "New", "Favorites", "Weeknight"]) {
    await expect(collectionsDialog.locator(".collection-row").filter({ hasText: starter })).toBeVisible();
  }

  await collectionsDialog.getByRole("textbox", { name: "New collection", exact: true }).fill("Sunday Favorites");
  await collectionsDialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(collectionsDialog.locator(".collection-row").filter({ hasText: "Sunday Favorites" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).include("#collections-dialog").analyze();
  expect(accessibility.violations).toEqual([]);
  await collectionsDialog.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Add World's Best Lasagna to collections" }).click();
  const assignmentDialog = page.getByRole("dialog", { name: "Add to Collections" });
  await assignmentDialog.getByRole("checkbox", { name: "Favorites", exact: true }).check();
  await assignmentDialog.getByRole("checkbox", { name: "Sunday Favorites", exact: true }).check();
  await assignmentDialog.getByRole("button", { name: "Save Collections" }).click();

  await navigation.getByRole("button", { name: "Collections" }).click();
  const favoritesRow = collectionsDialog.locator(".collection-row").filter({ hasText: "Favorites" }).first();
  await expect(favoritesRow).toContainText("1 recipe");
  await favoritesRow.getByRole("button", { name: "View recipes in Favorites" }).click();
  await expect(page.getByRole("heading", { name: "1 recipe" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "World's Best Lasagna" })).toBeVisible();
  await page.getByRole("button", { name: "Clear collection filter: Favorites" }).click();
  await expect(page.getByRole("heading", { name: "26 recipes" })).toBeVisible();
});


test("recipe scaling, aisle grouping, and duplicate merging build a persistent shopping list", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openCleanApp(page);

  await page.getByRole("button", { name: "Add ingredients for World's Best Lasagna to the shopping list" }).click();
  const ingredientsDialog = page.getByRole("dialog", { name: "Recipe Ingredients" });
  await expect(ingredientsDialog).toBeVisible();
  await expect(ingredientsDialog.locator("#ingredients-source-note")).toContainText("Loaded from the linked original recipe");
  const ingredientCheckboxes = ingredientsDialog.getByRole("checkbox");
  await expect(ingredientCheckboxes).toHaveCount(20);
  for (const checkbox of await ingredientCheckboxes.all()) await checkbox.uncheck();
  await ingredientsDialog.getByRole("button", { name: "2×" }).click();
  await expect(ingredientsDialog.locator("#ingredient-scale-note")).toHaveText("Double the original amounts");
  await expect(ingredientsDialog.getByRole("checkbox", { name: "2 (28 ounce) cans crushed tomatoes" })).toBeVisible();
  await ingredientsDialog.getByRole("checkbox", { name: "2 pounds sweet Italian sausage" }).check();
  await ingredientsDialog.getByRole("checkbox", { name: "1 cup minced onion" }).check();
  await ingredientsDialog.getByRole("button", { name: "Add to Shopping List" }).click();

  const shoppingDialog = page.getByRole("dialog", { name: "Shopping List" });
  await expect(shoppingDialog).toBeVisible();
  await expect(shoppingDialog.getByRole("heading", { name: "Meat & seafood" })).toBeVisible();
  await expect(shoppingDialog.getByRole("heading", { name: "Produce" })).toBeVisible();
  await expect(shoppingDialog.locator(".shopping-item")).toHaveCount(2);
  await shoppingDialog.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Add ingredients for Salisbury Steak Meatballs to the shopping list" }).click();
  for (const checkbox of await ingredientCheckboxes.all()) await checkbox.uncheck();
  await ingredientsDialog.getByRole("checkbox", { name: "1/2 cup onion, grated" }).check();
  await ingredientsDialog.getByRole("button", { name: "Add to Shopping List" }).click();
  await expect(shoppingDialog.locator(".shopping-item")).toHaveCount(2);
  await shoppingDialog.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Add ingredients for Slow Cooker Zuppa Toscana to the shopping list" }).click();
  for (const checkbox of await ingredientCheckboxes.all()) await checkbox.uncheck();
  await ingredientsDialog.getByRole("checkbox", { name: "1 large yellow onion, chopped" }).check();
  await ingredientsDialog.getByRole("button", { name: "Add to Shopping List" }).click();
  await expect(shoppingDialog.locator(".shopping-item")).toHaveCount(2);
  const mergedOnion = shoppingDialog.locator(".shopping-item").filter({ hasText: "1 cup minced onion" });
  await expect(mergedOnion.getByRole("checkbox", { name: "Onion" })).toBeVisible();
  await expect(mergedOnion).toContainText("1 cup minced onion");
  await expect(mergedOnion).toContainText("World's Best Lasagna");
  await expect(mergedOnion).toContainText("1/2 cup onion, grated");
  await expect(mergedOnion).toContainText("Salisbury Steak Meatballs");
  await expect(mergedOnion).toContainText("1 large yellow onion, chopped");
  await expect(mergedOnion).toContainText("Slow Cooker Zuppa Toscana");

  await shoppingDialog.getByLabel("Add an item").fill("Aluminum foil");
  await shoppingDialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(shoppingDialog.getByRole("heading", { name: "Other" })).toBeVisible();
  await expect(shoppingDialog.locator(".shopping-item")).toHaveCount(3);

  await shoppingDialog.getByRole("checkbox", { name: "2 pounds sweet Italian sausage" }).check();
  await shoppingDialog.getByRole("button", { name: "Clear Checked" }).click();
  await expect(shoppingDialog.locator(".shopping-item")).toHaveCount(2);
  await shoppingDialog.getByRole("button", { name: "Copy List" }).click();
  await expect(shoppingDialog.getByRole("status")).toContainText("Shopping list copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Aluminum foil");

  const savedData = await page.evaluate(() => ({
    ingredients: JSON.parse(localStorage.getItem("rons-recipes.ingredients.v1")),
    shopping: JSON.parse(localStorage.getItem("rons-recipes.shopping.v1")),
  }));
  expect(savedData.ingredients).toBeNull();
  expect(savedData.shopping).toHaveLength(2);
  expect(savedData.shopping.find((item) => item.canonical === "onion").details).toHaveLength(3);
  const accessibility = await new AxeBuilder({ page }).include("#shopping-dialog").analyze();
  expect(accessibility.violations).toEqual([]);

  await shoppingDialog.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Add ingredients for Chicken Pot Pie to the shopping list" }).click();
  await ingredientsDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(ingredientsDialog).toBeHidden();
});


test("backup reminders can be downloaded and snoozed", async ({ page }) => {
  await openCleanApp(page);
  await page.locator("#quick-shopping-list").click();
  const shoppingDialog = page.getByRole("dialog", { name: "Shopping List" });
  await shoppingDialog.getByLabel("Add an item").fill("Coffee filters");
  await shoppingDialog.getByRole("button", { name: "Add", exact: true }).click();
  await shoppingDialog.getByRole("button", { name: "Done" }).click();

  const reminder = page.locator("#backup-reminder");
  await expect(reminder).toBeVisible();
  await expect(reminder).toContainText("no backup yet");
  const downloadPromise = page.waitForEvent("download");
  await reminder.getByRole("button", { name: "Download Backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^rons-recipes-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(reminder).toBeHidden();

  await page.evaluate(() => {
    localStorage.setItem("rons-recipes.backup.last.v1", new Date(Date.now() - 15 * 86400000).toISOString());
    localStorage.removeItem("rons-recipes.backup.snooze.v1");
  });
  await page.locator("#quick-shopping-list").click();
  await shoppingDialog.getByRole("button", { name: "Done" }).click();
  await expect(reminder).toBeVisible();
  await expect(reminder).toContainText("15 days ago");
  await reminder.getByRole("button", { name: "Remind me in 3 days" }).click();
  await expect(reminder).toBeHidden();
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

  const mobileNavigation = page.getByRole("navigation", { name: "Main navigation" });
  const mobileConversionButton = mobileNavigation.getByRole("button", { name: "Conversions" });
  const conversionButtonBox = await mobileConversionButton.boundingBox();
  expect(conversionButtonBox.width).toBeGreaterThanOrEqual(43.9);
  expect(conversionButtonBox.height).toBeGreaterThanOrEqual(43.9);

  for (const control of [
    mobileNavigation.getByRole("button", { name: "Collections" }),
    mobileNavigation.getByRole("button", { name: "Shopping List" }),
    page.locator(".quick-action").first(),
    firstRecipe.locator(".recipe-link"),
    firstRecipe.locator(".collection-recipe"),
    firstRecipe.locator(".shopping-recipe"),
    firstRecipe.locator(".copy-recipe"),
    firstRecipe.locator(".remove-recipe"),
  ]) {
    const box = await control.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(43.9);
    expect(box.height).toBeGreaterThanOrEqual(43.9);
  }

  const quickActionLayout = await page.locator(".quick-actions").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(quickActionLayout.scrollWidth).toBeGreaterThan(quickActionLayout.clientWidth);

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


test("bundled recipes can be edited locally, persist, and round-trip in a backup", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: "26 recipes" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(26);

  await page.getByRole("button", { name: "Edit World's Best Lasagna" }).click();
  await expect(page.getByRole("heading", { name: "Edit Saved Recipe" })).toBeVisible();
  await expect(page.locator("#recipe-ingredients")).not.toHaveValue("");
  await expect(page.locator("#recipe-instructions")).not.toHaveValue("");
  await page.getByLabel("Recipe name").fill("World's Best Lasagna (Edited)");
  await page.getByLabel("Why it belongs in the collection").fill("Ron's locally edited lasagna notes.");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("heading", { name: "World's Best Lasagna (Edited)" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "World's Best Lasagna (Edited)" })).toBeVisible();
  await page.getByRole("button", { name: "Manage" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Backup" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  const backupBuffer = await readFile(backupPath);
  const backup = JSON.parse(backupBuffer.toString("utf8"));
  expect(backup.version).toBe(4);
  expect(Object.values(backup.recipeOverrides)).toContainEqual(expect.objectContaining({
    title: "World's Best Lasagna (Edited)",
    instructions: expect.arrayContaining([expect.stringContaining("Brown the sausage")]),
  }));

  await page.getByRole("button", { name: "Done" }).click();
  await page.evaluate(() => localStorage.removeItem("rons-recipes.overrides.v1"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "World's Best Lasagna" })).toBeVisible();
  await page.getByRole("button", { name: "Manage" }).click();
  await page.locator("#import-backup-file").setInputFiles({
    name: "rons-recipes-backup.json",
    mimeType: "application/json",
    buffer: backupBuffer,
  });
  await expect(page.getByRole("status").filter({ hasText: "1 recipe edits" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "World's Best Lasagna (Edited)" })).toBeVisible();
});


test("personal recipes can be added, edited, exported, deleted, and imported", async ({ page }) => {
  await openCleanApp(page);
  await page.getByRole("button", { name: "Add Recipe" }).click();
  await page.getByLabel("Recipe name").fill("Sunday Pot Roast");
  await page.getByRole("combobox", { name: "Freezer rating" }).selectOption("Outstanding");
  await page.getByLabel("Why it belongs in the collection").fill("Tender beef and vegetables in rich gravy.");
  await page.getByLabel("Freeze smart note").fill("Cool completely and freeze in meal-size portions.");
  await page.locator("#recipe-ingredients").fill("2 pounds chuck roast\n1 onion, chopped");
  await page.locator("#recipe-instructions").fill("Brown the roast.\nCook with the onion until tender.");
  await page.locator("#recipe-tags").fill("American, Beef, Slow cooker");
  await page.getByLabel("Original recipe link").fill("https://example.com/pot-roast");
  await page.getByRole("button", { name: "Add to Ron's Recipes" }).click();
  await expect(page.getByRole("heading", { name: "27 recipes" })).toBeVisible();

  await page.getByRole("button", { name: "Edit Sunday Pot Roast" }).click();
  await expect(page.locator("#recipe-ingredients")).toHaveValue("2 pounds chuck roast\n1 onion, chopped");
  await expect(page.locator("#recipe-instructions")).toHaveValue("Brown the roast.\nCook with the onion until tender.");
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
  const backup = JSON.parse(backupBuffer.toString("utf8"));
  expect(backup.version).toBe(4);
  expect(backup).toMatchObject({ collections: expect.any(Array), shoppingItems: expect.any(Array), ingredientOverrides: expect.any(Object) });
  expect(backup.customRecipes[0].ingredients).toEqual(["2 pounds chuck roast", "1 onion, chopped"]);
  expect(backup.customRecipes[0].instructions).toEqual(["Brown the roast.", "Cook with the onion until tender."]);
  expect(backup.customRecipes[0].tags).toEqual(["American", "Beef", "Slow cooker"]);
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Permanently delete Sunday Pot Roast Updated" }).click();
  await expect(page.getByRole("heading", { name: "Permanently delete this recipe?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete Recipe" }).click();
  await expect(page.getByRole("heading", { name: "26 recipes" })).toBeVisible();

  await page.getByRole("button", { name: "Manage" }).click();
  await page.locator("#import-backup-file").setInputFiles({
    name: "rons-recipes-backup.json",
    mimeType: "application/json",
    buffer: backupBuffer,
  });
  await expect(page.getByRole("status").filter({ hasText: "Import complete: 1 added" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "27 recipes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sunday Pot Roast Updated" })).toBeVisible();
  await page.getByRole("button", { name: "Add ingredients for Sunday Pot Roast Updated to the shopping list" }).click();
  await expect(page.getByRole("checkbox", { name: "2 pounds chuck roast" })).toBeVisible();
});
