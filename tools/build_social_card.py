"""Build the link preview image (og:image) and the favicon from the committed game art.

The preview is what chats and social sites show when someone posts the planner's link: a game
panorama, the page name and three mutagens, at the 1200x630 size those sites expect. The favicon
is a greater red mutagen. Both come from public/assets/, so no game install is needed.

Needs Python 3 with Pillow and fontTools (with brotli, to read the woff2 font).

Usage: python tools/build_social_card.py [--out public]
"""
import argparse
import io
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "public" / "assets"
SIZE = (1200, 630)
PANORAMA = ASSETS / "ui" / "backdrop" / "panorama-kaer-morhen.jpg"
MUTAGENS = ["red", "green", "blue"]
FAVICON = ASSETS / "ui" / "mutagens" / "item-red-greater.png"

TITLE = "WITCHER 3 BUILD PLANNER"
SUBTITLE = "Skill calculator for The Witcher 3: Wild Hunt Remastered"
DETAILS = "Combat  ·  Signs  ·  Alchemy  ·  General  ·  Mutagens  ·  Shareable builds"
GOLD = (222, 196, 140)
LIGHT = (232, 226, 214)
GREY = (170, 164, 152)


def font(name, size):
    """A woff2 font from public/assets/fonts, which Pillow can't read directly."""
    tt = TTFont(ASSETS / "fonts" / "d-din" / name)
    tt.flavor = None
    data = io.BytesIO()
    tt.save(data)
    data.seek(0)
    return ImageFont.truetype(data, size)


def cover(img, size):
    """Scales and centre-crops img to fill size."""
    scale = max(size[0] / img.width, size[1] / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left, top = (img.width - size[0]) // 2, (img.height - size[1]) // 2
    return img.crop((left, top, left + size[0], top + size[1]))


def card():
    img = cover(Image.open(PANORAMA).convert("RGB"), SIZE)
    # Darken towards the bottom so the text reads on any part of the panorama.
    shade = Image.new("L", SIZE)
    shade.putdata([min(225, 20 + y * 260 // SIZE[1]) for y in range(SIZE[1]) for _ in range(SIZE[0])])
    img = Image.composite(Image.new("RGB", SIZE, (8, 8, 10)), img, shade)

    x, y = 72, 300
    for i, colour in enumerate(MUTAGENS):
        icon = Image.open(ASSETS / "ui" / "mutagens" / f"item-{colour}-greater.png").convert("RGBA").resize((96, 96), Image.LANCZOS)
        img.paste(icon, (x + i * 104, y - 128), icon)

    draw = ImageDraw.Draw(img)
    draw.text((x, y), TITLE, font=font("D-DINCondensed-Bold.woff2", 96), fill=GOLD)
    draw.text((x, y + 116), SUBTITLE, font=font("D-DINCondensed.woff2", 44), fill=LIGHT)
    draw.text((x, y + 186), DETAILS, font=font("D-DINCondensed.woff2", 34), fill=GREY)
    return img


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=str(ROOT / "public"), help="folder for social-card.png and favicon.png")
    out = Path(parser.parse_args().out)
    card().save(out / "social-card.png", optimize=True)
    Image.open(FAVICON).save(out / "favicon.png", optimize=True)
    print(f"Wrote {out / 'social-card.png'} and {out / 'favicon.png'}")


if __name__ == "__main__":
    main()
