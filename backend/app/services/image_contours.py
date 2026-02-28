"""Extract 2D contours from images (e.g. handwriting, sketch) for extrusion."""
from pathlib import Path
import numpy as np
import cv2
from shapely.geometry import Polygon


def load_and_binarize(image_path: Path, invert: bool = True) -> np.ndarray:
    """Load image as grayscale and binarize (black shape on white, or white on black)."""
    raw = cv2.imread(str(image_path))
    if raw is None:
        raise ValueError(f"Cannot read image: {image_path}")
    gray = cv2.cvtColor(raw, cv2.COLOR_BGR2GRAY)
    # Optional: denoise
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    # Otsu or simple threshold: assume dark drawing on light background
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if invert:
        binary = 255 - binary
    return binary


def contours_to_polygons(binary: np.ndarray, min_area: float = 10.0) -> list[Polygon]:
    """Find contours and convert to Shapely Polygons (2D, image coords)."""
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    polygons: list[Polygon] = []
    h = binary.shape[0]
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        # OpenCV y is top-down; we keep it for extrusion (optional: flip y for CAD-like)
        pts = c.reshape(-1, 2).astype(np.float64)
        if len(pts) < 3:
            continue
        try:
            poly = Polygon(pts)
            if poly.is_valid and not poly.is_empty:
                polygons.append(poly)
            else:
                poly = Polygon(pts).buffer(0)
                if not poly.is_empty:
                    polygons.append(poly)
        except Exception:
            continue
    return polygons


def image_to_contours(image_path: Path, invert: bool = True, min_area: float = 10.0) -> list[Polygon]:
    """Load image, binarize, and return list of contours as Polygons."""
    binary = load_and_binarize(image_path, invert=invert)
    return contours_to_polygons(binary, min_area=min_area)
