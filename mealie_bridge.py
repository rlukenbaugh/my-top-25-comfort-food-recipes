from __future__ import annotations

import argparse
import html
import ipaddress
import json
import os
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DEFAULT_MEALIE_URL = "http://192.168.1.60:9925"
DEFAULT_PORT = 9931
MAX_BODY_BYTES = 16_384
MAX_REQUESTS_PER_MINUTE = 30
DEFAULT_ALLOWED_ORIGINS = {
    "https://rlukenbaugh.github.io",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
}


class BridgeError(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class BridgeConfig:
    token: str = field(repr=False)
    mealie_url: str
    host: str
    port: int
    allowed_origins: frozenset[str]


def read_env_file(path: Path) -> tuple[dict[str, str], str]:
    values: dict[str, str] = {}
    raw_token = ""
    if not path.is_file():
        return values, raw_token
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped and not raw_token:
            raw_token = stripped
            continue
        name, separator, value = stripped.partition("=")
        if separator and name.strip():
            values[name.strip()] = value.strip().strip('"').strip("'")
    return values, raw_token


def load_config(env_path: Path = ROOT / ".env") -> BridgeConfig:
    file_values, raw_token = read_env_file(env_path)
    token = os.environ.get("MEALIE_API_TOKEN") or file_values.get("MEALIE_API_TOKEN") or raw_token
    if not token:
        raise BridgeError("MEALIE_API_TOKEN is not configured in .env.", 500)
    mealie_url = (os.environ.get("MEALIE_URL") or file_values.get("MEALIE_URL") or DEFAULT_MEALIE_URL).rstrip("/")
    parsed_mealie = urllib.parse.urlparse(mealie_url)
    if parsed_mealie.scheme not in {"http", "https"} or not parsed_mealie.hostname:
        raise BridgeError("MEALIE_URL must be a valid HTTP or HTTPS address.", 500)
    host = os.environ.get("MEALIE_BRIDGE_HOST") or file_values.get("MEALIE_BRIDGE_HOST") or "127.0.0.1"
    try:
        if not ipaddress.ip_address(host).is_loopback:
            raise ValueError
    except ValueError as error:
        raise BridgeError("The bridge must bind to a loopback address.", 500) from error
    try:
        port = int(os.environ.get("MEALIE_BRIDGE_PORT") or file_values.get("MEALIE_BRIDGE_PORT") or DEFAULT_PORT)
    except ValueError as error:
        raise BridgeError("MEALIE_BRIDGE_PORT must be a number.", 500) from error
    if not 1024 <= port <= 65535:
        raise BridgeError("MEALIE_BRIDGE_PORT must be between 1024 and 65535.", 500)
    extra_origins = os.environ.get("MEALIE_ALLOWED_ORIGINS") or file_values.get("MEALIE_ALLOWED_ORIGINS") or ""
    allowed_origins = DEFAULT_ALLOWED_ORIGINS | {origin.strip().rstrip("/") for origin in extra_origins.split(",") if origin.strip()}
    return BridgeConfig(token=token, mealie_url=mealie_url, host=host, port=port, allowed_origins=frozenset(allowed_origins))


def is_public_ip(value: str) -> bool:
    address = ipaddress.ip_address(value)
    return address.is_global


def validate_recipe_url(value: Any) -> str:
    candidate = str(value or "").strip()
    if len(candidate) > 2048:
        raise BridgeError("The recipe URL is too long.")
    parsed = urllib.parse.urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise BridgeError("Enter a public HTTP or HTTPS recipe URL.")
    try:
        port = parsed.port
    except ValueError as error:
        raise BridgeError("The recipe URL has an invalid port.") from error
    if port not in {None, 80, 443}:
        raise BridgeError("Recipe URLs may use only the standard HTTP or HTTPS port.")
    hostname = parsed.hostname.rstrip(".").lower()
    if hostname == "localhost" or hostname.endswith(".local"):
        raise BridgeError("Local and private addresses cannot be scraped.")
    try:
        addresses = [str(ipaddress.ip_address(hostname))]
    except ValueError:
        try:
            addresses = list({result[4][0] for result in socket.getaddrinfo(hostname, port or (443 if parsed.scheme == "https" else 80))})
        except socket.gaierror as error:
            raise BridgeError("That recipe site could not be found.") from error
    if not addresses or any(not is_public_ip(address) for address in addresses):
        raise BridgeError("Local and private addresses cannot be scraped.")
    return urllib.parse.urlunparse(parsed._replace(fragment=""))


def request_json(url: str, *, token: str, method: str = "GET", payload: dict[str, Any] | None = None, timeout: int = 60) -> Any:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            **({"Content-Type": "application/json"} if data is not None else {}),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        if error.code in {401, 403}:
            raise BridgeError("Mealie rejected the configured API token.", 502) from error
        if error.code == 422:
            raise BridgeError("Mealie could not recognize recipe data at that URL.", 422) from error
        raise BridgeError(f"Mealie returned HTTP {error.code} while scraping that recipe.", 502) from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise BridgeError("Mealie could not be reached or returned an invalid response.", 502) from error


def first_text(value: Any) -> str:
    if isinstance(value, str):
        return html.unescape(value).strip()
    if isinstance(value, list):
        for item in value:
            text = first_text(item)
            if text:
                return text
    if isinstance(value, dict):
        for key in ("text", "name", "url", "contentUrl"):
            text = first_text(value.get(key))
            if text:
                return text
    return ""


def text_list(value: Any) -> list[str]:
    if value is None:
        return []
    source = value if isinstance(value, list) else [value]
    result: list[str] = []
    for item in source:
        text = first_text(item)
        if text and text.casefold() not in {existing.casefold() for existing in result}:
            result.append(text)
    return result


def normalize_tags(recipe: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for key in ("recipeCuisine", "recipeCategory"):
        values.extend(text_list(recipe.get(key)))
    keywords = first_text(recipe.get("keywords"))
    if keywords:
        values.extend(part.strip() for part in keywords.replace(";", ",").split(",") if part.strip())
    unique: list[str] = []
    for value in values:
        if value.casefold() not in {item.casefold() for item in unique}:
            unique.append(value)
    return unique[:8]


def normalize_preview(recipe: Any, source_url: str) -> dict[str, Any]:
    if not isinstance(recipe, dict):
        raise BridgeError("Mealie returned an unexpected recipe format.", 502)
    ingredients = [item[:500] for item in text_list(recipe.get("recipeIngredient"))[:300]]
    instructions = [item[:2000] for item in text_list(recipe.get("recipeInstructions"))[:100]]
    title = first_text(recipe.get("name"))[:100]
    if not title or not ingredients:
        raise BridgeError("Mealie did not find a complete recipe at that URL.", 422)
    return {
        "title": title,
        "description": first_text(recipe.get("description"))[:350],
        "sourceUrl": source_url,
        "image": first_text(recipe.get("image"))[:2048],
        "recipeYield": first_text(recipe.get("recipeYield"))[:100],
        "prepTime": first_text(recipe.get("prepTime"))[:50],
        "cookTime": first_text(recipe.get("cookTime"))[:50],
        "totalTime": first_text(recipe.get("totalTime"))[:50],
        "ingredients": ingredients,
        "instructions": instructions,
        "tags": normalize_tags(recipe),
    }


def scrape_preview(config: BridgeConfig, source_url: str) -> dict[str, Any]:
    normalized_url = validate_recipe_url(source_url)
    recipe = request_json(
        f"{config.mealie_url}/api/recipes/test-scrape-url",
        token=config.token,
        method="POST",
        payload={"url": normalized_url, "useOpenAI": False},
    )
    return normalize_preview(recipe, normalized_url)


class BridgeHandler(BaseHTTPRequestHandler):
    server_version = "RonsRecipesMealieBridge/1.0"
    request_times: deque[float] = deque()

    @property
    def config(self) -> BridgeConfig:
        return self.server.config  # type: ignore[attr-defined]

    def allowed_origin(self) -> str | None:
        origin = self.headers.get("Origin", "").rstrip("/")
        if not origin:
            return None
        if origin not in self.config.allowed_origins:
            raise BridgeError("This browser origin is not allowed to use the importer.", 403)
        return origin

    def send_json(self, status: int, payload: dict[str, Any], origin: str | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()
        self.wfile.write(body)

    def rate_limit(self) -> None:
        now = time.monotonic()
        while self.request_times and now - self.request_times[0] > 60:
            self.request_times.popleft()
        if len(self.request_times) >= MAX_REQUESTS_PER_MINUTE:
            raise BridgeError("Too many import requests. Wait a minute and try again.", 429)
        self.request_times.append(now)

    def do_OPTIONS(self) -> None:  # noqa: N802
        try:
            origin = self.allowed_origin()
            self.send_response(204)
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Max-Age", "600")
            self.end_headers()
        except BridgeError as error:
            self.send_json(error.status, {"error": str(error)})

    def do_GET(self) -> None:  # noqa: N802
        origin = None
        try:
            origin = self.allowed_origin()
            if self.path != "/health":
                raise BridgeError("Not found.", 404)
            request_json(f"{self.config.mealie_url}/api/users/self", token=self.config.token, timeout=10)
            self.send_json(200, {"ok": True, "service": "Ron's Recipes Mealie Bridge"}, origin)
        except BridgeError as error:
            self.send_json(error.status, {"ok": False, "error": str(error)}, origin)

    def do_POST(self) -> None:  # noqa: N802
        origin = None
        try:
            origin = self.allowed_origin()
            if self.path != "/preview":
                raise BridgeError("Not found.", 404)
            self.rate_limit()
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError as error:
                raise BridgeError("Invalid request length.") from error
            if length <= 0 or length > MAX_BODY_BYTES:
                raise BridgeError("The import request is empty or too large.")
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                raise BridgeError("The import request is not valid JSON.") from error
            recipe = scrape_preview(self.config, payload.get("url") if isinstance(payload, dict) else None)
            self.send_json(200, {"ok": True, "recipe": recipe}, origin)
        except BridgeError as error:
            self.send_json(error.status, {"ok": False, "error": str(error)}, origin)
        except Exception:
            self.send_json(500, {"ok": False, "error": "The importer encountered an unexpected error."}, origin)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the loopback-only Mealie bridge for Ron's Recipes.")
    parser.add_argument("--env", type=Path, default=ROOT / ".env")
    args = parser.parse_args()
    config = load_config(args.env)
    server = ThreadingHTTPServer((config.host, config.port), BridgeHandler)
    server.config = config  # type: ignore[attr-defined]
    print(f"Ron's Recipes Mealie bridge: http://{config.host}:{config.port}")
    print(f"Mealie: {config.mealie_url}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
