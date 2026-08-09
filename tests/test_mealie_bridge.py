import os
import socket
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from mealie_bridge import BridgeError, load_config, normalize_preview, validate_recipe_url


class MealieBridgeTests(unittest.TestCase):
    def write_env(self, text: str) -> Path:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / ".env"
        path.write_text(text, encoding="utf-8")
        return path

    def test_loads_existing_raw_token_without_exposing_it(self) -> None:
        token = "private-test-token"
        with patch.dict(os.environ, {}, clear=True):
            config = load_config(self.write_env(token))
        self.assertEqual(config.token, token)
        self.assertNotIn(token, repr(config))
        self.assertEqual(config.host, "127.0.0.1")

    def test_loads_named_configuration(self) -> None:
        env = "\n".join([
            "MEALIE_API_TOKEN=named-token",
            "MEALIE_URL=http://192.168.1.60:9925/",
            "MEALIE_BRIDGE_PORT=9940",
        ])
        with patch.dict(os.environ, {}, clear=True):
            config = load_config(self.write_env(env))
        self.assertEqual(config.token, "named-token")
        self.assertEqual(config.mealie_url, "http://192.168.1.60:9925")
        self.assertEqual(config.port, 9940)
        self.assertIn("https://rlukenbaugh.github.io", config.allowed_origins)

    def test_bridge_binding_must_remain_on_this_pc(self) -> None:
        env = "MEALIE_API_TOKEN=test\nMEALIE_BRIDGE_HOST=0.0.0.0"
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(BridgeError, "loopback"):
                load_config(self.write_env(env))

    @patch("mealie_bridge.socket.getaddrinfo")
    def test_public_recipe_url_is_normalized(self, getaddrinfo) -> None:
        getaddrinfo.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]
        result = validate_recipe_url("https://recipes.example.com/soup#ingredients")
        self.assertEqual(result, "https://recipes.example.com/soup")

    def test_private_and_unsafe_recipe_urls_are_blocked(self) -> None:
        unsafe_urls = (
            "http://127.0.0.1/recipe",
            "http://192.168.1.60:9925/",
            "http://localhost/recipe",
            "https://user:password@example.com/recipe",
            "https://example.com:8443/recipe",
        )
        for url in unsafe_urls:
            with self.subTest(url=url):
                with self.assertRaises(BridgeError):
                    validate_recipe_url(url)

    def test_mealie_preview_is_normalized_for_the_web_form(self) -> None:
        result = normalize_preview({
            "name": "Vegetable Soup",
            "description": "A cozy soup.",
            "recipeYield": "8 servings",
            "prepTime": "PT25M",
            "totalTime": "PT2H",
            "recipeIngredient": ["2 carrots", "1 onion"],
            "recipeInstructions": [{"text": "Chop vegetables."}, {"text": "Simmer until tender."}],
            "recipeCuisine": ["American"],
            "recipeCategory": ["Soup"],
            "keywords": "easy, weeknight",
        }, "https://example.com/vegetable-soup")
        self.assertEqual(result["title"], "Vegetable Soup")
        self.assertEqual(result["ingredients"], ["2 carrots", "1 onion"])
        self.assertEqual(result["instructions"], ["Chop vegetables.", "Simmer until tender."])
        self.assertEqual(result["prepTime"], "PT25M")
        self.assertEqual(result["tags"], ["American", "Soup", "easy", "weeknight"])


if __name__ == "__main__":
    unittest.main()
