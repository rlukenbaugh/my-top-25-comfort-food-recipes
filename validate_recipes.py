from pathlib import Path
from urllib.parse import urlparse
import json


ROOT = Path(__file__).resolve().parent
RATINGS = {"Outstanding", "Excellent", "Very good", "Good", "Fair"}
REQUIRED_FIELDS = {"rank", "title", "why", "rating", "url", "freeze", "ingredients", "instructions", "tags"}


def fail(messages):
    for message in messages:
        print(f"ERROR: {message}")
    raise SystemExit(1)


def main():
    errors = []
    try:
        recipes = json.loads((ROOT / "recipes.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail([f"recipes.json could not be read: {error}"])

    if not isinstance(recipes, list) or not recipes:
        fail(["recipes.json must contain a non-empty array."])

    try:
        food_com_catalog = json.loads((ROOT / "food-com-most-saved.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail([f"food-com-most-saved.json could not be read: {error}"])

    expected_ranks = list(range(1, len(recipes) + 1))
    ranks = [recipe.get("rank") for recipe in recipes if isinstance(recipe, dict)]
    if ranks != expected_ranks:
        errors.append(f"Ranks must be consecutive and ordered: expected {expected_ranks}, got {ranks}.")

    seen_titles = set()
    seen_urls = set()
    for index, recipe in enumerate(recipes, start=1):
        if not isinstance(recipe, dict):
            errors.append(f"Recipe {index} is not an object.")
            continue
        missing = REQUIRED_FIELDS - recipe.keys()
        if missing:
            errors.append(f"Recipe {index} is missing: {', '.join(sorted(missing))}.")
            continue

        for field in ("title", "why", "rating", "url", "freeze"):
            if not isinstance(recipe[field], str) or not recipe[field].strip():
                errors.append(f"Recipe {index} has an empty or invalid {field}.")
        if not isinstance(recipe["ingredients"], list) or not recipe["ingredients"]:
            errors.append(f"Recipe {index} must have a non-empty ingredients list.")
        elif any(not isinstance(item, str) or not item.strip() for item in recipe["ingredients"]):
            errors.append(f"Recipe {index} has an empty or invalid ingredient.")
        if not isinstance(recipe["instructions"], list) or not recipe["instructions"]:
            errors.append(f"Recipe {index} must have a non-empty instructions list.")
        elif any(not isinstance(item, str) or not item.strip() for item in recipe["instructions"]):
            errors.append(f"Recipe {index} has an empty or invalid instruction.")
        if not isinstance(recipe["tags"], list) or not recipe["tags"]:
            errors.append(f"Recipe {index} must have at least one recipe tag.")
        elif len(recipe["tags"]) > 8 or any(not isinstance(tag, str) or not tag.strip() for tag in recipe["tags"]):
            errors.append(f"Recipe {index} has invalid recipe tags.")

        title_key = recipe["title"].strip().casefold()
        url_key = recipe["url"].strip().rstrip("/").casefold()
        if title_key in seen_titles:
            errors.append(f"Duplicate title: {recipe['title']}.")
        if url_key in seen_urls:
            errors.append(f"Duplicate URL: {recipe['url']}.")
        seen_titles.add(title_key)
        seen_urls.add(url_key)

        if recipe["rating"].replace("*", "").strip() not in RATINGS:
            errors.append(f"Recipe {index} has unsupported freezer rating: {recipe['rating']}.")
        parsed_url = urlparse(recipe["url"])
        if parsed_url.scheme != "https" or not parsed_url.hostname:
            errors.append(f"Recipe {index} must use a valid HTTPS source URL: {recipe['url']}.")

    food_com_recipes = food_com_catalog.get("recipes") if isinstance(food_com_catalog, dict) else None
    if not isinstance(food_com_recipes, list) or len(food_com_recipes) != 50:
        errors.append("food-com-most-saved.json must contain exactly 50 recipes.")
    else:
        expected_food_ranks = list(range(1, 51))
        if [recipe.get("rank") for recipe in food_com_recipes if isinstance(recipe, dict)] != expected_food_ranks:
            errors.append("Food.com ranks must be consecutive from 1 through 50.")
        food_urls = set()
        food_titles = set()
        for index, recipe in enumerate(food_com_recipes, start=1):
            if not isinstance(recipe, dict) or set(recipe) != {"rank", "title", "url"}:
                errors.append(f"Food.com recipe {index} must contain only rank, title, and url.")
                continue
            title = str(recipe["title"]).strip()
            url = str(recipe["url"]).strip()
            parsed = urlparse(url)
            if not title:
                errors.append(f"Food.com recipe {index} has no title.")
            if parsed.scheme != "https" or parsed.hostname not in {"food.com", "www.food.com"} or not parsed.path.startswith("/recipe/"):
                errors.append(f"Food.com recipe {index} has an invalid URL: {url}.")
            if title.casefold() in food_titles:
                errors.append(f"Duplicate Food.com title: {title}.")
            if url.rstrip("/").casefold() in food_urls:
                errors.append(f"Duplicate Food.com URL: {url}.")
            food_titles.add(title.casefold())
            food_urls.add(url.rstrip("/").casefold())
    if food_com_catalog.get("source") != "https://www.food.com/ideas/most-saved-recipes-6799":
        errors.append("The Food.com catalog source URL is missing or unexpected.")

    app_source = (ROOT / "index.html").read_text(encoding="utf-8") + (ROOT / "app-v1.7.js").read_text(encoding="utf-8")
    for required_reference in (
        "recipes.json",
        "food-com-most-saved.json",
        "app-v1.7.js",
        "styles-v1.7.css",
        "printable/rons-recipes-2026.pdf",
        "manifest.webmanifest",
        "food-com-most-saved.json",
        "service-worker.js",
        "assets/icons/favicon.svg",
        "assets/og/rons-recipes-share-1200x630.png",
    ):
        if required_reference not in app_source:
            errors.append(f"The web app does not reference {required_reference}.")

    for required_file in (
        "manifest.webmanifest",
        "service-worker.js",
        "assets/icons/favicon.svg",
        "assets/icons/favicon.ico",
        "assets/icons/apple-touch-icon.png",
        "assets/icons/icon-192.png",
        "assets/icons/icon-512.png",
        "assets/icons/icon-maskable-512.png",
        "assets/og/rons-recipes-share-1200x630.png",
    ):
        if not (ROOT / required_file).is_file():
            errors.append(f"Required web asset is missing: {required_file}.")

    if errors:
        fail(errors)

    print(f"PASS: {len(recipes)} bundled recipes and 50 Food.com catalog entries validated")
    print("Ranks, required fields, tags, ratings, titles, ingredients, instructions, and HTTPS source URLs are valid.")


if __name__ == "__main__":
    main()
