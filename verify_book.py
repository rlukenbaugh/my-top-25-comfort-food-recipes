from pathlib import Path
import json
import sys

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parent
recipes = json.loads((ROOT / "recipes.json").read_text(encoding="utf-8"))
pdfs = sorted((ROOT / "outputs").glob("*.pdf"), key=lambda path: path.stat().st_mtime, reverse=True)

if not pdfs:
    raise SystemExit("No PDF found. Run build.ps1 first.")

pdf = pdfs[0]
reader = PdfReader(str(pdf))
uris = []

for page in reader.pages:
    for annotation in page.get("/Annots", []):
        action = annotation.get_object().get("/A") or {}
        uri = action.get("/URI")
        if uri:
            uris.append(str(uri))

expected = {recipe["url"] for recipe in recipes}
actual = set(uris)
errors = []

if actual != expected:
    errors.append("Embedded PDF links do not match recipes.json.")
if len(uris) != len(recipes) * 2:
    errors.append("Each recipe should have one text link and one QR-code link.")
if len(reader.pages) != 3 + ((len(recipes) + 1) // 2):
    errors.append("Unexpected PDF page count.")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)

print(f"PASS: {pdf.name}")
print(f"Pages: {len(reader.pages)}")
print(f"Recipes: {len(recipes)}")
print(f"Unique source links: {len(actual)}")
