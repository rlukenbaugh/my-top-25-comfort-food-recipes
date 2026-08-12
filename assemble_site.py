from __future__ import annotations

import argparse
import os
import re
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TOKEN = "__BUILD_VERSION__"
TEXT_FILES = ("index.html", "app-v1.7.js", "service-worker.js")
COPY_FILES = ("styles-v1.7.css", "recipes.json", "food-com-most-saved.json", "manifest.webmanifest")


def build(output: Path, version: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9._-]+", version):
        raise SystemExit("Build version may contain only letters, numbers, dots, underscores, and hyphens.")
    output = output.resolve()
    if output == ROOT or ROOT not in output.parents:
        raise SystemExit("Build output must be a generated directory inside the repository.")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    for filename in TEXT_FILES:
        source = (ROOT / filename).read_text(encoding="utf-8")
        rendered = source.replace(TOKEN, version)
        if TOKEN in rendered:
            raise SystemExit(f"Unreplaced build token remains in {filename}.")
        (output / filename).write_text(rendered, encoding="utf-8")

    for filename in COPY_FILES:
        shutil.copy2(ROOT / filename, output / filename)
    shutil.copytree(ROOT / "assets", output / "assets")

    printable = output / "printable"
    printable.mkdir()
    pdfs = list((ROOT / "outputs").glob("*.pdf"))
    if not pdfs:
        raise SystemExit("No printable PDF was found. Run the PDF build first.")
    for pdf in pdfs:
        shutil.copy2(pdf, printable / pdf.name)
    (output / ".nojekyll").touch()
    print(f"Assembled {output} with build version {version}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Assemble the versioned GitHub Pages site.")
    parser.add_argument("--output", default="_site")
    parser.add_argument("--version", default=os.environ.get("GITHUB_SHA", "local-dev")[:12])
    args = parser.parse_args()
    build(ROOT / args.output, args.version)


if __name__ == "__main__":
    main()
