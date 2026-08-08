from pathlib import Path
import json
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing


ROOT = Path(__file__).resolve().parent
RECIPES_FILE = ROOT / "recipes.json"

PAGE_W, PAGE_H = letter
CREAM = colors.HexColor("#F8F2E8")
PAPER = colors.HexColor("#FFFDFC")
INK = colors.HexColor("#2E2723")
MUTED = colors.HexColor("#6E625B")
BURGUNDY = colors.HexColor("#7B2D35")
BURGUNDY_DARK = colors.HexColor("#552026")
GREEN = colors.HexColor("#315849")
GOLD = colors.HexColor("#C7933E")
LINE = colors.HexColor("#D8CDBF")
PALE_GREEN = colors.HexColor("#E8F0EB")
PALE_GOLD = colors.HexColor("#F7EACF")


REQUIRED_FIELDS = {"rank", "title", "why", "rating", "url", "freeze"}


def load_recipes():
    data = json.loads(RECIPES_FILE.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        raise ValueError("recipes.json must contain a non-empty list of recipes.")
    for index, recipe in enumerate(data, start=1):
        missing = REQUIRED_FIELDS - set(recipe)
        if missing:
            raise ValueError(f"Recipe {index} is missing: {', '.join(sorted(missing))}")
        recipe["rank"] = int(recipe["rank"])
        recipe["title"] = str(recipe["title"]).strip()
        recipe["url"] = str(recipe["url"]).strip()
    ranks = [recipe["rank"] for recipe in data]
    if len(ranks) != len(set(ranks)):
        raise ValueError("Recipe ranks must be unique.")
    return sorted(data, key=lambda recipe: recipe["rank"])


RECIPES = load_recipes()
OUTPUT = ROOT / "outputs" / f"my-top-{len(RECIPES)}-comfort-food-recipes-2026.pdf"

def clean_ascii(text):
    return (
        text.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u00a0", " ")
    )


def wrap_text(text, font, size, max_width):
    words = clean_ascii(text).split()
    lines = []
    current = ""
    for word in words:
        trial = word if not current else current + " " + word
        if stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(c, text, x, y, max_width, font="Helvetica", size=10, leading=14, color=INK, max_lines=None):
    lines = wrap_text(text, font, size, max_width)
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
        last = lines[-1]
        while stringWidth(last + "...", font, size) > max_width and last:
            last = last[:-1]
        lines[-1] = last.rstrip() + "..."
    c.setFont(font, size)
    c.setFillColor(color)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_qr(c, url, x, y, size=54):
    qr = QrCodeWidget(url)
    bounds = qr.getBounds()
    w = bounds[2] - bounds[0]
    h = bounds[3] - bounds[1]
    drawing = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
    drawing.add(qr)
    renderPDF.draw(drawing, c, x, y)


def page_footer(c, page_num, label=None):
    if label is None:
        label = f"MY TOP {len(RECIPES)} COMFORT-FOOD RECIPES"
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(42, 35, PAGE_W - 42, 35)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(MUTED)
    c.drawString(42, 22, label)
    c.drawRightString(PAGE_W - 42, 22, str(page_num))


def page_header(c, title, kicker="2026 COLLECTION"):
    c.setFillColor(BURGUNDY_DARK)
    c.rect(0, PAGE_H - 70, PAGE_W, 70, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(42, PAGE_H - 27, kicker)
    c.setFillColor(colors.white)
    c.setFont("Times-Bold", 21)
    c.drawString(42, PAGE_H - 53, title)


def cover(c):
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(BURGUNDY_DARK)
    c.rect(0, PAGE_H - 104, PAGE_W, 104, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(0, 0, 18, PAGE_H, fill=1, stroke=0)

    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(56, PAGE_H - 72, "RON'S 2026 KITCHEN COLLECTION")

    c.setFillColor(BURGUNDY_DARK)
    c.setFont("Times-Bold", 39)
    c.drawString(56, 565, f"My Top {len(RECIPES)}")
    c.drawString(56, 518, "Comfort-Food Recipes")
    c.setFillColor(GREEN)
    c.setFont("Times-Italic", 23)
    c.drawString(58, 476, "A printable freezer-friendly companion")

    c.setStrokeColor(GOLD)
    c.setLineWidth(3)
    c.line(56, 448, 246, 448)

    c.setFillColor(INK)
    c.setFont("Helvetica", 12)
    c.drawString(58, 406, f"{len(RECIPES)} ranked favorites")
    c.drawString(58, 382, "Practical freezing and reheating notes")
    c.drawString(58, 358, "Clickable source links and scannable QR codes")

    c.setFillColor(BURGUNDY)
    c.circle(472, 214, 76, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Times-Bold", 46)
    c.drawCentredString(472, 205, str(len(RECIPES)))
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(472, 181, "FAVORITES")

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(56, 58, "Source links verified August 8, 2026")
    c.drawString(56, 44, "Designed for US Letter printing")
    c.showPage()


def contents(c, page_num):
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(c, "Contents", "QUICK FIND")

    split_at = (len(RECIPES) + 1) // 2
    columns = [RECIPES[:split_at], RECIPES[split_at:]]
    row_step = min(46, 535 / max(len(column) for column in columns))
    xs = [42, 319]
    for col, x in zip(columns, xs):
        y = PAGE_H - 108
        for item in col:
            c.setFillColor(BURGUNDY)
            c.circle(x + 13, y + 2, 11, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(x + 13, y - 1, str(item["rank"]))

            title_lines = wrap_text(item["title"], "Helvetica-Bold", 9.3, 190)
            c.setFillColor(INK)
            c.setFont("Helvetica-Bold", 9.3)
            c.drawString(x + 31, y + 5, title_lines[0])
            if len(title_lines) > 1:
                c.drawString(x + 31, y - 7, title_lines[1])
            c.setFillColor(GREEN)
            c.setFont("Helvetica", 7.5)
            c.drawRightString(x + 247, y + 5, item["rating"])
            c.setStrokeColor(LINE)
            c.setLineWidth(0.35)
            c.line(x, y - 18, x + 247, y - 18)
            y -= row_step

    c.setFillColor(PALE_GOLD)
    c.roundRect(42, 72, PAGE_W - 84, 49, 7, fill=1, stroke=0)
    c.setFillColor(BURGUNDY_DARK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(56, 101, "HOW TO USE THIS BOOK")
    c.setFillColor(INK)
    c.setFont("Helvetica", 8.5)
    c.drawString(56, 85, "Click a source link in the PDF, or scan its QR code from a printed page, to open the full recipe.")
    page_footer(c, page_num)
    c.showPage()


def freezer_guide(c, page_num):
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(c, "Freezer Guide", "COOK ONCE, EAT WELL LATER")

    c.setFillColor(INK)
    c.setFont("Times-Bold", 18)
    c.drawString(42, 684, "What the ratings mean")

    ratings = [
        ("Outstanding", "Freezes with very little loss of flavor or texture."),
        ("Excellent", "A dependable freezer choice with simple thawing and reheating."),
        ("Very good", "Freezes well; one small adjustment improves the result."),
        ("Good", "Worth freezing, but dairy, potatoes, or toppings need gentle handling."),
        ("Fair", "Usable in a pinch; expect a noticeable texture change."),
    ]
    y = 647
    for name, desc in ratings:
        c.setFillColor(PALE_GREEN if name in ("Outstanding", "Excellent") else PALE_GOLD)
        c.roundRect(42, y - 17, 94, 25, 6, fill=1, stroke=0)
        c.setFillColor(GREEN if name in ("Outstanding", "Excellent") else BURGUNDY)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawCentredString(89, y - 8, name.upper())
        c.setFillColor(INK)
        c.setFont("Helvetica", 9.5)
        c.drawString(151, y - 8, desc)
        y -= 42

    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.line(42, 424, PAGE_W - 42, 424)

    c.setFillColor(INK)
    c.setFont("Times-Bold", 18)
    c.drawString(42, 393, "Five habits that protect quality")
    tips = [
        ("1", "Cool safely", "Divide food into shallow containers and refrigerate promptly before freezing."),
        ("2", "Portion first", "Freeze meal-size portions so you only thaw what you plan to eat."),
        ("3", "Remove air", "Use tight-fitting containers or freezer bags with excess air pressed out."),
        ("4", "Label clearly", "Write the dish name, freeze date, and any finish-at-serving instructions."),
        ("5", "Reheat fully", "Thaw in the refrigerator when practical and reheat leftovers to 165 F."),
    ]
    y = 356
    for num, heading, body in tips:
        c.setFillColor(BURGUNDY)
        c.circle(54, y + 3, 12, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(54, y, num)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(76, y + 5, heading)
        c.setFont("Helvetica", 9)
        c.setFillColor(MUTED)
        c.drawString(76, y - 10, body)
        y -= 51

    c.setFillColor(PALE_GOLD)
    c.roundRect(42, 67, PAGE_W - 84, 48, 7, fill=1, stroke=0)
    c.setFillColor(BURGUNDY_DARK)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(56, 96, "* PASTA-SOUP NOTE")
    c.setFont("Helvetica", 8.4)
    c.setFillColor(INK)
    c.drawString(56, 81, "Freeze the soup without pasta, then add freshly cooked pasta after reheating to avoid a soft texture.")
    page_footer(c, page_num)
    c.showPage()


def rating_colors(rating):
    if rating in ("Outstanding", "Excellent"):
        return PALE_GREEN, GREEN
    if rating == "Fair":
        return colors.HexColor("#F3E1DD"), BURGUNDY
    return PALE_GOLD, BURGUNDY


def draw_recipe_card(c, item, x, y, w, h):
    key = f"recipe-{item['rank']}"
    c.bookmarkPage(key)
    c.addOutlineEntry(f"{item['rank']}. {item['title']}", key, level=0, closed=False)

    c.setFillColor(colors.white)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, 10, fill=1, stroke=1)

    c.setFillColor(BURGUNDY_DARK)
    c.roundRect(x, y + h - 58, w, 58, 10, fill=1, stroke=0)
    c.rect(x, y + h - 58, w, 10, fill=1, stroke=0)

    c.setFillColor(GOLD)
    c.circle(x + 29, y + h - 29, 17, fill=1, stroke=0)
    c.setFillColor(BURGUNDY_DARK)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(x + 29, y + h - 33, str(item["rank"]))

    title_lines = wrap_text(item["title"], "Times-Bold", 16, w - 205)
    c.setFillColor(colors.white)
    c.setFont("Times-Bold", 16)
    title_y = y + h - 25 if len(title_lines) == 1 else y + h - 18
    for line in title_lines[:2]:
        c.drawString(x + 55, title_y, line)
        title_y -= 17

    bg, fg = rating_colors(item["rating"].replace("*", ""))
    c.setFillColor(bg)
    c.roundRect(x + w - 125, y + h - 41, 105, 25, 7, fill=1, stroke=0)
    c.setFillColor(fg)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(x + w - 72.5, y + h - 32, item["rating"].upper())

    body_x = x + 24
    body_w = w - 132
    c.setFillColor(BURGUNDY)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(body_x, y + h - 84, "WHY IT MADE MY LIST")
    draw_wrapped(c, item["why"], body_x, y + h - 103, body_w, size=10, leading=14, color=INK, max_lines=3)

    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(body_x, y + h - 151, x + w - 24, y + h - 151)

    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(body_x, y + h - 173, "FREEZE SMART")
    draw_wrapped(c, item["freeze"], body_x, y + h - 192, body_w, size=9.5, leading=13.5, color=INK, max_lines=4)

    link_x = body_x
    link_y = y + 27
    c.setFillColor(BURGUNDY)
    c.setFont("Helvetica-Bold", 9)
    link_text = "OPEN THE ORIGINAL RECIPE"
    c.drawString(link_x, link_y, link_text)
    link_w = stringWidth(link_text, "Helvetica-Bold", 9)
    c.setStrokeColor(BURGUNDY)
    c.setLineWidth(0.6)
    c.line(link_x, link_y - 2, link_x + link_w, link_y - 2)
    c.linkURL(item["url"], (link_x, link_y - 4, link_x + link_w, link_y + 10), relative=0, thickness=0)

    qr_x = x + w - 82
    qr_y = y + 17
    c.setFillColor(colors.white)
    c.setStrokeColor(LINE)
    c.roundRect(qr_x - 5, qr_y - 5, 64, 64, 5, fill=1, stroke=1)
    draw_qr(c, item["url"], qr_x, qr_y, 54)
    c.linkURL(item["url"], (qr_x - 5, qr_y - 5, qr_x + 59, qr_y + 59), relative=0, thickness=0)


def recipe_pages(c, start_page):
    page_num = start_page
    for i in range(0, len(RECIPES), 2):
        c.setFillColor(CREAM)
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        page_header(c, "The Ranked Favorites", f"RECIPES {i + 1}-{min(i + 2, len(RECIPES))} OF {len(RECIPES)}")

        draw_recipe_card(c, RECIPES[i], 42, 389, PAGE_W - 84, 305)
        if i + 1 < len(RECIPES):
            draw_recipe_card(c, RECIPES[i + 1], 42, 63, PAGE_W - 84, 305)
        else:
            c.setFillColor(colors.white)
            c.setStrokeColor(LINE)
            c.roundRect(42, 63, PAGE_W - 84, 305, 10, fill=1, stroke=1)
            c.setFillColor(BURGUNDY_DARK)
            c.setFont("Times-Bold", 20)
            c.drawString(66, 330, "Kitchen Notes")
            c.setFillColor(MUTED)
            c.setFont("Helvetica", 9)
            c.drawString(66, 311, "Record timing changes, favorite sides, or who loved it.")
            c.setStrokeColor(LINE)
            c.setLineWidth(0.5)
            for yy in range(286, 89, -28):
                c.line(66, yy, PAGE_W - 66, yy)

        page_footer(c, page_num)
        c.showPage()
        page_num += 1


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=letter, pageCompression=1)
    c.setTitle(f"My Top {len(RECIPES)} Comfort-Food Recipes for 2026")
    c.setAuthor("Ron")
    c.setSubject("A printable freezer-friendly recipe companion")
    c.setKeywords("comfort food, recipes, freezer meals, 2026")
    cover(c)
    contents(c, 2)
    freezer_guide(c, 3)
    recipe_pages(c, 4)
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()

