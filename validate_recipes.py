from pathlib import Path
from urllib.parse import urlparse
import json


ROOT = Path(__file__).resolve().parent
RATINGS = {"Outstanding", "Excellent", "Very good", "Good", "Fair"}
REQUIRED_FIELDS = {"rank", "title", "why", "rating", "url", "freeze", "ingredients"}


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
        if parsed_url.scheme != "https" or parsed_url.hostname not in {"allrecipes.com", "www.allrecipes.com"}:
            errors.append(f"Recipe {index} must use an HTTPS Allrecipes URL: {recipe['url']}.")

    app_source = (ROOT / "index.html").read_text(encoding="utf-8") + (ROOT / "app-v1.5.js").read_text(encoding="utf-8")
    for required_reference in (
        "recipes.json",
        "app-v1.5.js",
        "styles-v1.5.css",
        "printable/rons-recipes-2026.pdf",
        "manifest.webmanifest",
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

    print(f"PASS: {len(recipes)} recipes validated")
    print("Ranks, required fields, ratings, titles, and source URLs are valid.")


if __name__ == "__main__":
    main()
