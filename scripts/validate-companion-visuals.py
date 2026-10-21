from pathlib import Path
import sys

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "public" / "companions-2d"
COMPANIONS = ("yunduo", "cloudbloom", "cloudbelle")
DIRECTIONS = (
    "front", "front-right", "right", "back-right",
    "back", "back-left", "left", "front-left",
)


def alpha_bounds(path: Path) -> tuple[int, int, int, int] | None:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A").point(lambda value: 255 if value > 16 else 0)
    return alpha.getbbox()


def main() -> int:
    errors: list[str] = []
    for companion in COMPANIONS:
        for direction in DIRECTIONS:
            path = ASSET_ROOT / companion / direction / "body.webp"
            bounds = alpha_bounds(path)
            if bounds is None:
                errors.append(f"{companion}/{direction}: empty body")
                continue
            left, top, right, bottom = bounds
            width = right - left
            height = bottom - top
            center_x = (left + right) / 2
            if not 760 <= height <= 900:
                errors.append(f"{companion}/{direction}: height {height} outside 760..900")
            if width < 300:
                errors.append(f"{companion}/{direction}: width {width} is too small")
            if not 930 <= bottom <= 970:
                errors.append(f"{companion}/{direction}: foot line {bottom} outside 930..970")
            if abs(center_x - 512) > 80:
                errors.append(f"{companion}/{direction}: center {center_x:.1f} is not aligned")

    if errors:
        print(f"Companion visual validation failed ({len(errors)} problems):")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Validated {len(COMPANIONS) * len(DIRECTIONS)} normalized companion views.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
