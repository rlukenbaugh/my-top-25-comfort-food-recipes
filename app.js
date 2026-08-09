const STORAGE_KEY = "rons-recipes.custom.v1";
const RATINGS = ["Outstanding", "Excellent", "Very good", "Good", "Fair"];

const state = {
  baseRecipes: [],
  customRecipes: [],
  recipes: [],
  query: "",
  rating: "All",
};

const elements = {
  list: document.querySelector("#recipe-list"),
  template: document.querySelector("#recipe-template"),
  search: document.querySelector("#search"),
  filters: [...document.querySelectorAll(".filter")],
  resultCount: document.querySelector("#result-count"),
  recipeCounts: [...document.querySelectorAll("[data-recipe-count]")],
  clearFilters: document.querySelector("#clear-filters"),
  emptyState: document.querySelector("#empty-state"),
  clearButtons: [...document.querySelectorAll("[data-clear]")],
  pdfLinks: [...document.querySelectorAll("[data-pdf-link]")],
  openAdd: document.querySelector("#open-add-recipe"),
  dialog: document.querySelector("#recipe-dialog"),
  closeDialog: document.querySelector("#close-dialog"),
  cancelAdd: document.querySelector("#cancel-add"),
  form: document.querySelector("#recipe-form"),
  formTab: document.querySelector("#form-tab"),
  pasteTab: document.querySelector("#paste-tab"),
  pastePanel: document.querySelector("#paste-panel"),
  pasteInput: document.querySelector("#paste-recipe"),
  usePasted: document.querySelector("#use-pasted-recipe"),
  pasteMessage: document.querySelector("#paste-message"),
  formMessage: document.querySelector("#form-message"),
  titleInput: document.querySelector("#recipe-title"),
  whyInput: document.querySelector("#recipe-why"),
  ratingInput: document.querySelector("#recipe-rating"),
  freezeInput: document.querySelector("#recipe-freeze"),
  urlInput: document.querySelector("#recipe-url"),
  toast: document.querySelector("#toast"),
};

function normalizedRating(rating) {
  return String(rating).replace("*", "").trim();
}

function normalizeUrl(url) {
  return String(url).trim().replace(/\/$/, "").toLocaleLowerCase();
}

function isValidCustomRecipe(recipe) {
  return recipe &&
    typeof recipe.title === "string" && recipe.title.trim() &&
    typeof recipe.why === "string" && recipe.why.trim() &&
    typeof recipe.freeze === "string" && recipe.freeze.trim() &&
    typeof recipe.url === "string" && /^https?:\/\//i.test(recipe.url) &&
    RATINGS.includes(normalizedRating(recipe.rating));
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.customRecipes));
}

function mergeRecipes() {
  const highestBaseRank = Math.max(0, ...state.baseRecipes.map((recipe) => Number(recipe.rank) || 0));
  state.customRecipes = state.customRecipes.map((recipe, index) => ({
    ...recipe,
    rank: highestBaseRank + index + 1,
    custom: true,
  }));
  state.recipes = [...state.baseRecipes, ...state.customRecipes].sort((a, b) => Number(a.rank) - Number(b.rank));
  elements.recipeCounts.forEach((element) => { element.textContent = state.recipes.length; });
}

function filteredRecipes() {
  const query = state.query.toLocaleLowerCase();
  return state.recipes.filter((recipe) => {
    const matchesRating = state.rating === "All" || normalizedRating(recipe.rating) === state.rating;
    const haystack = [recipe.title, recipe.why, recipe.freeze, recipe.rating].join(" ").toLocaleLowerCase();
    return matchesRating && (!query || haystack.includes(query));
  });
}

function formatRecipeForCopy(recipe) {
  return [
    `Title: ${recipe.title}`,
    `Why: ${recipe.why}`,
    `Freezer rating: ${normalizedRating(recipe.rating)}`,
    `Freeze smart: ${recipe.freeze}`,
    `URL: ${recipe.url}`,
  ].join("\n");
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

async function copyRecipe(recipe) {
  try {
    await writeToClipboard(formatRecipeForCopy(recipe));
    showToast(`${recipe.title} copied`);
  } catch (error) {
    console.error("Recipe could not be copied.", error);
    showToast("Copy failed - please try again");
  }
}

function createRecipeRow(recipe) {
  const row = elements.template.content.firstElementChild.cloneNode(true);
  row.dataset.recipeId = recipe.id || `base-${recipe.rank}`;
  row.querySelector(".rank").textContent = recipe.rank;
  row.querySelector(".recipe-title").textContent = recipe.title;
  row.querySelector(".recipe-why").textContent = recipe.why;
  row.querySelector(".recipe-rating strong").textContent = normalizedRating(recipe.rating);
  row.querySelector(".recipe-freeze p").textContent = recipe.freeze;
  const link = row.querySelector(".recipe-link");
  link.href = recipe.url;
  link.setAttribute("aria-label", `Open original recipe for ${recipe.title}`);
  const copyButton = row.querySelector(".copy-recipe");
  copyButton.setAttribute("aria-label", `Copy ${recipe.title}`);
  copyButton.addEventListener("click", () => copyRecipe(recipe));
  return row;
}

function render() {
  const recipes = filteredRecipes();
  const fragment = document.createDocumentFragment();
  recipes.forEach((recipe) => fragment.append(createRecipeRow(recipe)));
  elements.list.replaceChildren(fragment);
  elements.list.setAttribute("aria-busy", "false");
  elements.resultCount.textContent = recipes.length;
  const isFiltered = state.query.length > 0 || state.rating !== "All";
  elements.clearFilters.hidden = !isFiltered;
  elements.emptyState.hidden = recipes.length !== 0;
  elements.list.hidden = recipes.length === 0;
}

function setRating(rating) {
  state.rating = rating;
  elements.filters.forEach((button) => {
    const active = button.dataset.rating === rating;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  render();
}

function clearFilters(shouldFocus = true) {
  state.query = "";
  elements.search.value = "";
  setRating("All");
  if (shouldFocus) elements.search.focus();
}

function setEntryMethod(method) {
  const showForm = method === "form";
  elements.form.hidden = !showForm;
  elements.pastePanel.hidden = showForm;
  elements.formTab.classList.toggle("active", showForm);
  elements.pasteTab.classList.toggle("active", !showForm);
  elements.formTab.setAttribute("aria-selected", String(showForm));
  elements.pasteTab.setAttribute("aria-selected", String(!showForm));
  if (showForm) elements.titleInput.focus();
  else elements.pasteInput.focus();
}

function resetDialog() {
  elements.form.reset();
  elements.ratingInput.value = "Excellent";
  elements.pasteInput.value = "";
  elements.formMessage.textContent = "";
  elements.pasteMessage.textContent = "";
  setEntryMethod("form");
}

function openDialog() {
  resetDialog();
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
  elements.pasteMessage.textContent = "";
  setEntryMethod("form");
  elements.formMessage.textContent = "Pasted details loaded. Review them, then add the recipe.";
}

function addRecipe(event) {
  event.preventDefault();
  if (!elements.form.reportValidity()) return;
  const recipe = {
    id: globalThis.crypto?.randomUUID?.() || `custom-${Date.now()}`,
    title: elements.titleInput.value.trim(),
    why: elements.whyInput.value.trim(),
    rating: elements.ratingInput.value,
    freeze: elements.freezeInput.value.trim(),
    url: elements.urlInput.value.trim(),
  };

  const duplicate = state.recipes.some((existing) =>
    normalizeUrl(existing.url) === normalizeUrl(recipe.url) ||
    existing.title.trim().toLocaleLowerCase() === recipe.title.toLocaleLowerCase()
  );
  if (duplicate) {
    elements.formMessage.textContent = "That recipe is already in the collection.";
    return;
  }

  state.customRecipes.push(recipe);
  mergeRecipes();
  saveCustomRecipes();
  clearFilters(false);
  closeDialog();
  showToast(`${recipe.title} added`);
  requestAnimationFrame(() => {
    document.querySelector(`[data-recipe-id="${recipe.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

async function loadRecipes() {
  try {
    const response = await fetch("recipes.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Recipe data request failed: ${response.status}`);
    state.baseRecipes = (await response.json()).sort((a, b) => Number(a.rank) - Number(b.rank));
    state.customRecipes = loadCustomRecipes();
    mergeRecipes();
    elements.pdfLinks.forEach((link) => { link.href = "printable/rons-recipes-2026.pdf"; });
    document.title = "Ron's Recipes";
    render();
  } catch (error) {
    console.error(error);
    elements.list.setAttribute("aria-busy", "false");
    elements.list.innerHTML = '<div class="empty-state"><h3>Recipes could not be loaded</h3><p>Please refresh the page and try again.</p></div>';
  }
}

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  render();
});
elements.filters.forEach((button) => button.addEventListener("click", () => setRating(button.dataset.rating)));
elements.clearFilters.addEventListener("click", () => clearFilters());
elements.clearButtons.forEach((button) => button.addEventListener("click", () => clearFilters()));
elements.openAdd.addEventListener("click", openDialog);
elements.closeDialog.addEventListener("click", closeDialog);
elements.cancelAdd.addEventListener("click", closeDialog);
elements.formTab.addEventListener("click", () => setEntryMethod("form"));
elements.pasteTab.addEventListener("click", () => setEntryMethod("paste"));
elements.usePasted.addEventListener("click", usePastedRecipe);
elements.form.addEventListener("submit", addRecipe);
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeDialog();
});

loadRecipes();
