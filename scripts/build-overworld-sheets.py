"""
Build Overworld Sprite Sheets from teobz HGSS Animated Overworld Sprites.

Input: GIF/by-pokemon/{id}_{name}/regular/{direction}.gif  (32x32, 4 frames)
Output: {id}.png  sprite sheet (128x128 = 4x4 grid of 32x32 cells)

Layout:
  Row 0: down  (4 walk frames)
  Row 1: left  (4 walk frames)
  Row 2: right (4 walk frames)
  Row 3: up    (4 walk frames)

Usage:
  python scripts/build-overworld-sheets.py
"""

import os
import sys
from pathlib import Path
from PIL import Image

DIRECTIONS = ["down", "left", "right", "up"]
FRAME_SIZE = 32
GRID = 4  # 4 frames per direction
SHEET_SIZE = FRAME_SIZE * GRID  # 128

INPUT_DIR = Path(r"C:\Users\User\Documents\Default Project\assets\pkmn-hgss-overworld\GIF\by-pokemon")
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "overworld-sheets"
OUTPUT_DIR_SHINY = Path(__file__).resolve().parent.parent / "assets" / "overworld-sheets-shiny"


def extract_frames(gif_path):
    """Extract all frames from an animated GIF."""
    img = Image.open(gif_path)
    frames = []
    try:
        while True:
            frame = img.copy().convert("RGBA")
            frames.append(frame)
            img.seek(img.tell() + 1)
    except EOFError:
        pass
    return frames


def build_sheet(pokemon_dir, variant):
    """Build a sprite sheet from a Pokemon's direction GIFs."""
    variant_dir = pokemon_dir / variant
    if not variant_dir.exists():
        return None

    sheet = Image.new("RGBA", (SHEET_SIZE, SHEET_SIZE), (0, 0, 0, 0))

    for row_idx, direction in enumerate(DIRECTIONS):
        gif_path = variant_dir / f"{direction}.gif"
        if not gif_path.exists():
            continue

        frames = extract_frames(gif_path)
        if not frames:
            continue

        for col_idx in range(GRID):
            frame_idx = col_idx % len(frames)
            frame = frames[frame_idx]

            if frame.size != (FRAME_SIZE, FRAME_SIZE):
                frame = frame.resize((FRAME_SIZE, FRAME_SIZE), Image.NEAREST)

            dest_x = col_idx * FRAME_SIZE
            dest_y = row_idx * FRAME_SIZE
            sheet.paste(frame, (dest_x, dest_y))

    return sheet


def extract_pokemon_id(dir_name):
    """Extract numeric ID from directory name like '001_bulbasaur'."""
    parts = dir_name.split("_", 1)
    if parts and parts[0].isdigit():
        return int(parts[0])
    return None


def main():
    print(f"Input: {INPUT_DIR}")
    print(f"Output regular: {OUTPUT_DIR}")
    print(f"Output shiny: {OUTPUT_DIR_SHINY}")

    if not INPUT_DIR.exists():
        print(f"ERROR: Input directory not found: {INPUT_DIR}")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR_SHINY.mkdir(parents=True, exist_ok=True)

    pokemon_dirs = sorted([
        d for d in INPUT_DIR.iterdir()
        if d.is_dir()
    ])

    print(f"Found {len(pokemon_dirs)} Pokemon")

    regular_count = 0
    shiny_count = 0
    errors = 0

    for pokemon_dir in pokemon_dirs:
        pokemon_id = extract_pokemon_id(pokemon_dir.name)

        # Regular
        try:
            sheet = build_sheet(pokemon_dir, "regular")
            if sheet:
                out_path = OUTPUT_DIR / f"{pokemon_id}.png"
                sheet.save(out_path, "PNG")
                regular_count += 1
        except Exception as e:
            print(f"  ERROR regular {pokemon_dir.name}: {e}")
            errors += 1

        # Shiny
        try:
            sheet = build_sheet(pokemon_dir, "shiny")
            if sheet:
                out_path = OUTPUT_DIR_SHINY / f"{pokemon_id}.png"
                sheet.save(out_path, "PNG")
                shiny_count += 1
        except Exception as e:
            print(f"  ERROR shiny {pokemon_dir.name}: {e}")
            errors += 1

    print(f"\nDone!")
    print(f"  Regular sheets: {regular_count}")
    print(f"  Shiny sheets: {shiny_count}")
    print(f"  Errors: {errors}")


if __name__ == "__main__":
    main()
