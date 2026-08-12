# Ron's Recipes

An editable Windows project that builds a printable US Letter PDF from `recipes.json`.

## Web app

Open the live collection at:

https://rlukenbaugh.github.io/my-top-25-comfort-food-recipes/

The web app reads the same `recipes.json` file as the printable book. It includes a time-aware cooking dashboard, sticky search plus rating and recipe-tag filters, private Mealie-assisted recipe importing by URL, a selectable Food.com Top 50 importer, personal recipe collections, an aisle-sorted recipe-linked shopping list, a synonym-aware pantry matcher, per-recipe serving scaling, a random-recipe picker, rating-accented recipe cards, expandable mobile details, a back-to-top control, a live kitchen measurement converter, original-recipe links, a downloadable PDF, one-click printing with ingredients and instructions for individual recipes, and browser-based recipe additions. GitHub Pages validates, tests, rebuilds, and republishes it whenever `main` is updated.

The site also includes branded sharing metadata, install icons, a web-app manifest, an install prompt when supported by the browser, and a tested offline app-shell cache. The Pages build injects the current Git commit into cache-sensitive URLs and the service-worker cache name, so deployments cannot depend on a hand-edited cache-busting number. After the first successful visit, the recipe list and freezer notes remain available without a connection; the printable PDF and original Allrecipes pages still require internet access.

### Add, copy, and paste recipes

- Select **Add Recipe** to enter a recipe with a simple form.
- Select **Import URL** to have the Mealie server on this PC preview a public recipe page and fill the form. Review the imported fields and add a freezer note before saving.
- Select **Food.com Top 50** to choose any of Food.com's 50 most-saved recipes and import them in batches. Successful recipes are placed in a private **Food.com Most-Saved** collection with their ingredients and instructions; existing recipes are reused, and one failed page does not stop the rest.
- Select **Paste recipe** to import labeled recipe text or a JSON recipe object.
- Select **Copy recipe** on any entry to copy it in the exact labeled format accepted by the paste tool.
- Every recipe card has an **Edit** action for locally saved changes to its title, notes, rating, tags, source link, ingredients, and instructions. Personal recipes also have a permanent **Delete** action.
- Edits to bundled recipes stay in this browser, are included in backups, and do not alter the shared printable PDF.
- Select **Remove** to hide a recipe on that browser after confirmation. Select **Restore Removed** to bring hidden recipes back.
- Select **Manage** to export a JSON backup or safely merge a previously exported backup. After personal data is saved, the home page also reminds you when no backup exists or the latest backup is at least 14 days old; the reminder can be snoozed for three days.
- Recipe numbers automatically close any gaps when recipes are removed and return to their original order when restored.
- Recipes added in the web app are saved only in that browser on that device. They are private to that visitor and do not modify the shared GitHub list or printable PDF.
- Removed recipes are also remembered only by that browser. They are never deleted from the shared GitHub list or printable PDF.

### Import a recipe URL with Mealie

The GitHub Pages app never receives or stores the Mealie API token. A small loopback-only bridge on this PC holds the token, validates public recipe URLs, and asks Mealie for a preview. Previewing does not add a recipe to Mealie, and saving adds only the curated recipe fields to this browser.

1. Keep the API token in `.env`. The recommended format is `MEALIE_API_TOKEN=your-token`; the bridge also accepts the existing single raw-token line.
2. Confirm `MEALIE_URL` in `.env` if Mealie is not at `http://192.168.1.60:9925`.
3. Double-click `start_mealie_bridge.cmd`, or run `npm.cmd run start:mealie` from this folder.
4. In Ron's Recipes, select **Add Recipe** and **Import URL**. On first use, Chrome or Edge asks to find and connect to devices on the local network; select **Allow** so the hosted site can reach the bridge on this PC.
5. Paste a public recipe URL and select **Preview Recipe**.
6. Select **Use Imported Recipe**, add a freezer note, review the form, and save.

For a batch import, choose **Food.com Top 50**, select individual recipes or **Select all**, then choose **Import Selected**. The importer works in groups of five so progress is visible and the private bridge remains responsive. Batch imports use a neutral **Good** freezer rating and a reminder to review freezer guidance; edit those fields after you decide how well each dish freezes.

The bridge listens only on `127.0.0.1:9931`, permits only the live Ron's Recipes site and documented local preview origins, rate-limits requests, and blocks private/local target URLs. It must be running whenever you import. If local access was previously blocked in Chrome or Edge, select the site-controls icon beside the address, open **Site settings**, set **Local network access** to **Allow**, and reload the page. Because the bridge uses this PC's loopback address, URL importing is PC-only; phones and tablets can still use every other site feature.

### Collections and shopping list

- Select **Collections** to use the starter folders (Crockpot, Easy, New, Favorites, and Weeknight) or create your own.
- Select **Collections** on a recipe card to assign that recipe to one or more folders. The **View** action filters the main recipe list to that folder.
- Select **Add to Shopping List** on any built-in recipe to choose directly from the ingredient list loaded from its linked original recipe. Personal recipes still support the paste-once ingredient editor.
- Ingredient amounts can be scaled to ½×, 1×, 2×, or 3× before adding them to the shopping list; package sizes inside parentheses stay unchanged.
- The shopping list merges duplicate ingredients, preserves each recipe's amount, groups items by grocery aisle, and supports manual items, checkboxes, individual removal, clearing checked items, copying, and printing.
- Ingredients, collections, and the shopping list are private to the current browser and are included in exported backups.
- The home-page shortcuts open Add Recipe and Shopping List, return to all recipes, match pantry terms against recipe ingredients, or highlight a random favorite. Pantry matching understands common synonyms and close spellings, shows missing ingredients for near-matches, and can add those missing items to the shopping list.

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
   - `instructions` (an array with one step per line)
   - `tags` (an array such as `American`, `Chicken`, and `Weeknight`)
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

This validates the recipe data and the private Mealie bridge, then exercises URL-import previews, Food.com batch imports, search, tags, filters, dashboard shortcuts, synonym and fuzzy pantry matching, missing-ingredient actions, recipe scaling, duplicate shopping-item merging, aisle grouping, backup reminders, surprise selection, collections, keyboard tabs, mobile details, touch targets, color contrast, accessibility, add/edit/delete, true offline reload, and backup export/import. `npm.cmd run test:links` checks every bundled recipe link, every Food.com Top 50 link, and the Food.com source-list link. A site may report a protected HTTP 403/429 response when it blocks automated requests; broken or mismatched destinations fail the audit.

## Project files

- `recipes.json` - the recipe list you edit
- `food-com-most-saved.json` - the checked Food.com Top 50 catalog used by the batch picker
- `build_recipe_book.py` - PDF layout and design
- `build.cmd` - installs the needed Python packages and builds the PDF
- `verify_book.py` - checks the generated PDF
- `verify.cmd` - runs the verification check
- `validate_recipes.py` - validates ranks, fields, ratings, and source URLs
- `assemble_site.py` - injects the deployment commit hash and assembles the Pages artifact
- `verify_web_build.py` - verifies the generated files and versioned offline cache
- `check_links.py` - performs the scheduled external-link audit
- `mealie_bridge.py` and `start_mealie_bridge.cmd` - run the private loopback importer without exposing the API token
- `.env.example` - documents bridge configuration; the real `.env` is ignored by Git
- `manifest.webmanifest` and `service-worker.js` - install and offline support
- `assets/` - favicon, app icons, and social sharing image
- `generate_web_assets.py` - reproducibly rebuilds the branded web assets
- `tests/app.spec.js` - browser interaction and accessibility tests

The web app stores concise step-by-step instructions with each recipe and keeps the original source link for reference.

## Preview the web app locally

From this project folder, run:

```text
py -3 -m http.server 4173
```

Then open `http://localhost:4173` in a browser.
