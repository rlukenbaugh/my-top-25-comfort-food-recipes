# Ron's Recipes

An editable Windows project that builds a printable US Letter PDF from `recipes.json`.

## Web app

Open the live collection at:

https://rlukenbaugh.github.io/my-top-25-comfort-food-recipes/

The web app reads the same `recipes.json` file as the printable book. It includes a time-aware cooking dashboard, sticky search and freezer-rating filters, personal recipe collections, a recipe-linked shopping list, a pantry matcher, a random-recipe picker, rating-accented recipe cards, expandable mobile details, a back-to-top control, a live kitchen measurement converter, original-recipe links, a downloadable PDF, and browser-based recipe additions. GitHub Pages validates, tests, rebuilds, and republishes it whenever `main` is updated.

The site also includes branded sharing metadata, install icons, a web-app manifest, an install prompt when supported by the browser, and an offline app-shell cache. After the first successful visit, the recipe list and freezer notes remain available without a connection; the printable PDF and original Allrecipes pages still require internet access.

### Add, copy, and paste recipes

- Select **Add Recipe** to enter a recipe with a simple form.
- Select **Paste recipe** to import labeled recipe text or a JSON recipe object.
- Select **Copy recipe** on any entry to copy it in the exact labeled format accepted by the paste tool.
- Personal recipes have **Edit** and permanent **Delete** actions.
- Select **Remove** to hide a recipe on that browser after confirmation. Select **Restore Removed** to bring hidden recipes back.
- Select **Manage** to export a JSON backup or safely merge a previously exported backup.
- Recipe numbers automatically close any gaps when recipes are removed and return to their original order when restored.
- Recipes added in the web app are saved only in that browser on that device. They are private to that visitor and do not modify the shared GitHub list or printable PDF.
- Removed recipes are also remembered only by that browser. They are never deleted from the shared GitHub list or printable PDF.

### Collections and shopping list

- Select **Collections** to use the starter folders (Crockpot, Easy, New, Favorites, and Weeknight) or create your own.
- Select **Collections** on a recipe card to assign that recipe to one or more folders. The **View** action filters the main recipe list to that folder.
- Select **Add to Shopping List** on any built-in recipe to choose directly from the ingredient list loaded from its linked original recipe. Personal recipes still support the paste-once ingredient editor.
- The shopping list supports manual items, checkboxes, individual removal, clearing checked items, copying, and printing.
- Ingredients, collections, and the shopping list are private to the current browser and are included in exported backups.
- The home-page shortcuts open Add Recipe and Shopping List, return to all recipes, match pantry terms against recipe ingredients, or highlight a random favorite.

## Add or change a recipe

1. Open `recipes.json` in Notepad or Codex.
2. Copy an existing recipe block.
3. Update these fields:
   - `rank`
   - `title`
   - `why`
   - `rating`
   - `url`
   - `freeze`
   - `ingredients` (an array with one ingredient per line)
4. Keep the commas between recipe blocks and save the file.
5. Double-click `build.cmd`, or open a terminal in this folder and run:

```text
build.cmd
```

The finished PDF is written to `outputs`. Its filename and cover count update automatically from the number of recipes in `recipes.json`.

## Validate the finished PDF

Run:

```text
verify.cmd
```

This confirms the page count, embedded source links, and recipe count.

## Run all web-app checks

Install the test dependencies and Chromium once:

```text
npm.cmd install
npx.cmd playwright install chromium
```

Then run:

```text
npm.cmd test
```

This validates the recipe data and exercises search, filters, dashboard shortcuts, pantry matching, surprise selection, collections, ingredients, shopping-list actions, keyboard tabs, mobile details, touch targets, color contrast, accessibility, add/edit/delete, and backup export/import. `npm.cmd run test:links` performs the external-link audit; Allrecipes may report protected HTTP 403 responses when it blocks automated requests.

## Project files

- `recipes.json` - the recipe list you edit
- `build_recipe_book.py` - PDF layout and design
- `build.cmd` - installs the needed Python packages and builds the PDF
- `verify_book.py` - checks the generated PDF
- `verify.cmd` - runs the verification check
- `validate_recipes.py` - validates ranks, fields, ratings, and source URLs
- `check_links.py` - performs the scheduled external-link audit
- `manifest.webmanifest` and `service-worker.js` - install and offline support
- `assets/` - favicon, app icons, and social sharing image
- `generate_web_assets.py` - reproducibly rebuilds the branded web assets
- `tests/app.spec.js` - browser interaction and accessibility tests

Full recipe instructions remain on the linked Allrecipes pages. This project stores your ranking, notes, freezer guidance, and source links.

## Preview the web app locally

From this project folder, run:

```text
py -3 -m http.server 4173
```

Then open `http://localhost:4173` in a browser.
