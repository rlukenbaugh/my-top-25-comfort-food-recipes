from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import json
import re


ROOT = Path(__file__).resolve().parent
PROTECTED_STATUSES = {403, 429}
BROKEN_STATUSES = {404, 410}
STOP_WORDS = {"a", "and", "best", "john", "johns", "of", "recipe", "s", "the", "with"}


def meaningful_words(value):
    return [word for word in re.findall(r"[a-z0-9]+", value.casefold()) if word not in STOP_WORDS]


def title_matches(recipe_title, html):
    match = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return True
    page_words = set(meaningful_words(re.sub(r"<[^>]+>", " ", match.group(1))))
    expected_words = meaningful_words(recipe_title)
    required = expected_words[: min(2, len(expected_words))]
    return all(word in page_words for word in required)


def check_recipe(recipe):
    request = Request(
        recipe["url"],
        headers={
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        },
    )
    try:
        with urlopen(request, timeout=25) as response:
            status = response.status
            final_url = response.geturl()
            body = response.read(600_000).decode("utf-8", errors="ignore")
            if status in BROKEN_STATUSES:
                return "BROKEN", recipe, f"HTTP {status}"
            if not title_matches(recipe["title"], body):
                same_food_com_recipe = (
                    recipe.get("group") == "Food.com" and
                    urlsplit(final_url).path.rstrip("/") == urlsplit(recipe["url"]).path.rstrip("/") and
                    re.search(r'"@type"\s*:\s*"Recipe"', body)
                )
                if same_food_com_recipe:
                    return "PASS", recipe, f"HTTP {status}; Food.com uses an alternate display title"
                return "BROKEN", recipe, "destination title does not match"
            return "PASS", recipe, f"HTTP {status}"
    except HTTPError as error:
        if error.code in PROTECTED_STATUSES:
            return "PROTECTED", recipe, f"HTTP {error.code}; destination blocks automated requests"
        return "BROKEN", recipe, f"HTTP {error.code}"
    except (URLError, TimeoutError, OSError) as error:
        return "BROKEN", recipe, str(error)


def main():
    bundled = json.loads((ROOT / "recipes.json").read_text(encoding="utf-8"))
    food_com_catalog = json.loads((ROOT / "food-com-most-saved.json").read_text(encoding="utf-8"))
    recipes = [
        *({**recipe, "group": "Bundled"} for recipe in bundled),
        *({**recipe, "group": "Food.com"} for recipe in food_com_catalog["recipes"]),
        {
            "rank": 0,
            "title": food_com_catalog["title"],
            "url": food_com_catalog["source"],
            "group": "Food.com source",
        },
    ]
    results = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(check_recipe, recipe) for recipe in recipes]
        for future in as_completed(futures):
            results.append(future.result())

    results.sort(key=lambda item: (item[1]["group"], item[1]["rank"]))
    for outcome, recipe, detail in results:
        rank = f"#{recipe['rank']:02d}" if recipe["rank"] else "   "
        print(f"{outcome:9} {recipe['group']:15} {rank} {recipe['title']} - {detail}")

    broken = [result for result in results if result[0] == "BROKEN"]
    protected = [result for result in results if result[0] == "PROTECTED"]
    print(f"\nChecked every published recipe/source link ({len(results)} total): {len(results) - len(broken) - len(protected)} verified, {len(protected)} protected, {len(broken)} broken.")
    if broken:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
