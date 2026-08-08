# My Comfort-Food Recipe Book

An editable Windows project that builds a printable US Letter PDF from `recipes.json`.

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
