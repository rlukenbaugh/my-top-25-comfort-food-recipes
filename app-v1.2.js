const STORAGE_KEY = "rons-recipes.custom.v1";
const REMOVED_STORAGE_KEY = "rons-recipes.removed.v1";
const BACKUP_FORMAT = "rons-recipes-backup";
const BACKUP_VERSION = 1;
const RATINGS = ["Outstanding", "Excellent", "Very good", "Good", "Fair"];
let deferredInstallPrompt = null;

const state = {
  baseRecipes: [],
  customRecipes: [],
  allRecipes: [],
  recipes: [],
  removedKeys: new Set(),
  query: "",
  rating: "All",
  editingRecipeId: null,
};

const elements = {
  list: document.querySelector("#recipe-list"),
  template: document.querySelector("#recipe-template"),
  search: document.querySelector("#search"),
  filters: [...document.querySelectorAll(".filter")],
  resultCount: document.querySelector("#result-count"),
  recipeCounts: [...document.querySelectorAll("[data-recipe-count]")],
  clearFilters: document.querySelector("#clear-filters"),
  restoreRemoved: document.querySelector("#restore-removed"),
  removedCount: document.querySelector("#removed-count"),
  browseToolbar: document.querySelector("#browse-toolbar"),
  backToTop: document.querySelector("#back-to-top"),
  installApp: document.querySelector("#install-app"),
  brand: document.querySelector(".brand"),
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
  elements.removedCount.textContent = state.removedKeys.size;
  elements.restoreRemoved.hidden = state.removedKeys.size === 0;
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
    state.customRecipes = state.customRecipes.filter((recipe) => recipe.id !== pendingRemoval.id);
    state.removedKeys.delete(recipeKey(pendingRemoval));
    mergeRecipes();
    if (!saveCustomRecipes() || !saveRemovedKeys()) {
      state.customRecipes = previousCustomRecipes;
      state.removedKeys = previousRemovedKeys;
      mergeRecipes();
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

function backupRecipe(recipe) {
  return {
    id: recipe.id,
    title: recipe.title,
    why: recipe.why,
    rating: normalizedRating(recipe.rating),
    freeze: recipe.freeze,
    url: recipe.url,
  };
}

function updateManageSummary() {
  const customCount = state.customRecipes.length;
  const hiddenCount = state.removedKeys.size;
  elements.manageSummary.textContent = `${customCount} personal ${customCount === 1 ? "recipe" : "recipes"} and ${hiddenCount} hidden ${hiddenCount === 1 ? "recipe" : "recipes"} are saved on this device.`;
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
  };
  return isValidCustomRecipe(normalized) ? normalized : null;
}

async function importBackupFile(file) {
  try {
    const backup = JSON.parse(await file.text());
    if (backup?.format !== BACKUP_FORMAT || backup?.version !== BACKUP_VERSION || !Array.isArray(backup.customRecipes) || !Array.isArray(backup.removedKeys)) {
      throw new Error("This is not a supported Ron's Recipes backup.");
    }

    const previousCustomRecipes = state.customRecipes;
    const previousRemovedKeys = new Set(state.removedKeys);
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
    mergeRecipes();
    if (!saveCustomRecipes() || !saveRemovedKeys()) {
      state.customRecipes = previousCustomRecipes;
      state.removedKeys = previousRemovedKeys;
      mergeRecipes();
      saveCustomRecipes();
      saveRemovedKeys();
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
    const response = await fetch("recipes.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Recipe data request failed: ${response.status}`);
    state.baseRecipes = (await response.json()).sort((a, b) => Number(a.rank) - Number(b.rank));
    state.customRecipes = loadCustomRecipes();
    state.removedKeys = loadRemovedKeys();
    mergeRecipes();
    saveRemovedKeys();
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
updateScrollEnhancements();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.info("Offline support is unavailable.", error);
    });
  });
}
