"""Validate that generated companion attachments preserve the complete source item."""

from pathlib import Path
import sys

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "public" / "mall" / "elementary"
OUTPUT_ROOT = ROOT / "public" / "companions-2d" / "attachments"
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
CANVAS_SIZE = 512
MASK_SIZE = 256
MIN_SILHOUETTE_IOU = 0.82
MIN_SAFE_MARGIN = 12


def alpha_mask(image: Image.Image) -> Image.Image:
    return image.convert("RGBA").getchannel("A").point(
        lambda value: 255 if value > 16 else 0,
    )


def normalized_mask(image: Image.Image) -> Image.Image:
    mask = alpha_mask(image)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError("image has no visible pixels")
    return mask.crop(bounds).resize((MASK_SIZE, MASK_SIZE), Image.Resampling.NEAREST)


def silhouette_iou(first: Image.Image, second: Image.Image) -> float:
    intersection = ImageChops.multiply(first, second)
    union = ImageChops.lighter(first, second)
    intersection_pixels = sum(intersection.histogram()[1:])
    union_pixels = sum(union.histogram()[1:])
    return intersection_pixels / union_pixels if union_pixels else 0.0


def best_source_iou(source_mask: Image.Image, frame_mask: Image.Image) -> float:
    mirrored_source = source_mask.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return max(
        silhouette_iou(source_mask, frame_mask),
        silhouette_iou(mirrored_source, frame_mask),
    )


def main() -> int:
    errors: list[str] = []

    for item_id in ATTACHMENTS:
        source_path = SOURCE_ROOT / f"{item_id}.png"
        source_mask = normalized_mask(Image.open(source_path))

        for direction in DIRECTIONS:
            frame_path = OUTPUT_ROOT / item_id / f"{direction}.webp"
            if not frame_path.exists():
                errors.append(f"{item_id}/{direction}: missing frame")
                continue

            frame = Image.open(frame_path).convert("RGBA")
            if frame.size != (CANVAS_SIZE, CANVAS_SIZE):
                errors.append(
                    f"{item_id}/{direction}: expected {CANVAS_SIZE}x{CANVAS_SIZE}, got {frame.size}",
                )
                continue

            bounds = alpha_mask(frame).getbbox()
            if bounds is None:
                errors.append(f"{item_id}/{direction}: empty frame")
                continue

            left, top, right, bottom = bounds
            if min(left, top, CANVAS_SIZE - right, CANVAS_SIZE - bottom) < MIN_SAFE_MARGIN:
                errors.append(f"{item_id}/{direction}: visible item is too close to the canvas edge")

            frame_mask = normalized_mask(frame)
            iou = best_source_iou(source_mask, frame_mask)
            if iou < MIN_SILHOUETTE_IOU:
                errors.append(
                    f"{item_id}/{direction}: silhouette IoU {iou:.3f} is below "
                    f"{MIN_SILHOUETTE_IOU:.2f}; the item may be cropped",
                )

    if errors:
        print(f"Companion attachment validation failed ({len(errors)} problems):")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validated {len(ATTACHMENTS) * len(DIRECTIONS)} complete attachment views.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
