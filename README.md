# Ron's Recipes

An editable Windows project that builds a printable US Letter PDF from `recipes.json`.

## Web app

Open the live collection at:

https://rlukenbaugh.github.io/my-top-25-comfort-food-recipes/

The web app reads the same `recipes.json` file as the printable book. It includes search, freezer-rating filters, mobile layout, original-recipe links, a downloadable PDF, and browser-based recipe additions. GitHub Pages rebuilds and republishes it whenever `main` is updated.

### Add, copy, and paste recipes

- Select **Add Recipe** to enter a recipe with a simple form.
- Select **Paste recipe** to import labeled recipe text or a JSON recipe object.
- Select **Copy recipe** on any entry to copy it in the exact labeled format accepted by the paste tool.
- Select **Remove** to hide a recipe on that browser after confirmation. Select **Restore Removed** to bring hidden recipes back.
- Recipe numbers automatically close any gaps when recipes are removed and return to their original order when restored.
- Recipes added in the web app are saved only in that browser on that device. They are private to that visitor and do not modify the shared GitHub list or printable PDF.
- Removed recipes are also remembered only by that browser. They are never deleted from the shared GitHub list or printable PDF.

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

## Project files

- `recipes.json` - the recipe list you edit
- `build_recipe_book.py` - PDF layout and design
- `build.cmd` - installs the needed Python packages and builds the PDF
- `verify_book.py` - checks the generated PDF
- `verify.cmd` - runs the verification check

Full recipe instructions remain on the linked Allrecipes pages. This project stores your ranking, notes, freezer guidance, and source links.

## Preview the web app locally

From this project folder, run:

```text
py -3 -m http.server 4173
```

Then open `http://localhost:4173` in a browser.
