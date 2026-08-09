from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
ICON_DIR = ROOT / "assets" / "icons"
OG_DIR = ROOT / "assets" / "og"

BURGUNDY = "#651f27"
BURGUNDY_DARK = "#4f171e"
CREAM = "#f8f3ea"
PAPER = "#fffdf9"
INK = "#2f2926"
MUTED = "#6d625c"
GREEN = "#24553f"
GREEN_SOFT = "#edf4ef"
GOLD = "#9b6500"


def font(size, bold=False, serif=False):
    windows = Path("C:/Windows/Fonts")
    candidates = []
    if serif:
        candidates.extend([
            windows / ("georgiab.ttf" if bold else "georgia.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"),
        ])
    else:
        candidates.extend([
            windows / ("segoeuib.ttf" if bold else "segoeui.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ])
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default(size=size)


def draw_pot(draw, box, color=CREAM, accent=GOLD, width=12):
    left, top, right, bottom = box
    box_width = right - left
    box_height = bottom - top
    lid_y = top + box_height * 0.38
    pot_bottom = top + box_height * 0.82
    pot_left = left + box_width * 0.2
    pot_right = right - box_width * 0.2
    radius = int(box_width * 0.055)

    draw.line((left + box_width * 0.13, lid_y, right - box_width * 0.13, lid_y), fill=color, width=width)
    draw.rounded_rectangle((pot_left, lid_y, pot_right, pot_bottom), radius=radius, outline=color, width=width)
    draw.arc((left + box_width * 0.36, top + box_height * 0.18, left + box_width * 0.64, top + box_height * 0.5), 180, 360, fill=color, width=width)
    draw.arc((left + box_width * 0.15, top + box_height * 0.15, left + box_width * 0.36, top + box_height * 0.43), 180, 330, fill=accent, width=max(3, width - 2))
    draw.arc((left + box_width * 0.64, top + box_height * 0.15, left + box_width * 0.85, top + box_height * 0.43), 210, 360, fill=accent, width=max(3, width - 2))
    for offset in (0.36, 0.5, 0.64):
        x = left + box_width * offset
        draw.line((x, lid_y + box_height * 0.12, x, pot_bottom - box_height * 0.1), fill=color, width=max(3, width - 3))


def make_icon(size, maskable=False):
    image = Image.new("RGB", (size, size), BURGUNDY)
    draw = ImageDraw.Draw(image)
    if maskable:
        inset = int(size * 0.16)
        draw.rounded_rectangle((inset, inset, size - inset, size - inset), radius=int(size * 0.12), fill=BURGUNDY_DARK, outline=GOLD, width=max(4, size // 64))
        pot_box = (size * 0.25, size * 0.24, size * 0.75, size * 0.77)
    else:
        inset = int(size * 0.06)
        draw.rounded_rectangle((inset, inset, size - inset, size - inset), radius=int(size * 0.2), fill=BURGUNDY_DARK, outline=GOLD, width=max(3, size // 80))
        pot_box = (size * 0.2, size * 0.19, size * 0.8, size * 0.81)
    draw_pot(draw, pot_box, width=max(4, size // 32))
    return image


def make_share_card():
    image = Image.new("RGB", (1200, 630), CREAM)
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, 330, 630), fill=BURGUNDY)
    draw.ellipse((-160, 420, 260, 840), fill=BURGUNDY_DARK)
    draw.ellipse((210, -100, 440, 130), fill=GOLD)
    draw_pot(draw, (58, 142, 272, 382), width=11)
    draw.text((69, 425), "25 favorites", font=font(29, bold=True), fill=CREAM)
    draw.text((69, 469), "ranked for comfort", font=font(20), fill="#f1dedf")

    draw.text((402, 104), "Ron's Recipes", font=font(74, bold=True, serif=True), fill=BURGUNDY_DARK)
    draw.rectangle((404, 214, 542, 221), fill=GOLD)
    draw.text((402, 252), "Comfort-food favorites with practical", font=font(31, bold=True), fill=INK)
    draw.text((402, 294), "freezer notes and every original recipe.", font=font(31, bold=True), fill=INK)

    cards = [
        ("Excellent", "Freezer guidance", GREEN_SOFT, GREEN),
        ("Searchable", "Find dinner fast", PAPER, BURGUNDY),
        ("Printable", "PDF recipe book", PAPER, BURGUNDY),
    ]
    x = 402
    for heading, detail, background, color in cards:
        draw.rounded_rectangle((x, 397, x + 226, 535), radius=16, fill=background, outline="#ded3c5", width=2)
        draw.text((x + 20, 426), heading, font=font(22, bold=True), fill=color)
        draw.text((x + 20, 469), detail, font=font(17), fill=MUTED)
        x += 243

    draw.text((402, 573), "Made for home cooks, by a home cook.", font=font(20), fill=MUTED)
    return image


def main():
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    OG_DIR.mkdir(parents=True, exist_ok=True)

    favicon_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#651f27"/>
  <path d="M16 27h32v22a5 5 0 0 1-5 5H21a5 5 0 0 1-5-5V27ZM12 27h40M23 21c0-5 4-9 9-9s9 4 9 9M20 17c-4 0-6 3-6 7M44 17c4 0 6 3 6 7M24 34v12M32 34v12M40 34v12" fill="none" stroke="#f8f3ea" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
"""
    (ICON_DIR / "favicon.svg").write_text(favicon_svg, encoding="utf-8")

    icon_512 = make_icon(512)
    icon_512.save(ICON_DIR / "icon-512.png", optimize=True)
    icon_512.resize((192, 192), Image.Resampling.LANCZOS).save(ICON_DIR / "icon-192.png", optimize=True)
    icon_512.resize((180, 180), Image.Resampling.LANCZOS).save(ICON_DIR / "apple-touch-icon.png", optimize=True)
    icon_512.resize((256, 256), Image.Resampling.LANCZOS).save(
        ICON_DIR / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    make_icon(512, maskable=True).save(ICON_DIR / "icon-maskable-512.png", optimize=True)
    make_share_card().save(OG_DIR / "rons-recipes-share-1200x630.png", optimize=True)

    print("PASS: web icons and Open Graph sharing card generated")


if __name__ == "__main__":
    main()
