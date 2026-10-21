"""Build normalized eight-direction companion and attachment frames."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "public" / "pets"
OUTPUT_ROOT = ROOT / "public" / "companions-2d"
ATTACHMENT_SOURCE_ROOT = ROOT / "public" / "mall" / "elementary"
ATTACHMENT_OUTPUT_ROOT = OUTPUT_ROOT / "attachments"
COMPANIONS = ("yunduo", "cloudbloom", "cloudbelle")
ATTACHMENTS = (
    "cloud-backpack",
    "dawn-cloud-wand",
    "cloud-flower-lamp",
    "rainbow-cloud-gate",
    "flower-cloud-windchime",
    "cloud-flower-chair",
)
DIRECTIONS = (
    "front", "front-right", "right", "back-right",
    "back", "back-left", "left", "front-left",
)
FRAME_WIDTH = 192
FRAME_HEIGHT = 208
SOURCE_ROW = 1
CANVAS_SIZE = 1024
TARGET_HEIGHT = 820
MAX_WIDTH = 760
FOOT_LINE = 952
ATTACHMENT_CANVAS_SIZE = 512
ATTACHMENT_TARGET_EXTENT = 448

ATTACHMENT_DIRECTION_PROFILES = {
    "front": (1.0, 0, False),
    "front-right": (0.91, 10, False),
    "right": (0.82, 14, False),
    "back-right": (0.91, 10, False),
    "back": (1.0, 0, True),
    "back-left": (0.91, -10, True),
    "left": (0.82, -14, True),
    "front-left": (0.91, -10, True),
}


def normalized_frame(source: Image.Image, column: int) -> Image.Image:
    cell = source.crop((
        column * FRAME_WIDTH,
        SOURCE_ROW * FRAME_HEIGHT,
        (column + 1) * FRAME_WIDTH,
        (SOURCE_ROW + 1) * FRAME_HEIGHT,
    )).convert("RGBA")
    alpha = cell.getchannel("A").point(lambda value: 255 if value > 16 else 0)
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError(f"sprite column {column} is empty")

    character = cell.crop(bounds)
    scale = min(TARGET_HEIGHT / character.height, MAX_WIDTH / character.width)
    target_size = (
        max(1, round(character.width * scale)),
        max(1, round(character.height * scale)),
    )
    character = character.resize(target_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    left = (CANVAS_SIZE - character.width) // 2
    top = FOOT_LINE - character.height
    canvas.alpha_composite(character, (left, top))
    return canvas


def attachment_frame(source: Image.Image, direction: str) -> Image.Image:
    """Fit the whole transparent item on canvas, then add a subtle turn illusion."""
    alpha = source.getchannel("A").point(lambda value: 255 if value > 16 else 0)
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("attachment source is empty")

    item = source.crop(bounds)
    horizontal_scale, horizontal_shift, mirror = ATTACHMENT_DIRECTION_PROFILES[direction]
    if mirror:
        item = item.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

    base_scale = min(
        ATTACHMENT_TARGET_EXTENT / item.width,
        ATTACHMENT_TARGET_EXTENT / item.height,
    )
    target_size = (
        max(1, round(item.width * base_scale * horizontal_scale)),
        max(1, round(item.height * base_scale)),
    )
    item = item.resize(target_size, Image.Resampling.LANCZOS)

    canvas = Image.new(
        "RGBA",
        (ATTACHMENT_CANVAS_SIZE, ATTACHMENT_CANVAS_SIZE),
        (0, 0, 0, 0),
    )
    left = (ATTACHMENT_CANVAS_SIZE - item.width) // 2 + horizontal_shift
    top = (ATTACHMENT_CANVAS_SIZE - item.height) // 2
    canvas.alpha_composite(item, (left, top))
    return canvas


def build_attachment_frames() -> None:
    for item_id in ATTACHMENTS:
        source_path = ATTACHMENT_SOURCE_ROOT / f"{item_id}.png"
        source = Image.open(source_path).convert("RGBA")
        for direction in DIRECTIONS:
            output_path = ATTACHMENT_OUTPUT_ROOT / item_id / f"{direction}.webp"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            attachment_frame(source, direction).save(
                output_path,
                "WEBP",
                lossless=True,
                method=6,
            )
            print(output_path.relative_to(ROOT))


def main() -> None:
    for companion in COMPANIONS:
        source_path = SOURCE_ROOT / f"{companion}.png"
        source = Image.open(source_path).convert("RGBA")
        expected_size = (FRAME_WIDTH * len(DIRECTIONS), FRAME_HEIGHT * 11)
        if source.size != expected_size:
            raise ValueError(f"{source_path}: expected {expected_size}, got {source.size}")

        for column, direction in enumerate(DIRECTIONS):
            output_path = OUTPUT_ROOT / companion / direction / "body.webp"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            normalized_frame(source, column).save(
                output_path,
                "WEBP",
                lossless=True,
                method=6,
            )
            print(output_path.relative_to(ROOT))

    build_attachment_frames()


if __name__ == "__main__":
    main()
