const state = { recipes: [], query: "", rating: "All" };

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
};

function normalizedRating(rating) {
  return rating.replace("*", "").trim();
}

function filteredRecipes() {
  const query = state.query.toLocaleLowerCase();
  return state.recipes.filter((recipe) => {
    const matchesRating = state.rating === "All" || normalizedRating(recipe.rating) === state.rating;
    const haystack = [recipe.title, recipe.why, recipe.freeze, recipe.rating].join(" ").toLocaleLowerCase();
    return matchesRating && (!query || haystack.includes(query));
  });
}

function createRecipeRow(recipe) {
  const row = elements.template.content.firstElementChild.cloneNode(true);
  row.querySelector(".rank").textContent = recipe.rank;
  row.querySelector(".recipe-title").textContent = recipe.title;
  row.querySelector(".recipe-why").textContent = recipe.why;
  row.querySelector(".recipe-rating strong").textContent = normalizedRating(recipe.rating);
  row.querySelector(".recipe-freeze p").textContent = recipe.freeze;
  const link = row.querySelector(".recipe-link");
  link.href = recipe.url;
  link.setAttribute("aria-label", `Open original recipe for ${recipe.title}`);
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

function clearFilters() {
  state.query = "";
  elements.search.value = "";
  setRating("All");
  elements.search.focus();
}

async function loadRecipes() {
  try {
    const response = await fetch("recipes.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Recipe data request failed: ${response.status}`);
    state.recipes = (await response.json()).sort((a, b) => Number(a.rank) - Number(b.rank));
    const count = state.recipes.length;
    elements.recipeCounts.forEach((element) => { element.textContent = count; });
    elements.pdfLinks.forEach((link) => { link.href = `printable/my-top-${count}-comfort-food-recipes-2026.pdf`; });
    document.title = `My Top ${count} Comfort-Food Recipes`;
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
elements.clearFilters.addEventListener("click", clearFilters);
elements.clearButtons.forEach((button) => button.addEventListener("click", clearFilters));
loadRecipes();
