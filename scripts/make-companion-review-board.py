from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "companions-2d"
OUTPUT = ROOT / "docs" / "reviews" / "all-companions-2-5d-review-board.png"
DIRECTIONS = [
    "front",
    "front-right",
    "right",
    "back-right",
    "back",
    "back-left",
    "left",
    "front-left",
]
COMPANIONS = ["momo", "yunduo", "cloudbloom", "cloudbelle"]
ITEMS = [
    "cloud-backpack",
    "dawn-cloud-wand",
    "cloud-flower-lamp",
    "rainbow-cloud-gate",
    "flower-cloud-windchime",
    "cloud-flower-chair",
]
CHECKER_LIGHT = (255, 250, 246, 255)
CHECKER_DARK = (247, 235, 230, 255)


def checkerboard(width: int, height: int, cell: int = 24) -> Image.Image:
    board = Image.new("RGBA", (width, height), CHECKER_LIGHT)
    draw = ImageDraw.Draw(board)
    for y in range(0, height, cell):
        for x in range(0, width, cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=CHECKER_DARK)
    return board


def fit(image: Image.Image, size: tuple[int, int], margin: int = 10) -> Image.Image:
    image = image.convert("RGBA")
    image.thumbnail((size[0] - margin * 2, size[1] - margin * 2), Image.Resampling.LANCZOS)
    tile = checkerboard(*size)
    tile.alpha_composite(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    return tile


def main() -> None:
    tile_width, tile_height = 220, 270
    row_label = 150
    canvas_width = row_label + tile_width * 8
    companion_height = tile_height * len(COMPANIONS)
    item_tile = (290, 240)
    item_rows = 2
    canvas_height = 80 + companion_height + 62 + item_tile[1] * item_rows
    board = Image.new("RGBA", (canvas_width, canvas_height), (255, 249, 244, 255))
    draw = ImageDraw.Draw(board)
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 17)
    title_font = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 28)
    small_font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)

    draw.text((24, 20), "智芽 · 2.5D 伙伴八方向与装扮评审板", fill="#4c3640", font=title_font)
    for index, direction in enumerate(DIRECTIONS):
        draw.text((row_label + index * tile_width + 50, 56), direction, fill="#8c6872", font=small_font)

    for row, companion_id in enumerate(COMPANIONS):
        top = 80 + row * tile_height
        draw.text((24, top + 102), companion_id, fill="#60444d", font=font)
        for column, direction in enumerate(DIRECTIONS):
            path = PUBLIC / companion_id / direction / "body.webp"
            tile = fit(Image.open(path), (tile_width, tile_height), margin=12)
            board.alpha_composite(tile, (row_label + column * tile_width, top))

    item_top = 80 + companion_height + 62
    draw.text((24, item_top - 42), "商品八方向预览（正面 / 右侧 / 背面）", fill="#4c3640", font=font)
    preview_directions = ["front", "right", "back"]
    for row in range(item_rows):
        for column in range(3):
            item_index = row * 3 + column
            if item_index >= len(ITEMS):
                continue
            item_id = ITEMS[item_index]
            left = 24 + column * 610
            top = item_top + row * item_tile[1]
            draw.text((left, top + 6), item_id, fill="#79555f", font=small_font)
            for offset, direction in enumerate(preview_directions):
                path = PUBLIC / "attachments" / item_id / f"{direction}.webp"
                tile = fit(Image.open(path), (185, 200), margin=10)
                board.alpha_composite(tile, (left + 8 + offset * 188, top + 28))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    board.convert("RGB").save(OUTPUT, "PNG", optimize=True)
    print(OUTPUT.resolve())


if __name__ == "__main__":
    main()
