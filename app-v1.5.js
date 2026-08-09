const STORAGE_KEY = "rons-recipes.custom.v1";
const REMOVED_STORAGE_KEY = "rons-recipes.removed.v1";
const COLLECTIONS_STORAGE_KEY = "rons-recipes.collections.v1";
const SHOPPING_STORAGE_KEY = "rons-recipes.shopping.v1";
const INGREDIENTS_STORAGE_KEY = "rons-recipes.ingredients.v1";
const BACKUP_FORMAT = "rons-recipes-backup";
const BACKUP_VERSION = 2;
const STARTER_COLLECTIONS = ["Crockpot", "Easy", "New", "Favorites", "Weeknight"];
const RATINGS = ["Outstanding", "Excellent", "Very good", "Good", "Fair"];
const CONVERSION_UNITS = {
  weight: [
    { value: "g", label: "Grams", one: "gram", many: "grams", factor: 1 },
    { value: "oz", label: "Ounces", one: "ounce", many: "ounces", factor: 28.349523125 },
    { value: "kg", label: "Kilograms", one: "kilogram", many: "kilograms", factor: 1000 },
    { value: "lb", label: "Pounds", one: "pound", many: "pounds", factor: 453.59237 },
  ],
  volume: [
    { value: "cup", label: "US cups", one: "cup", many: "cups", factor: 236.5882365 },
    { value: "ml", label: "Milliliters", one: "milliliter", many: "milliliters", factor: 1 },
    { value: "l", label: "Liters", one: "liter", many: "liters", factor: 1000 },
    { value: "floz", label: "US fluid ounces", one: "fluid ounce", many: "fluid ounces", factor: 29.5735295625 },
    { value: "tbsp", label: "US tablespoons", one: "tablespoon", many: "tablespoons", factor: 14.78676478125 },
    { value: "tsp", label: "US teaspoons", one: "teaspoon", many: "teaspoons", factor: 4.92892159375 },
  ],
  temperature: [
    { value: "f", label: "Fahrenheit (°F)", one: "°F", many: "°F" },
    { value: "c", label: "Celsius (°C)", one: "°C", many: "°C" },
  ],
};
let deferredInstallPrompt = null;

const state = {
  baseRecipes: [],
  customRecipes: [],
  allRecipes: [],
  recipes: [],
  removedKeys: new Set(),
  query: "",
  rating: "All",
  collectionId: null,
  collections: [],
  shoppingItems: [],
  ingredientOverrides: {},
  collectionRecipe: null,
  ingredientRecipe: null,
  surpriseRecipeKey: null,
  editingRecipeId: null,
};

const elements = {
  list: document.querySelector("#recipe-list"),
  template: document.querySelector("#recipe-template"),
  search: document.querySelector("#search"),
  filters: [...document.querySelectorAll(".filter")],
  resultCount: document.querySelector("#result-count"),
  resultNoun: document.querySelector("#result-noun"),
  recipeCounts: [...document.querySelectorAll("[data-recipe-count]")],
  clearFilters: document.querySelector("#clear-filters"),
  restoreRemoved: document.querySelector("#restore-removed"),
  removedCount: document.querySelector("#removed-count"),
  browseToolbar: document.querySelector("#browse-toolbar"),
  backToTop: document.querySelector("#back-to-top"),
  installApp: document.querySelector("#install-app"),
  brand: document.querySelector(".brand"),
  dayGreeting: document.querySelector("#day-greeting"),
  quickAddRecipe: document.querySelector("#quick-add-recipe"),
  quickMyRecipes: document.querySelector("#quick-my-recipes"),
  quickShoppingList: document.querySelector("#quick-shopping-list"),
  quickPantryMatch: document.querySelector("#quick-pantry-match"),
  quickSurprise: document.querySelector("#quick-surprise"),
  quickRecipeCount: document.querySelector("#quick-recipe-count"),
  quickShoppingCount: document.querySelector("#quick-shopping-count"),
  openCollections: [...document.querySelectorAll("#open-collections, [data-footer-collections]")],
  openShopping: [...document.querySelectorAll("#open-shopping, [data-footer-shopping]")],
  activeCollectionFilter: document.querySelector("#active-collection-filter"),
  activeCollectionName: document.querySelector("#active-collection-filter span"),
  openConversions: [...document.querySelectorAll("[data-open-conversions]")],
  conversionDialog: document.querySelector("#conversion-dialog"),
  closeConversions: document.querySelector("#close-conversions"),
  conversionType: document.querySelector("#conversion-type"),
  conversionValue: document.querySelector("#conversion-value"),
  conversionFrom: document.querySelector("#conversion-from"),
  conversionTo: document.querySelector("#conversion-to"),
  conversionResult: document.querySelector("#conversion-result"),
  swapConversionUnits: document.querySelector("#swap-conversion-units"),
  emptyState: document.querySelector("#empty-state"),
  clearButtons: [...document.querySelectorAll("[data-clear]")],
  pdfLinks: [...document.querySelectorAll("[data-pdf-link]")],
  openManager: document.querySelector("#open-manager"),
  openAdd: document.querySelector("#open-add-recipe"),
  dialog: document.querySelector("#recipe-dialog"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogDescription: document.querySelector("#dialog-description"),
  closeDialog: document.querySelector("#close-dialog"),
  cancelAdd: document.querySelector("#cancel-add"),
  form: document.querySelector("#recipe-form"),
  entryTabs: document.querySelector("#entry-tabs"),
  formTab: document.querySelector("#form-tab"),
  pasteTab: document.querySelector("#paste-tab"),
  pastePanel: document.querySelector("#paste-panel"),
  pasteInput: document.querySelector("#paste-recipe"),
  cancelPaste: document.querySelector("#cancel-paste"),
  usePasted: document.querySelector("#use-pasted-recipe"),
  pasteMessage: document.querySelector("#paste-message"),
  formMessage: document.querySelector("#form-message"),
  titleInput: document.querySelector("#recipe-title"),
  whyInput: document.querySelector("#recipe-why"),
  ratingInput: document.querySelector("#recipe-rating"),
  freezeInput: document.querySelector("#recipe-freeze"),
  urlInput: document.querySelector("#recipe-url"),
  ingredientsInput: document.querySelector("#recipe-ingredients"),
  deviceNote: document.querySelector("#recipe-device-note"),
  submitRecipe: document.querySelector("#submit-recipe"),
  manageDialog: document.querySelector("#manage-dialog"),
  closeManager: document.querySelector("#close-manager"),
  doneManager: document.querySelector("#done-manager"),
  manageSummary: document.querySelector("#manage-summary"),
  exportBackup: document.querySelector("#export-backup"),
  importBackup: document.querySelector("#import-backup"),
  importBackupFile: document.querySelector("#import-backup-file"),
  manageMessage: document.querySelector("#manage-message"),
  toast: document.querySelector("#toast"),
  removeDialog: document.querySelector("#remove-dialog"),
  removeDialogTitle: document.querySelector("#remove-dialog-title"),
  removeDialogCopy: document.querySelector("#remove-dialog-copy"),
  removeDialogNote: document.querySelector("#remove-dialog-note"),
  removeRecipeTitle: document.querySelector("#remove-recipe-title"),
  cancelRemove: document.querySelector("#cancel-remove"),
  confirmRemove: document.querySelector("#confirm-remove"),
  collectionsDialog: document.querySelector("#collections-dialog"),
  closeCollections: document.querySelector("#close-collections"),
  doneCollections: document.querySelector("#done-collections"),
  createCollectionForm: document.querySelector("#create-collection-form"),
  newCollectionName: document.querySelector("#new-collection-name"),
  collectionsSummary: document.querySelector("#collections-summary"),
  collectionsList: document.querySelector("#collections-list"),
  collectionsMessage: document.querySelector("#collections-message"),
  recipeCollectionsDialog: document.querySelector("#recipe-collections-dialog"),
  closeRecipeCollections: document.querySelector("#close-recipe-collections"),
  cancelRecipeCollections: document.querySelector("#cancel-recipe-collections"),
  saveRecipeCollections: document.querySelector("#save-recipe-collections"),
  recipeCollectionsName: document.querySelector("#recipe-collections-name"),
  recipeCollectionOptions: document.querySelector("#recipe-collection-options"),
  quickCreateCollectionForm: document.querySelector("#quick-create-collection-form"),
  quickCollectionName: document.querySelector("#quick-collection-name"),
  recipeCollectionsMessage: document.querySelector("#recipe-collections-message"),
  ingredientsDialog: document.querySelector("#ingredients-dialog"),
  closeIngredients: document.querySelector("#close-ingredients"),
  ingredientsRecipeName: document.querySelector("#ingredients-recipe-name"),
  ingredientsSourceNote: document.querySelector("#ingredients-source-note"),
  ingredientsSourceLink: document.querySelector("#ingredients-source-link"),
  ingredientsEditor: document.querySelector("#ingredients-editor"),
  ingredientsText: document.querySelector("#ingredients-text"),
  saveIngredients: document.querySelector("#save-ingredients"),
  ingredientsPicker: document.querySelector("#ingredients-picker"),
  ingredientsOptions: document.querySelector("#ingredients-options"),
  ingredientsMessage: document.querySelector("#ingredients-message"),
  editIngredients: document.querySelector("#edit-ingredients"),
  cancelIngredients: document.querySelector("#cancel-ingredients"),
  addSelectedShopping: document.querySelector("#add-selected-shopping"),
  shoppingDialog: document.querySelector("#shopping-dialog"),
  closeShopping: document.querySelector("#close-shopping"),
  doneShopping: document.querySelector("#done-shopping"),
  manualShoppingForm: document.querySelector("#manual-shopping-form"),
  manualShoppingItem: document.querySelector("#manual-shopping-item"),
  shoppingSummary: document.querySelector("#shopping-summary"),
  shoppingEmpty: document.querySelector("#shopping-empty"),
  shoppingList: document.querySelector("#shopping-list"),
  shoppingMessage: document.querySelector("#shopping-message"),
  copyShopping: document.querySelector("#copy-shopping"),
  printShopping: document.querySelector("#print-shopping"),
  clearCheckedShopping: document.querySelector("#clear-checked-shopping"),
  pantryDialog: document.querySelector("#pantry-dialog"),
  closePantry: document.querySelector("#close-pantry"),
  donePantry: document.querySelector("#done-pantry"),
  pantryForm: document.querySelector("#pantry-form"),
  pantryIngredients: document.querySelector("#pantry-ingredients"),
  pantryMessage: document.querySelector("#pantry-message"),
  pantryResults: document.querySelector("#pantry-results"),
};

function normalizedRating(rating) {
  return String(rating).replace("*", "").trim();
}

function normalizeUrl(url) {
  return String(url).trim().replace(/\/$/, "").toLocaleLowerCase();
}

function makeCustomId() {
  return globalThis.crypto?.randomUUID?.() || `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeLocalId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function parseIngredientLines(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : String(value || "").split(/\r?\n/))
    .map((item) => String(item).trim())
    .filter((item) => {
      const key = item.toLocaleLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isValidCustomRecipe(recipe) {
  return recipe &&
    typeof recipe.title === "string" && recipe.title.trim() &&
    typeof recipe.why === "string" && recipe.why.trim() &&
    typeof recipe.freeze === "string" && recipe.freeze.trim() &&
    typeof recipe.url === "string" && /^https?:\/\//i.test(recipe.url) &&
    RATINGS.includes(normalizedRating(recipe.rating)) &&
    (recipe.ingredients === undefined || Array.isArray(recipe.ingredients));
}

function loadCustomRecipes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(isValidCustomRecipe) : [];
  } catch (error) {
    console.warn("Saved recipes could not be read.", error);
    return [];
  }
}

function saveCustomRecipes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.customRecipes));
    return true;
  } catch (error) {
    console.error("Saved recipes could not be written.", error);
    showToast("Changes could not be saved on this device");
    return false;
  }
}

function loadRemovedKeys() {
  try {
    const saved = JSON.parse(localStorage.getItem(REMOVED_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved.filter((key) => typeof key === "string") : []);
  } catch (error) {
    console.warn("Removed recipes could not be read.", error);
    return new Set();
  }
}

function saveRemovedKeys() {
  try {
    localStorage.setItem(REMOVED_STORAGE_KEY, JSON.stringify([...state.removedKeys]));
    return true;
  } catch (error) {
    console.error("Hidden recipes could not be written.", error);
    showToast("Changes could not be saved on this device");
    return false;
  }
}

function starterCollections() {
  return STARTER_COLLECTIONS.map((name) => ({ id: makeLocalId("collection"), name, recipeKeys: [] }));
}

function normalizeCollection(collection) {
  const name = String(collection?.name || "").trim();
  if (!name) return null;
  return {
    id: typeof collection?.id === "string" && collection.id.trim() ? collection.id.trim() : makeLocalId("collection"),
    name,
    recipeKeys: [...new Set(Array.isArray(collection?.recipeKeys) ? collection.recipeKeys.filter((key) => typeof key === "string") : [])],
  };
}

function loadCollections() {
  try {
    const stored = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    if (stored === null) return starterCollections();
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeCollection).filter(Boolean) : starterCollections();
  } catch (error) {
    console.warn("Collections could not be read.", error);
    return starterCollections();
  }
}

function saveCollections() {
  try {
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(state.collections));
    return true;
  } catch (error) {
    console.error("Collections could not be written.", error);
    showToast("Collections could not be saved on this device");
    return false;
  }
}

function normalizeShoppingItem(item) {
  const text = String(item?.text || "").trim();
  if (!text) return null;
  return {
    id: typeof item?.id === "string" && item.id.trim() ? item.id.trim() : makeLocalId("item"),
    text,
    checked: Boolean(item?.checked),
    recipeKey: typeof item?.recipeKey === "string" ? item.recipeKey : null,
    recipeTitle: String(item?.recipeTitle || "Other items").trim() || "Other items",
  };
}

function loadShoppingItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHOPPING_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeShoppingItem).filter(Boolean) : [];
  } catch (error) {
    console.warn("Shopping list could not be read.", error);
    return [];
  }
}

function saveShoppingItems() {
  try {
    localStorage.setItem(SHOPPING_STORAGE_KEY, JSON.stringify(state.shoppingItems));
    return true;
  } catch (error) {
    console.error("Shopping list could not be written.", error);
    showToast("Shopping list could not be saved on this device");
    return false;
  }
}

function loadIngredientOverrides() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INGREDIENTS_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed)
      .map(([key, value]) => [key, parseIngredientLines(value)])
      .filter(([, value]) => value.length));
  } catch (error) {
    console.warn("Recipe ingredients could not be read.", error);
    return {};
  }
}

function saveIngredientOverrides() {
  try {
    localStorage.setItem(INGREDIENTS_STORAGE_KEY, JSON.stringify(state.ingredientOverrides));
    return true;
  } catch (error) {
    console.error("Recipe ingredients could not be written.", error);
    showToast("Ingredients could not be saved on this device");
    return false;
  }
}

function ingredientsForRecipe(recipe) {
  if (!recipe) return [];
  if (recipe.custom) return parseIngredientLines(recipe.ingredients);
  return parseIngredientLines(state.ingredientOverrides[recipeKey(recipe)] || recipe.ingredients);
}

function recipeKey(recipe) {
  return recipe.id ? `custom:${recipe.id}` : `base:${normalizeUrl(recipe.url)}`;
}

function mergeRecipes() {
  const highestBaseRank = Math.max(0, ...state.baseRecipes.map((recipe) => Number(recipe.rank) || 0));
  state.customRecipes = state.customRecipes.map((recipe, index) => ({
    ...recipe,
    rank: highestBaseRank + index + 1,
    custom: true,
  }));
  state.allRecipes = [...state.baseRecipes, ...state.customRecipes].sort((a, b) => Number(a.rank) - Number(b.rank));
  const validKeys = new Set(state.allRecipes.map(recipeKey));
  state.removedKeys = new Set([...state.removedKeys].filter((key) => validKeys.has(key)));
  state.recipes = state.allRecipes.filter((recipe) => !state.removedKeys.has(recipeKey(recipe)));
  elements.recipeCounts.forEach((element) => { element.textContent = state.recipes.length; });
  elements.quickRecipeCount.textContent = state.recipes.length;
  elements.quickShoppingCount.textContent = state.shoppingItems.length;
  elements.removedCount.textContent = state.removedKeys.size;
  elements.restoreRemoved.hidden = state.removedKeys.size === 0;
}

function filteredRecipes() {
  const query = state.query.toLocaleLowerCase();
  const activeCollection = state.collections.find((collection) => collection.id === state.collectionId);
  const collectionKeys = activeCollection ? new Set(activeCollection.recipeKeys) : null;
  return state.recipes.filter((recipe) => {
    const matchesRating = state.rating === "All" || normalizedRating(recipe.rating) === state.rating;
    const haystack = [recipe.title, recipe.why, recipe.freeze, recipe.rating].join(" ").toLocaleLowerCase();
    const matchesCollection = !collectionKeys || collectionKeys.has(recipeKey(recipe));
    return matchesRating && matchesCollection && (!query || haystack.includes(query));
  });
}

function formatRecipeForCopy(recipe) {
  const lines = [
    `Title: ${recipe.title}`,
    `Why: ${recipe.why}`,
    `Freezer rating: ${normalizedRating(recipe.rating)}`,
    `Freeze smart: ${recipe.freeze}`,
  ];
  const ingredients = ingredientsForRecipe(recipe);
  if (ingredients.length) lines.push(`Ingredients:\n${ingredients.join("\n")}`);
  lines.push(`URL: ${recipe.url}`);
  return lines.join("\n");
}

async function writeToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.append(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 2400);
}

function updateScrollEnhancements() {
  const toolbarTop = elements.browseToolbar.getBoundingClientRect().top;
  elements.browseToolbar.classList.toggle("is-stuck", toolbarTop <= 1 && window.scrollY > 0);
  elements.backToTop.hidden = window.scrollY <= Math.max(520, window.innerHeight * 0.75);
}

let scrollFrame = 0;
function scheduleScrollUpdate() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    updateScrollEnhancements();
  });
}

function restoreHashPosition() {
  if (!location.hash) return;
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ block: "start" });
    scheduleScrollUpdate();
  });
}

async function installApp() {
  if (!deferredInstallPrompt) return;
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  elements.installApp.hidden = true;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  if (choice.outcome === "accepted") showToast("Ron's Recipes installation started");
}

function conversionUnit(unitValue) {
  return CONVERSION_UNITS[elements.conversionType.value].find((unit) => unit.value === unitValue);
}

function populateConversionUnits() {
  const units = CONVERSION_UNITS[elements.conversionType.value];
  const options = units.map((unit) => new Option(unit.label, unit.value));
  elements.conversionFrom.replaceChildren(...options.map((option) => option.cloneNode(true)));
  elements.conversionTo.replaceChildren(...options);
  elements.conversionFrom.value = units[0].value;
  elements.conversionTo.value = units[1].value;
}

function convertedValue(value, from, to) {
  if (elements.conversionType.value === "temperature") {
    if (from.value === to.value) return value;
    return from.value === "f" ? (value - 32) * 5 / 9 : value * 9 / 5 + 32;
  }
  return value * from.factor / to.factor;
}

function updateConversion() {
  const value = Number(elements.conversionValue.value);
  const from = conversionUnit(elements.conversionFrom.value);
  const to = conversionUnit(elements.conversionTo.value);
  if (!Number.isFinite(value) || !from || !to) {
    elements.conversionResult.textContent = "Enter an amount";
    return;
  }
  const result = convertedValue(value, from, to);
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(result);
  const unitName = Math.abs(result) === 1 ? to.one : to.many;
  elements.conversionResult.textContent = `${formatted} ${unitName}`;
}

function openConversions() {
  elements.conversionDialog.showModal();
  elements.conversionValue.focus();
  elements.conversionValue.select();
}

function closeConversions() {
  elements.conversionDialog.close();
}

function changeConversionType() {
  populateConversionUnits();
  updateConversion();
}

function swapConversionUnits() {
  const previousFrom = elements.conversionFrom.value;
  elements.conversionFrom.value = elements.conversionTo.value;
  elements.conversionTo.value = previousFrom;
  updateConversion();
}

async function copyRecipe(recipe) {
  try {
    await writeToClipboard(formatRecipeForCopy(recipe));
    showToast(`${recipe.title} copied`);
  } catch (error) {
    console.error("Recipe could not be copied.", error);
    showToast("Copy failed - please try again");
  }
}

let pendingRemoval = null;
let pendingRemovalMode = "hide";
function openRemoveDialog(recipe, mode = "hide") {
  pendingRemoval = recipe;
  pendingRemovalMode = mode;
  elements.removeRecipeTitle.textContent = recipe.title;
  if (mode === "delete") {
    elements.removeDialogTitle.textContent = "Permanently delete this recipe?";
    elements.removeDialogCopy.replaceChildren(elements.removeRecipeTitle, document.createTextNode(" will be permanently deleted from this device."));
    elements.removeDialogNote.textContent = "This cannot be restored unless it is included in a backup you exported earlier.";
    elements.confirmRemove.textContent = "Delete Recipe";
  } else {
    elements.removeDialogTitle.textContent = "Remove this recipe?";
    elements.removeDialogCopy.replaceChildren(elements.removeRecipeTitle, document.createTextNode(" will be hidden on this device."));
    elements.removeDialogNote.textContent = "You can bring it back later with Restore Removed. The shared collection and printable PDF will not change.";
    elements.confirmRemove.textContent = "Remove Recipe";
  }
  elements.removeDialog.showModal();
  elements.cancelRemove.focus();
}

function closeRemoveDialog() {
  pendingRemoval = null;
  pendingRemovalMode = "hide";
  elements.removeDialog.close();
}

function removeRecipe() {
  if (!pendingRemoval) return;
  const removedTitle = pendingRemoval.title;

  if (pendingRemovalMode === "delete" && pendingRemoval.custom) {
    const previousCustomRecipes = state.customRecipes;
    const previousRemovedKeys = new Set(state.removedKeys);
    const previousCollections = state.collections.map((collection) => ({ ...collection, recipeKeys: [...collection.recipeKeys] }));
    const previousShoppingItems = state.shoppingItems;
    const previousIngredientOverrides = { ...state.ingredientOverrides };
    const deletedKey = recipeKey(pendingRemoval);
    state.customRecipes = state.customRecipes.filter((recipe) => recipe.id !== pendingRemoval.id);
    state.removedKeys.delete(deletedKey);
    state.collections = state.collections.map((collection) => ({ ...collection, recipeKeys: collection.recipeKeys.filter((key) => key !== deletedKey) }));
    state.shoppingItems = state.shoppingItems.filter((item) => item.recipeKey !== deletedKey);
    delete state.ingredientOverrides[deletedKey];
    mergeRecipes();
    if (!saveCustomRecipes() || !saveRemovedKeys() || !saveCollections() || !saveShoppingItems() || !saveIngredientOverrides()) {
      state.customRecipes = previousCustomRecipes;
      state.removedKeys = previousRemovedKeys;
      state.collections = previousCollections;
      state.shoppingItems = previousShoppingItems;
      state.ingredientOverrides = previousIngredientOverrides;
      mergeRecipes();
      saveCustomRecipes();
      saveRemovedKeys();
      saveCollections();
      saveShoppingItems();
      saveIngredientOverrides();
      render();
      return;
    }
    render();
    closeRemoveDialog();
    updateManageSummary();
    showToast(`${removedTitle} permanently deleted`);
    return;
  }

  const previousRemovedKeys = new Set(state.removedKeys);
  state.removedKeys.add(recipeKey(pendingRemoval));
  if (!saveRemovedKeys()) {
    state.removedKeys = previousRemovedKeys;
    return;
  }
  mergeRecipes();
  render();
  closeRemoveDialog();
  showToast(`${removedTitle} removed`);
}

function restoreRemovedRecipes() {
  const restoredCount = state.removedKeys.size;
  if (!restoredCount) return;
  const previousRemovedKeys = new Set(state.removedKeys);
  state.removedKeys.clear();
  if (!saveRemovedKeys()) {
    state.removedKeys = previousRemovedKeys;
    return;
  }
  mergeRecipes();
  render();
  showToast(`${restoredCount} ${restoredCount === 1 ? "recipe" : "recipes"} restored`);
}

function createRecipeRow(recipe, displayRank) {
  const row = elements.template.content.firstElementChild.cloneNode(true);
  row.dataset.recipeId = recipe.id || `base-${recipe.rank}`;
  row.dataset.rating = normalizedRating(recipe.rating).toLocaleLowerCase().replace(/\s+/g, "-");
  row.classList.toggle("is-surprise", state.surpriseRecipeKey === recipeKey(recipe));
  row.querySelector(".rank").textContent = displayRank;
  row.querySelector(".recipe-title").textContent = recipe.title;
  row.querySelector(".recipe-why").textContent = recipe.why;
  row.querySelector(".recipe-rating strong").textContent = normalizedRating(recipe.rating);
  row.querySelector(".recipe-freeze p").textContent = recipe.freeze;
  row.querySelector(".mobile-why").textContent = recipe.why;
  row.querySelector(".mobile-freeze").textContent = recipe.freeze;

  const mobileDetails = row.querySelector(".mobile-details");
  const detailsButton = row.querySelector(".details-toggle");
  const detailsId = `details-${row.dataset.recipeId.replace(/[^a-z0-9_-]/gi, "-")}`;
  mobileDetails.id = detailsId;
  detailsButton.setAttribute("aria-controls", detailsId);
  detailsButton.setAttribute("aria-label", `Show details for ${recipe.title}`);
  detailsButton.addEventListener("click", () => {
    const expanded = detailsButton.getAttribute("aria-expanded") === "true";
    detailsButton.setAttribute("aria-expanded", String(!expanded));
    detailsButton.setAttribute("aria-label", `${expanded ? "Show" : "Hide"} details for ${recipe.title}`);
    detailsButton.querySelector("span").textContent = expanded ? "Details" : "Hide details";
    mobileDetails.hidden = expanded;
  });

  const link = row.querySelector(".recipe-link");
  link.href = recipe.url;
  link.setAttribute("aria-label", `Open original recipe for ${recipe.title}`);

  const copyButton = row.querySelector(".copy-recipe");
  copyButton.setAttribute("aria-label", `Copy ${recipe.title}`);
  copyButton.addEventListener("click", () => copyRecipe(recipe));

  const collectionButton = row.querySelector(".collection-recipe");
  collectionButton.setAttribute("aria-label", `Add ${recipe.title} to collections`);
  collectionButton.addEventListener("click", () => openRecipeCollections(recipe));

  const shoppingButton = row.querySelector(".shopping-recipe");
  shoppingButton.setAttribute("aria-label", `Add ingredients for ${recipe.title} to the shopping list`);
  shoppingButton.addEventListener("click", () => openIngredients(recipe));

  const removeButton = row.querySelector(".remove-recipe");
  removeButton.setAttribute("aria-label", `Remove ${recipe.title}`);
  removeButton.addEventListener("click", () => openRemoveDialog(recipe));

  if (recipe.custom) {
    const editButton = row.querySelector(".edit-recipe");
    const deleteButton = row.querySelector(".delete-recipe");
    editButton.hidden = false;
    editButton.setAttribute("aria-label", `Edit ${recipe.title}`);
    editButton.addEventListener("click", () => openDialog(recipe));
    deleteButton.hidden = false;
    deleteButton.setAttribute("aria-label", `Permanently delete ${recipe.title}`);
    deleteButton.addEventListener("click", () => openRemoveDialog(recipe, "delete"));
    removeButton.hidden = true;
  }

  return row;
}

function render() {
  const recipes = filteredRecipes();
  const displayRanks = new Map(state.recipes.map((recipe, index) => [recipeKey(recipe), index + 1]));
  const fragment = document.createDocumentFragment();
  recipes.forEach((recipe) => fragment.append(createRecipeRow(recipe, displayRanks.get(recipeKey(recipe)))));
  elements.list.replaceChildren(fragment);
  elements.list.setAttribute("aria-busy", "false");
  elements.resultCount.textContent = recipes.length;
  elements.resultNoun.textContent = recipes.length === 1 ? "recipe" : "recipes";
  const activeCollection = state.collections.find((collection) => collection.id === state.collectionId);
  if (state.collectionId && !activeCollection) state.collectionId = null;
  elements.activeCollectionFilter.hidden = !activeCollection;
  elements.activeCollectionName.textContent = activeCollection ? activeCollection.name : "";
  if (activeCollection) elements.activeCollectionFilter.setAttribute("aria-label", `Clear collection filter: ${activeCollection.name}`);
  else elements.activeCollectionFilter.removeAttribute("aria-label");
  const isFiltered = state.query.length > 0 || state.rating !== "All" || Boolean(activeCollection);
  elements.clearFilters.hidden = !isFiltered;
  elements.emptyState.hidden = recipes.length !== 0;
  elements.list.hidden = recipes.length === 0;
}

function setRating(rating) {
  state.rating = rating;
  state.surpriseRecipeKey = null;
  elements.filters.forEach((button) => {
    const active = button.dataset.rating === rating;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  render();
}

function clearFilters(shouldFocus = true) {
  state.query = "";
  state.collectionId = null;
  elements.search.value = "";
  setRating("All");
  if (shouldFocus) elements.search.focus();
}

function setEntryMethod(method, shouldFocus = true) {
  const showForm = method === "form";
  elements.form.hidden = !showForm;
  elements.pastePanel.hidden = showForm;
  elements.formTab.classList.toggle("active", showForm);
  elements.pasteTab.classList.toggle("active", !showForm);
  elements.formTab.setAttribute("aria-selected", String(showForm));
  elements.pasteTab.setAttribute("aria-selected", String(!showForm));
  elements.formTab.tabIndex = showForm ? 0 : -1;
  elements.pasteTab.tabIndex = showForm ? -1 : 0;
  if (shouldFocus) {
    if (showForm) elements.titleInput.focus();
    else elements.pasteInput.focus();
  }
}

function handleEntryTabKeydown(event) {
  const tabs = [elements.formTab, elements.pasteTab];
  const currentIndex = tabs.indexOf(event.currentTarget);
  let nextIndex = currentIndex;
  if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (currentIndex + 1) % tabs.length;
  else if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = tabs.length - 1;
  else return;

  event.preventDefault();
  const nextTab = tabs[nextIndex];
  setEntryMethod(nextTab === elements.formTab ? "form" : "paste", false);
  nextTab.focus();
}

function resetDialog() {
  elements.form.reset();
  elements.ratingInput.value = "Excellent";
  elements.pasteInput.value = "";
  elements.formMessage.textContent = "";
  elements.pasteMessage.textContent = "";
  setEntryMethod("form", false);
}

function openDialog(recipe = null) {
  resetDialog();
  state.editingRecipeId = recipe?.id || null;
  elements.entryTabs.hidden = Boolean(recipe);
  if (recipe) {
    elements.dialogTitle.textContent = "Edit Personal Recipe";
    elements.dialogDescription.textContent = "Update the copy saved in this browser.";
    elements.deviceNote.textContent = "Changes are saved only in this browser and do not alter the shared printable PDF.";
    elements.submitRecipe.textContent = "Save Changes";
    elements.titleInput.value = recipe.title;
    elements.whyInput.value = recipe.why;
    elements.ratingInput.value = normalizedRating(recipe.rating);
    elements.freezeInput.value = recipe.freeze;
    elements.urlInput.value = recipe.url;
    elements.ingredientsInput.value = ingredientsForRecipe(recipe).join("\n");
  } else {
    elements.dialogTitle.textContent = "Add a Recipe";
    elements.dialogDescription.textContent = "Save it on this device and include it in search and filters.";
    elements.deviceNote.textContent = "New recipes are saved only in this browser. They are not added to the shared printable PDF.";
    elements.submitRecipe.textContent = "Add to Ron's Recipes";
  }
  elements.dialog.showModal();
  elements.titleInput.focus();
}

function closeDialog() {
  elements.dialog.close();
}

function labeledValue(text, labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, "im"));
    if (match) return match[1].trim();
  }
  return "";
}

function labeledBlock(text, label, followingLabels) {
  const following = followingLabels.join("|");
  const match = text.match(new RegExp(`^${label}\\s*:\\s*([\\s\\S]*?)(?=^(?:${following})\\s*:|(?![\\s\\S]))`, "im"));
  return match ? match[1].trim() : "";
}

function parsePastedRecipe(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      return {
        title: String(parsed.title || parsed.name || "").trim(),
        why: String(parsed.why || parsed.description || "").trim(),
        rating: normalizedRating(parsed.rating || parsed.freezerRating || "Excellent"),
        freeze: String(parsed.freeze || parsed.freezeSmart || parsed.freezerNote || "").trim(),
        url: String(parsed.url || parsed.link || "").trim(),
        ingredients: parseIngredientLines(parsed.ingredients || parsed.recipeIngredient),
      };
    }
  } catch {
    // Continue with the labeled-text parser.
  }

  const urlMatch = trimmed.match(/https?:\/\/\S+/i);
  return {
    title: labeledValue(trimmed, ["Title", "Recipe", "Name"]),
    why: labeledValue(trimmed, ["Why", "Description"]),
    rating: normalizedRating(labeledValue(trimmed, ["Freezer rating", "Rating"]) || "Excellent"),
    freeze: labeledValue(trimmed, ["Freeze smart", "Freeze note", "Freezer note"]),
    url: labeledValue(trimmed, ["URL", "Link"]) || (urlMatch ? urlMatch[0] : ""),
    ingredients: parseIngredientLines(labeledBlock(trimmed, "Ingredients", ["URL", "Link"])),
  };
}

function usePastedRecipe() {
  const recipe = parsePastedRecipe(elements.pasteInput.value);
  if (!recipe || !recipe.title || !recipe.url) {
    elements.pasteMessage.textContent = "Include at least a labeled Title and URL.";
    return;
  }
  elements.titleInput.value = recipe.title;
  elements.whyInput.value = recipe.why;
  elements.ratingInput.value = RATINGS.includes(recipe.rating) ? recipe.rating : "Excellent";
  elements.freezeInput.value = recipe.freeze;
  elements.urlInput.value = recipe.url;
  elements.ingredientsInput.value = parseIngredientLines(recipe.ingredients).join("\n");
  elements.pasteMessage.textContent = "";
  setEntryMethod("form");
  elements.formMessage.textContent = "Pasted details loaded. Review them, then add the recipe.";
}

function saveRecipe(event) {
  event.preventDefault();
  if (!elements.form.reportValidity()) return;
  const editingRecipe = state.editingRecipeId
    ? state.customRecipes.find((recipe) => recipe.id === state.editingRecipeId)
    : null;
  const recipe = {
    id: editingRecipe?.id || makeCustomId(),
    title: elements.titleInput.value.trim(),
    why: elements.whyInput.value.trim(),
    rating: elements.ratingInput.value,
    freeze: elements.freezeInput.value.trim(),
    url: elements.urlInput.value.trim(),
    ingredients: parseIngredientLines(elements.ingredientsInput.value),
  };

  const duplicate = state.allRecipes.some((existing) =>
    existing.id !== recipe.id && (
      normalizeUrl(existing.url) === normalizeUrl(recipe.url) ||
      existing.title.trim().toLocaleLowerCase() === recipe.title.toLocaleLowerCase()
    )
  );
  if (duplicate) {
    elements.formMessage.textContent = "That recipe is already in the collection.";
    return;
  }

  const previousCustomRecipes = state.customRecipes;
  if (editingRecipe) {
    state.customRecipes = state.customRecipes.map((existing) => existing.id === recipe.id ? recipe : existing);
  } else {
    state.customRecipes = [...state.customRecipes, recipe];
  }
  mergeRecipes();
  if (!saveCustomRecipes()) {
    state.customRecipes = previousCustomRecipes;
    mergeRecipes();
    render();
    return;
  }
  clearFilters(false);
  closeDialog();
  updateManageSummary();
  showToast(`${recipe.title} ${editingRecipe ? "updated" : "added"}`);
  requestAnimationFrame(() => {
    document.querySelector(`[data-recipe-id="${recipe.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function collectionNamed(name) {
  const normalized = String(name).trim().toLocaleLowerCase();
  return state.collections.find((collection) => collection.name.toLocaleLowerCase() === normalized);
}

function createCollection(name) {
  const trimmed = String(name).trim();
  if (!trimmed) return { error: "Enter a collection name." };
  if (collectionNamed(trimmed)) return { error: "That collection already exists." };
  const collection = { id: makeLocalId("collection"), name: trimmed, recipeKeys: [] };
  const previous = state.collections;
  state.collections = [...state.collections, collection];
  if (!saveCollections()) {
    state.collections = previous;
    return { error: "The collection could not be saved." };
  }
  return { collection };
}

function renderCollections() {
  const validRecipeKeys = new Set(state.allRecipes.map(recipeKey));
  const fragment = document.createDocumentFragment();
  state.collections.forEach((collection) => {
    const recipeCount = collection.recipeKeys.filter((key) => validRecipeKeys.has(key)).length;
    const row = document.createElement("article");
    row.className = "collection-row";

    const details = document.createElement("div");
    details.className = "collection-row-details";
    const name = document.createElement("strong");
    name.textContent = collection.name;
    const count = document.createElement("span");
    count.textContent = `${recipeCount} ${recipeCount === 1 ? "recipe" : "recipes"}`;
    details.append(name, count);

    const actions = document.createElement("div");
    actions.className = "collection-row-actions";
    const view = document.createElement("button");
    view.type = "button";
    view.className = "button button-secondary";
    view.textContent = "View";
    view.disabled = recipeCount === 0;
    view.setAttribute("aria-label", `View recipes in ${collection.name}`);
    view.addEventListener("click", () => {
      state.collectionId = collection.id;
      elements.collectionsDialog.close();
      render();
      document.querySelector("#recipes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "text-button";
    rename.textContent = "Rename";
    rename.addEventListener("click", () => {
      const nextName = window.prompt("Rename collection", collection.name);
      if (nextName === null) return;
      const trimmed = nextName.trim();
      if (!trimmed) {
        elements.collectionsMessage.textContent = "A collection name cannot be blank.";
        return;
      }
      const duplicate = state.collections.some((item) => item.id !== collection.id && item.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
      if (duplicate) {
        elements.collectionsMessage.textContent = "That collection already exists.";
        return;
      }
      const previousName = collection.name;
      collection.name = trimmed;
      if (!saveCollections()) collection.name = previousName;
      elements.collectionsMessage.textContent = collection.name === trimmed ? "Collection renamed." : "The collection could not be renamed.";
      renderCollections();
      render();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button danger-text-button";
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", `Delete ${collection.name} collection`);
    remove.addEventListener("click", () => {
      if (!window.confirm(`Delete the ${collection.name} collection? Recipes will stay in Ron's Recipes.`)) return;
      const previous = state.collections;
      state.collections = state.collections.filter((item) => item.id !== collection.id);
      if (!saveCollections()) {
        state.collections = previous;
        return;
      }
      if (state.collectionId === collection.id) state.collectionId = null;
      elements.collectionsMessage.textContent = `${collection.name} deleted. The recipes were not removed.`;
      renderCollections();
      render();
    });
    actions.append(view, rename, remove);
    row.append(details, actions);
    fragment.append(row);
  });
  elements.collectionsList.replaceChildren(fragment);
  const recipeAssignments = state.collections.reduce((count, collection) => count + collection.recipeKeys.length, 0);
  elements.collectionsSummary.textContent = `${state.collections.length} ${state.collections.length === 1 ? "collection" : "collections"} with ${recipeAssignments} recipe ${recipeAssignments === 1 ? "assignment" : "assignments"}.`;
}

function openCollections() {
  elements.collectionsMessage.textContent = "";
  renderCollections();
  elements.collectionsDialog.showModal();
  elements.newCollectionName.focus();
}

function closeCollections() {
  elements.collectionsDialog.close();
}

function handleCreateCollection(event) {
  event.preventDefault();
  const result = createCollection(elements.newCollectionName.value);
  elements.collectionsMessage.textContent = result.error || `${result.collection.name} created.`;
  if (result.collection) {
    elements.newCollectionName.value = "";
    renderCollections();
  }
}

function renderRecipeCollectionOptions(checkedIds = null) {
  const key = recipeKey(state.collectionRecipe);
  const fragment = document.createDocumentFragment();
  state.collections.forEach((collection) => {
    const label = document.createElement("label");
    label.className = "collection-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = collection.id;
    checkbox.checked = checkedIds ? checkedIds.has(collection.id) : collection.recipeKeys.includes(key);
    const text = document.createElement("span");
    text.textContent = collection.name;
    label.append(checkbox, text);
    fragment.append(label);
  });
  elements.recipeCollectionOptions.replaceChildren(fragment);
}

function openRecipeCollections(recipe) {
  state.collectionRecipe = recipe;
  elements.recipeCollectionsName.textContent = recipe.title;
  elements.recipeCollectionsMessage.textContent = "";
  renderRecipeCollectionOptions();
  elements.recipeCollectionsDialog.showModal();
  elements.recipeCollectionOptions.querySelector("input")?.focus();
}

function closeRecipeCollections() {
  state.collectionRecipe = null;
  elements.recipeCollectionsDialog.close();
}

function handleQuickCreateCollection(event) {
  event.preventDefault();
  const checked = new Set([...elements.recipeCollectionOptions.querySelectorAll("input:checked")].map((input) => input.value));
  const result = createCollection(elements.quickCollectionName.value);
  elements.recipeCollectionsMessage.textContent = result.error || `${result.collection.name} created and selected.`;
  if (result.collection) {
    checked.add(result.collection.id);
    elements.quickCollectionName.value = "";
    renderRecipeCollectionOptions(checked);
  }
}

function saveRecipeCollections() {
  if (!state.collectionRecipe) return;
  const key = recipeKey(state.collectionRecipe);
  const selected = new Set([...elements.recipeCollectionOptions.querySelectorAll("input:checked")].map((input) => input.value));
  const previous = state.collections.map((collection) => ({ ...collection, recipeKeys: [...collection.recipeKeys] }));
  state.collections = state.collections.map((collection) => ({
    ...collection,
    recipeKeys: selected.has(collection.id)
      ? [...new Set([...collection.recipeKeys, key])]
      : collection.recipeKeys.filter((recipeId) => recipeId !== key),
  }));
  if (!saveCollections()) {
    state.collections = previous;
    return;
  }
  const recipeTitle = state.collectionRecipe.title;
  closeRecipeCollections();
  render();
  showToast(`${recipeTitle} collections saved`);
}

function renderIngredientsDialog(showEditor = false) {
  const recipe = state.ingredientRecipe;
  if (!recipe) return;
  const ingredients = ingredientsForRecipe(recipe);
  const hasOverride = !recipe.custom && Object.hasOwn(state.ingredientOverrides, recipeKey(recipe));
  elements.ingredientsSourceNote.textContent = ingredients.length === 0
    ? "No ingredient list is saved yet. Paste it below once and it will be ready next time."
    : recipe.custom
      ? "Ingredients saved with this personal recipe."
      : hasOverride
        ? "Using the ingredient list you edited on this device."
        : "Loaded from the linked original recipe. Check the source if package sizes or amounts change.";
  elements.ingredientsSourceLink.hidden = !recipe.url;
  elements.ingredientsSourceLink.href = recipe.url || "#";
  const editorVisible = showEditor || ingredients.length === 0;
  elements.ingredientsEditor.hidden = !editorVisible;
  elements.ingredientsPicker.hidden = editorVisible;
  elements.editIngredients.hidden = editorVisible || ingredients.length === 0;
  elements.addSelectedShopping.hidden = editorVisible || ingredients.length === 0;
  elements.ingredientsText.value = ingredients.join("\n");
  elements.ingredientsMessage.textContent = ingredients.length ? "" : "Paste this recipe's ingredient list to use it again later.";
  if (editorVisible) {
    elements.ingredientsText.focus();
    return;
  }
  const fragment = document.createDocumentFragment();
  ingredients.forEach((ingredient, index) => {
    const label = document.createElement("label");
    label.className = "ingredient-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = String(index);
    checkbox.checked = true;
    const text = document.createElement("span");
    text.textContent = ingredient;
    label.append(checkbox, text);
    fragment.append(label);
  });
  elements.ingredientsOptions.replaceChildren(fragment);
  elements.ingredientsOptions.querySelector("input")?.focus();
}

function openIngredients(recipe) {
  state.ingredientRecipe = recipe;
  elements.ingredientsRecipeName.textContent = recipe.title;
  elements.ingredientsMessage.textContent = "";
  elements.ingredientsDialog.showModal();
  renderIngredientsDialog();
}

function closeIngredients() {
  state.ingredientRecipe = null;
  elements.ingredientsDialog.close();
}

function saveRecipeIngredients() {
  const recipe = state.ingredientRecipe;
  if (!recipe) return;
  const ingredients = parseIngredientLines(elements.ingredientsText.value);
  if (!ingredients.length) {
    elements.ingredientsMessage.textContent = "Add at least one ingredient, one per line.";
    elements.ingredientsText.focus();
    return;
  }
  if (recipe.custom) {
    const previous = state.customRecipes;
    state.customRecipes = state.customRecipes.map((item) => item.id === recipe.id ? { ...item, ingredients } : item);
    mergeRecipes();
    if (!saveCustomRecipes()) {
      state.customRecipes = previous;
      mergeRecipes();
      return;
    }
    state.ingredientRecipe = state.allRecipes.find((item) => item.id === recipe.id);
  } else {
    const key = recipeKey(recipe);
    const previous = state.ingredientOverrides[key];
    state.ingredientOverrides[key] = ingredients;
    if (!saveIngredientOverrides()) {
      if (previous) state.ingredientOverrides[key] = previous;
      else delete state.ingredientOverrides[key];
      return;
    }
  }
  renderIngredientsDialog(false);
  elements.ingredientsMessage.textContent = "Ingredients saved on this device.";
}

function cancelIngredientEditing() {
  const isEditing = !elements.ingredientsEditor.hidden;
  if (isEditing && ingredientsForRecipe(state.ingredientRecipe).length) renderIngredientsDialog(false);
  else closeIngredients();
}

function addSelectedIngredients() {
  const recipe = state.ingredientRecipe;
  if (!recipe) return;
  const ingredients = ingredientsForRecipe(recipe);
  const selectedIndexes = [...elements.ingredientsOptions.querySelectorAll("input:checked")].map((input) => Number(input.value));
  if (!selectedIndexes.length) {
    elements.ingredientsMessage.textContent = "Select at least one ingredient.";
    return;
  }
  const key = recipeKey(recipe);
  const existing = new Set(state.shoppingItems.map((item) => `${item.recipeKey || "manual"}|${item.text.toLocaleLowerCase()}`));
  const additions = selectedIndexes
    .map((index) => ingredients[index])
    .filter(Boolean)
    .filter((ingredient) => {
      const duplicateKey = `${key}|${ingredient.toLocaleLowerCase()}`;
      if (existing.has(duplicateKey)) return false;
      existing.add(duplicateKey);
      return true;
    })
    .map((ingredient) => ({ id: makeLocalId("item"), text: ingredient, checked: false, recipeKey: key, recipeTitle: recipe.title }));
  const previous = state.shoppingItems;
  state.shoppingItems = [...state.shoppingItems, ...additions];
  if (!saveShoppingItems()) {
    state.shoppingItems = previous;
    return;
  }
  closeIngredients();
  openShopping();
  elements.shoppingMessage.textContent = additions.length
    ? `${additions.length} ${additions.length === 1 ? "ingredient" : "ingredients"} added from ${recipe.title}.`
    : "Those ingredients are already on your list.";
}

function shoppingGroups() {
  const groups = new Map();
  state.shoppingItems.forEach((item) => {
    const groupName = item.recipeTitle || "Other items";
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(item);
  });
  return groups;
}

function renderShoppingList() {
  const checkedCount = state.shoppingItems.filter((item) => item.checked).length;
  const total = state.shoppingItems.length;
  elements.quickShoppingCount.textContent = total;
  elements.shoppingSummary.textContent = total ? `${total} ${total === 1 ? "item" : "items"}; ${checkedCount} checked.` : "Nothing to buy yet.";
  elements.shoppingEmpty.hidden = total !== 0;
  elements.shoppingList.hidden = total === 0;
  elements.copyShopping.disabled = total === 0;
  elements.printShopping.disabled = total === 0;
  elements.clearCheckedShopping.disabled = checkedCount === 0;
  const fragment = document.createDocumentFragment();
  shoppingGroups().forEach((items, groupName) => {
    const section = document.createElement("section");
    section.className = "shopping-group";
    const heading = document.createElement("h3");
    heading.textContent = groupName;
    section.append(heading);
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "shopping-item";
      row.dataset.itemId = item.id;
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.checked;
      checkbox.addEventListener("change", () => {
        item.checked = checkbox.checked;
        if (!saveShoppingItems()) item.checked = !checkbox.checked;
        renderShoppingList();
      });
      const text = document.createElement("span");
      text.textContent = item.text;
      label.append(checkbox, text);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-shopping-item";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${item.text} from shopping list`);
      remove.addEventListener("click", () => {
        const previous = state.shoppingItems;
        state.shoppingItems = state.shoppingItems.filter((value) => value.id !== item.id);
        if (!saveShoppingItems()) state.shoppingItems = previous;
        renderShoppingList();
      });
      row.append(label, remove);
      section.append(row);
    });
    fragment.append(section);
  });
  elements.shoppingList.replaceChildren(fragment);
}

function openShopping() {
  elements.shoppingMessage.textContent = "";
  renderShoppingList();
  elements.shoppingDialog.showModal();
  elements.manualShoppingItem.focus();
}

function closeShopping() {
  elements.shoppingDialog.close();
}

function addManualShoppingItem(event) {
  event.preventDefault();
  const text = elements.manualShoppingItem.value.trim();
  if (!text) return;
  const duplicate = state.shoppingItems.some((item) => !item.recipeKey && item.text.toLocaleLowerCase() === text.toLocaleLowerCase());
  if (duplicate) {
    elements.shoppingMessage.textContent = "That item is already on your list.";
    return;
  }
  const previous = state.shoppingItems;
  state.shoppingItems = [...state.shoppingItems, { id: makeLocalId("item"), text, checked: false, recipeKey: null, recipeTitle: "Other items" }];
  if (!saveShoppingItems()) {
    state.shoppingItems = previous;
    return;
  }
  elements.manualShoppingItem.value = "";
  elements.shoppingMessage.textContent = `${text} added.`;
  renderShoppingList();
  elements.manualShoppingItem.focus();
}

function formatShoppingList() {
  const lines = ["Ron's Recipes Shopping List", ""];
  shoppingGroups().forEach((items, groupName) => {
    lines.push(groupName);
    items.forEach((item) => lines.push(`${item.checked ? "[x]" : "[ ]"} ${item.text}`));
    lines.push("");
  });
  return lines.join("\n").trim();
}

async function copyShoppingList() {
  try {
    await writeToClipboard(formatShoppingList());
    elements.shoppingMessage.textContent = "Shopping list copied.";
  } catch (error) {
    console.error("Shopping list could not be copied.", error);
    elements.shoppingMessage.textContent = "Copy failed. Please try again.";
  }
}

function printShoppingList() {
  document.body.classList.add("print-shopping-list");
  const cleanup = () => document.body.classList.remove("print-shopping-list");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 1000);
}

function clearCheckedShoppingItems() {
  const checkedCount = state.shoppingItems.filter((item) => item.checked).length;
  if (!checkedCount) return;
  const previous = state.shoppingItems;
  state.shoppingItems = state.shoppingItems.filter((item) => !item.checked);
  if (!saveShoppingItems()) state.shoppingItems = previous;
  elements.shoppingMessage.textContent = `${checkedCount} checked ${checkedCount === 1 ? "item" : "items"} cleared.`;
  renderShoppingList();
}

function updateDayGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  elements.dayGreeting.textContent = greeting + ", Ron!";
}

function scrollToRecipes() {
  const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  document.querySelector("#recipes")?.scrollIntoView({ behavior, block: "start" });
}

function showMyRecipes() {
  state.surpriseRecipeKey = null;
  clearFilters(false);
  scrollToRecipes();
  requestAnimationFrame(() => elements.search.focus({ preventScroll: true }));
}

function surpriseMe() {
  if (!state.recipes.length) return;
  const previousSurpriseKey = state.surpriseRecipeKey;
  clearFilters(false);
  const alternatives = state.recipes.filter((recipe) => recipeKey(recipe) !== previousSurpriseKey);
  const choices = alternatives.length ? alternatives : state.recipes;
  const recipe = choices[Math.floor(Math.random() * choices.length)];
  state.surpriseRecipeKey = recipeKey(recipe);
  render();
  requestAnimationFrame(() => {
    const recipeId = recipe.id || "base-" + recipe.rank;
    const row = document.querySelector('[data-recipe-id="' + recipeId + '"]');
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    row?.scrollIntoView({ behavior, block: "center" });
    row?.querySelector(".recipe-link")?.focus({ preventScroll: true });
  });
  showToast("Tonight's pick: " + recipe.title);
}

function pantryTerms(value) {
  return [...new Set(String(value).split(/[\n,;]+/)
    .map((term) => term.trim().toLocaleLowerCase())
    .filter((term) => term.length >= 2))];
}

function pantryMatches(terms) {
  return state.recipes.map((recipe) => {
    const ingredients = ingredientsForRecipe(recipe);
    const normalizedIngredients = ingredients.map((ingredient) => ingredient.toLocaleLowerCase());
    const matches = terms.filter((term) => normalizedIngredients.some((ingredient) => ingredient.includes(term)));
    return { recipe, ingredients, matches };
  }).filter((result) => result.matches.length)
    .sort((a, b) => b.matches.length - a.matches.length || a.recipe.rank - b.recipe.rank)
    .slice(0, 8);
}

function viewPantryRecipe(recipe) {
  closePantry();
  state.collectionId = null;
  state.rating = "All";
  state.query = recipe.title;
  state.surpriseRecipeKey = null;
  elements.search.value = recipe.title;
  elements.filters.forEach((button) => {
    const active = button.dataset.rating === "All";
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  render();
  scrollToRecipes();
}

function renderPantryResults(results, terms) {
  const fragment = document.createDocumentFragment();
  results.forEach(({ recipe, ingredients, matches }, index) => {
    const article = document.createElement("article");
    article.className = "pantry-result";
    const details = document.createElement("div");
    const rank = document.createElement("span");
    rank.className = "pantry-result-rank";
    rank.textContent = "Match " + (index + 1);
    const title = document.createElement("h3");
    title.textContent = recipe.title;
    const summary = document.createElement("p");
    summary.textContent = matches.length + " of " + terms.length + " pantry " + (terms.length === 1 ? "item" : "items") + " matched: " + matches.join(", ") + ".";
    const ingredientCount = document.createElement("small");
    ingredientCount.textContent = ingredients.length + " ingredients in the recipe";
    details.append(rank, title, summary, ingredientCount);
    const view = document.createElement("button");
    view.type = "button";
    view.className = "button button-secondary";
    view.textContent = "View Recipe";
    view.setAttribute("aria-label", "View " + recipe.title);
    view.addEventListener("click", () => viewPantryRecipe(recipe));
    article.append(details, view);
    fragment.append(article);
  });
  elements.pantryResults.replaceChildren(fragment);
}

function findPantryRecipes(event) {
  event.preventDefault();
  const terms = pantryTerms(elements.pantryIngredients.value);
  if (!terms.length) {
    elements.pantryMessage.textContent = "Enter at least one ingredient.";
    elements.pantryIngredients.focus();
    return;
  }
  const results = pantryMatches(terms);
  elements.pantryMessage.textContent = results.length
    ? results.length + " closest " + (results.length === 1 ? "match" : "matches") + " found."
    : "No matches yet. Try broader ingredient names such as chicken, potatoes, or cheese.";
  if (results.length) renderPantryResults(results, terms);
  else elements.pantryResults.innerHTML = '<div class="tool-empty">No recipes matched those pantry ingredients.</div>';
}

function openPantry() {
  elements.pantryMessage.textContent = "";
  elements.pantryDialog.showModal();
  elements.pantryIngredients.focus();
}

function closePantry() {
  elements.pantryDialog.close();
}

function backupRecipe(recipe) {
  return {
    id: recipe.id,
    title: recipe.title,
    why: recipe.why,
    rating: normalizedRating(recipe.rating),
    freeze: recipe.freeze,
    url: recipe.url,
    ingredients: parseIngredientLines(recipe.ingredients),
  };
}

function updateManageSummary() {
  const customCount = state.customRecipes.length;
  const hiddenCount = state.removedKeys.size;
  const ingredientCount = Object.keys(state.ingredientOverrides).length + state.customRecipes.filter((recipe) => parseIngredientLines(recipe.ingredients).length).length;
  elements.manageSummary.textContent = `${customCount} personal ${customCount === 1 ? "recipe" : "recipes"}, ${hiddenCount} hidden, ${ingredientCount} with saved ingredients, ${state.collections.length} collections, and ${state.shoppingItems.length} shopping items are saved on this device.`;
}

function openManager() {
  updateManageSummary();
  elements.manageMessage.textContent = "";
  elements.manageDialog.showModal();
  elements.exportBackup.focus();
}

function closeManager() {
  elements.manageDialog.close();
}

function exportBackup() {
  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    customRecipes: state.customRecipes.map(backupRecipe),
    removedKeys: [...state.removedKeys],
    collections: state.collections.map((collection) => ({ ...collection, recipeKeys: [...collection.recipeKeys] })),
    shoppingItems: state.shoppingItems.map((item) => ({ ...item })),
    ingredientOverrides: { ...state.ingredientOverrides },
  };
  const date = backup.exportedAt.slice(0, 10);
  const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const download = document.createElement("a");
  download.href = url;
  download.download = `rons-recipes-backup-${date}.json`;
  document.body.append(download);
  download.click();
  download.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  elements.manageMessage.textContent = "Backup exported. Keep the downloaded JSON file somewhere safe.";
}

function normalizeImportedRecipe(recipe) {
  const normalized = {
    id: typeof recipe?.id === "string" && recipe.id.trim() ? recipe.id.trim() : makeCustomId(),
    title: String(recipe?.title || "").trim(),
    why: String(recipe?.why || "").trim(),
    rating: normalizedRating(recipe?.rating || ""),
    freeze: String(recipe?.freeze || "").trim(),
    url: String(recipe?.url || "").trim(),
    ingredients: parseIngredientLines(recipe?.ingredients),
  };
  return isValidCustomRecipe(normalized) ? normalized : null;
}

async function importBackupFile(file) {
  try {
    const backup = JSON.parse(await file.text());
    if (backup?.format !== BACKUP_FORMAT || ![1, BACKUP_VERSION].includes(backup?.version) || !Array.isArray(backup.customRecipes) || !Array.isArray(backup.removedKeys)) {
      throw new Error("This is not a supported Ron's Recipes backup.");
    }

    const previousCustomRecipes = state.customRecipes;
    const previousRemovedKeys = new Set(state.removedKeys);
    const previousCollections = state.collections.map((collection) => ({ ...collection, recipeKeys: [...collection.recipeKeys] }));
    const previousShoppingItems = state.shoppingItems;
    const previousIngredientOverrides = { ...state.ingredientOverrides };
    const merged = state.customRecipes.map(backupRecipe);
    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const importedValue of backup.customRecipes) {
      const imported = normalizeImportedRecipe(importedValue);
      if (!imported) {
        skipped += 1;
        continue;
      }
      const matchingId = merged.findIndex((recipe) => recipe.id === imported.id);
      if (matchingId >= 0) {
        merged[matchingId] = imported;
        updated += 1;
        continue;
      }
      const duplicate = merged.some((recipe) =>
        normalizeUrl(recipe.url) === normalizeUrl(imported.url) ||
        recipe.title.toLocaleLowerCase() === imported.title.toLocaleLowerCase()
      );
      if (duplicate) {
        skipped += 1;
        continue;
      }
      merged.push(imported);
      added += 1;
    }

    state.customRecipes = merged;
    state.removedKeys = new Set([
      ...state.removedKeys,
      ...backup.removedKeys.filter((key) => typeof key === "string"),
    ]);

    if (backup.version >= 2) {
      const importedCollections = Array.isArray(backup.collections) ? backup.collections.map(normalizeCollection).filter(Boolean) : [];
      const collections = state.collections.map((collection) => ({ ...collection, recipeKeys: [...collection.recipeKeys] }));
      importedCollections.forEach((imported) => {
        const index = collections.findIndex((collection) => collection.id === imported.id || collection.name.toLocaleLowerCase() === imported.name.toLocaleLowerCase());
        if (index >= 0) {
          collections[index] = { ...collections[index], recipeKeys: [...new Set([...collections[index].recipeKeys, ...imported.recipeKeys])] };
        } else {
          collections.push(imported);
        }
      });
      state.collections = collections;

      const shoppingItems = state.shoppingItems.map((item) => ({ ...item }));
      const shoppingKeys = new Set(shoppingItems.map((item) => `${item.recipeKey || "manual"}|${item.text.toLocaleLowerCase()}`));
      (Array.isArray(backup.shoppingItems) ? backup.shoppingItems : []).map(normalizeShoppingItem).filter(Boolean).forEach((item) => {
        const key = `${item.recipeKey || "manual"}|${item.text.toLocaleLowerCase()}`;
        if (!shoppingKeys.has(key)) {
          shoppingKeys.add(key);
          shoppingItems.push(item);
        }
      });
      state.shoppingItems = shoppingItems;

      if (backup.ingredientOverrides && typeof backup.ingredientOverrides === "object" && !Array.isArray(backup.ingredientOverrides)) {
        const importedIngredients = Object.fromEntries(Object.entries(backup.ingredientOverrides)
          .map(([key, value]) => [key, parseIngredientLines(value)])
          .filter(([, value]) => value.length));
        state.ingredientOverrides = { ...state.ingredientOverrides, ...importedIngredients };
      }
    }

    mergeRecipes();
    if (!saveCustomRecipes() || !saveRemovedKeys() || !saveCollections() || !saveShoppingItems() || !saveIngredientOverrides()) {
      state.customRecipes = previousCustomRecipes;
      state.removedKeys = previousRemovedKeys;
      state.collections = previousCollections;
      state.shoppingItems = previousShoppingItems;
      state.ingredientOverrides = previousIngredientOverrides;
      mergeRecipes();
      saveCustomRecipes();
      saveRemovedKeys();
      saveCollections();
      saveShoppingItems();
      saveIngredientOverrides();
      render();
      elements.manageMessage.textContent = "The backup could not be saved on this device.";
      return;
    }

    render();
    updateManageSummary();
    elements.manageMessage.textContent = `Import complete: ${added} added, ${updated} updated, ${skipped} skipped.`;
  } catch (error) {
    console.error("Backup could not be imported.", error);
    elements.manageMessage.textContent = error.message || "That backup could not be imported.";
  } finally {
    elements.importBackupFile.value = "";
  }
}

async function loadRecipes() {
  try {
    const response = await fetch("recipes.json?v=1.5.1", { cache: "no-store" });
    if (!response.ok) throw new Error(`Recipe data request failed: ${response.status}`);
    state.baseRecipes = (await response.json()).sort((a, b) => Number(a.rank) - Number(b.rank));
    state.customRecipes = loadCustomRecipes();
    state.removedKeys = loadRemovedKeys();
    state.collections = loadCollections();
    state.shoppingItems = loadShoppingItems();
    state.ingredientOverrides = loadIngredientOverrides();
    mergeRecipes();
    saveRemovedKeys();
    saveCollections();
    elements.pdfLinks.forEach((link) => { link.href = "printable/rons-recipes-2026.pdf"; });
    document.title = "Ron's Recipes";
    render();
    restoreHashPosition();
  } catch (error) {
    console.error(error);
    elements.list.setAttribute("aria-busy", "false");
    elements.list.innerHTML = '<div class="empty-state"><h3>Recipes could not be loaded</h3><p>Please refresh the page and try again.</p></div>';
  }
}

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  state.surpriseRecipeKey = null;
  render();
});
elements.filters.forEach((button) => button.addEventListener("click", () => setRating(button.dataset.rating)));
elements.clearFilters.addEventListener("click", () => clearFilters());
elements.clearButtons.forEach((button) => button.addEventListener("click", () => clearFilters()));
elements.backToTop.addEventListener("click", () => {
  elements.brand.focus({ preventScroll: true });
  const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  window.scrollTo({ top: 0, behavior });
});
elements.installApp.addEventListener("click", installApp);
elements.quickAddRecipe.addEventListener("click", () => openDialog());
elements.quickMyRecipes.addEventListener("click", showMyRecipes);
elements.quickShoppingList.addEventListener("click", openShopping);
elements.quickPantryMatch.addEventListener("click", openPantry);
elements.quickSurprise.addEventListener("click", surpriseMe);
elements.openCollections.forEach((button) => button.addEventListener("click", openCollections));
elements.openShopping.forEach((button) => button.addEventListener("click", openShopping));
elements.activeCollectionFilter.addEventListener("click", () => {
  state.collectionId = null;
  render();
});
elements.openConversions.forEach((button) => button.addEventListener("click", openConversions));
elements.closeConversions.addEventListener("click", closeConversions);
elements.conversionType.addEventListener("change", changeConversionType);
elements.conversionValue.addEventListener("input", updateConversion);
elements.conversionFrom.addEventListener("change", updateConversion);
elements.conversionTo.addEventListener("change", updateConversion);
elements.swapConversionUnits.addEventListener("click", swapConversionUnits);
elements.conversionDialog.addEventListener("click", (event) => {
  if (event.target === elements.conversionDialog) closeConversions();
});
elements.closeCollections.addEventListener("click", closeCollections);
elements.doneCollections.addEventListener("click", closeCollections);
elements.createCollectionForm.addEventListener("submit", handleCreateCollection);
elements.collectionsDialog.addEventListener("click", (event) => {
  if (event.target === elements.collectionsDialog) closeCollections();
});
elements.closeRecipeCollections.addEventListener("click", closeRecipeCollections);
elements.cancelRecipeCollections.addEventListener("click", closeRecipeCollections);
elements.saveRecipeCollections.addEventListener("click", saveRecipeCollections);
elements.quickCreateCollectionForm.addEventListener("submit", handleQuickCreateCollection);
elements.recipeCollectionsDialog.addEventListener("click", (event) => {
  if (event.target === elements.recipeCollectionsDialog) closeRecipeCollections();
});
elements.recipeCollectionsDialog.addEventListener("close", () => { state.collectionRecipe = null; });
elements.closeIngredients.addEventListener("click", closeIngredients);
elements.cancelIngredients.addEventListener("click", cancelIngredientEditing);
elements.saveIngredients.addEventListener("click", saveRecipeIngredients);
elements.editIngredients.addEventListener("click", () => renderIngredientsDialog(true));
elements.addSelectedShopping.addEventListener("click", addSelectedIngredients);
elements.ingredientsDialog.addEventListener("click", (event) => {
  if (event.target === elements.ingredientsDialog) closeIngredients();
});
elements.ingredientsDialog.addEventListener("close", () => { state.ingredientRecipe = null; });
elements.closeShopping.addEventListener("click", closeShopping);
elements.doneShopping.addEventListener("click", closeShopping);
elements.manualShoppingForm.addEventListener("submit", addManualShoppingItem);
elements.copyShopping.addEventListener("click", copyShoppingList);
elements.printShopping.addEventListener("click", printShoppingList);
elements.clearCheckedShopping.addEventListener("click", clearCheckedShoppingItems);
elements.shoppingDialog.addEventListener("click", (event) => {
  if (event.target === elements.shoppingDialog) closeShopping();
});
elements.closePantry.addEventListener("click", closePantry);
elements.donePantry.addEventListener("click", closePantry);
elements.pantryForm.addEventListener("submit", findPantryRecipes);
elements.pantryDialog.addEventListener("click", (event) => {
  if (event.target === elements.pantryDialog) closePantry();
});
elements.restoreRemoved.addEventListener("click", restoreRemovedRecipes);
elements.openManager.addEventListener("click", openManager);
elements.openAdd.addEventListener("click", () => openDialog());
elements.closeDialog.addEventListener("click", closeDialog);
elements.cancelAdd.addEventListener("click", closeDialog);
elements.formTab.addEventListener("click", () => setEntryMethod("form"));
elements.pasteTab.addEventListener("click", () => setEntryMethod("paste"));
elements.formTab.addEventListener("keydown", handleEntryTabKeydown);
elements.pasteTab.addEventListener("keydown", handleEntryTabKeydown);
elements.cancelPaste.addEventListener("click", closeDialog);
elements.usePasted.addEventListener("click", usePastedRecipe);
elements.form.addEventListener("submit", saveRecipe);
elements.closeManager.addEventListener("click", closeManager);
elements.doneManager.addEventListener("click", closeManager);
elements.exportBackup.addEventListener("click", exportBackup);
elements.importBackup.addEventListener("click", () => elements.importBackupFile.click());
elements.importBackupFile.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importBackupFile(file);
});
elements.cancelRemove.addEventListener("click", closeRemoveDialog);
elements.confirmRemove.addEventListener("click", removeRecipe);
elements.removeDialog.addEventListener("click", (event) => {
  if (event.target === elements.removeDialog) closeRemoveDialog();
});
elements.removeDialog.addEventListener("close", () => {
  pendingRemoval = null;
  pendingRemovalMode = "hide";
});
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeDialog();
});
elements.dialog.addEventListener("close", () => { state.editingRecipeId = null; });
elements.manageDialog.addEventListener("click", (event) => {
  if (event.target === elements.manageDialog) closeManager();
});

window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
window.addEventListener("resize", scheduleScrollUpdate);
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  elements.installApp.hidden = false;
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  elements.installApp.hidden = true;
  showToast("Ron's Recipes installed");
});

loadRecipes();
updateDayGreeting();
updateScrollEnhancements();
updateConversion();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.info("Offline support is unavailable.", error);
    });
  });
}
