from __future__ import annotations

import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TOKEN = "__BUILD_VERSION__"


def fail(message: str) -> None:
    print(f"ERROR: {message}")
    raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify the assembled GitHub Pages output.")
    parser.add_argument("--site", default="_site")
    parser.add_argument("--version", required=True)
    args = parser.parse_args()

    site = (ROOT / args.site).resolve()
    if site == ROOT or ROOT not in site.parents or not site.is_dir():
        fail("The generated site directory is missing or outside this repository.")

    expected_files = (
        "index.html",
        "app-v1.7.js",
        "styles-v1.7.css",
        "service-worker.js",
        "recipes.json",
        "manifest.webmanifest",
        "printable/rons-recipes-2026.pdf",
        "assets/icons/icon-192.png",
    )
    missing = [filename for filename in expected_files if not (site / filename).is_file()]
    if missing:
        fail(f"Generated site is missing: {', '.join(missing)}")

    rendered_files = (site / "index.html", site / "app-v1.7.js", site / "service-worker.js")
    rendered = "\n".join(path.read_text(encoding="utf-8") for path in rendered_files)
    if TOKEN in rendered:
        fail("An unreplaced build-version token remains in the generated site.")
    if rendered.count(args.version) < 6:
        fail("The build version was not injected into every cache-sensitive URL and cache name.")
    service_worker = (site / "service-worker.js").read_text(encoding="utf-8")
    if f'const BUILD_VERSION = "{args.version}"' not in service_worker or "`${CACHE_PREFIX}${BUILD_VERSION}`" not in service_worker:
        fail("The service-worker cache is not tied to the requested build version.")

    print(f"PASS: generated site uses build version {args.version}")
    print("HTML, recipe data, scripts, styles, PDF, icons, and the versioned offline cache are present.")


if __name__ == "__main__":
    main()
