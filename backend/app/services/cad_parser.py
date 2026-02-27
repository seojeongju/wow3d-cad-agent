"""Parse DXF and extract 2D contours for extrusion."""
from pathlib import Path
from typing import Any

import ezdxf
from ezdxf.document import Drawing
from ezdxf.entities import DXFEntity, LWPolyline, Line, Arc, Circle, Polyline
from shapely.geometry import LineString, Polygon
from shapely.ops import polygonize
import numpy as np


def get_flat_points(entity: DXFEntity) -> list[tuple[float, float]]:
    """Extract 2D (x, y) points from a DXF entity (flatten to modelspace)."""
    points: list[tuple[float, float]] = []
    if isinstance(entity, Line):
        start = entity.dxf.start
        end = entity.dxf.end
        points = [(start.x, start.y), (end.x, end.y)]
    elif isinstance(entity, LWPolyline):
        for p in entity.get_points("xy"):
            points.append((p[0], p[1]))
        if entity.closed:
            points.append(points[0])
    elif isinstance(entity, Polyline):
        for p in entity.points():
            points.append((p[0], p[1]))
        if entity.is_closed:
            points.append(points[0])
    elif isinstance(entity, Arc):
        center = entity.dxf.center
        r = entity.dxf.radius
        start_angle = np.deg2rad(entity.dxf.start_angle)
        end_angle = np.deg2rad(entity.dxf.end_angle)
        n = max(8, int(abs(end_angle - start_angle) / (np.pi / 16)) + 1)
        angles = np.linspace(start_angle, end_angle, n)
        for a in angles:
            x = center.x + r * np.cos(a)
            y = center.y + r * np.sin(a)
            points.append((float(x), float(y)))
    elif isinstance(entity, Circle):
        center = entity.dxf.center
        r = entity.dxf.radius
        n = 32
        for i in range(n + 1):
            a = 2 * np.pi * i / n
            x = center.x + r * np.cos(a)
            y = center.y + r * np.sin(a)
            points.append((float(x), float(y)))
    return points


def entity_to_linestring(entity: DXFEntity) -> LineString | None:
    pts = get_flat_points(entity)
    if len(pts) < 2:
        return None
    return LineString(pts)


def collect_geometry(doc: Drawing) -> list[LineString]:
    """Collect all 2D line/arc geometry from modelspace as LineStrings."""
    msp = doc.modelspace()
    lines: list[LineString] = []
    for entity in msp:
        if entity.dxf.dxftype() in ("LINE", "LWPOLYLINE", "ARC", "CIRCLE", "POLYLINE"):
            ls = entity_to_linestring(entity)
            if ls and not ls.is_empty:
                lines.append(ls)
    return lines


def lines_to_polygons(lines: list[LineString], tolerance: float = 0.01) -> list[Polygon]:
    """Extract closed polygons from line strings (polygonize + closed rings)."""
    if not lines:
        return []
    polygons: list[Polygon] = []
    try:
        for poly in polygonize(lines):
            if isinstance(poly, Polygon) and not poly.is_empty and poly.area > tolerance * tolerance:
                polygons.append(poly)
    except Exception:
        pass
    # Also add any closed LineString as a polygon
    for ls in lines:
        if ls.is_closed and len(ls.coords) >= 3:
            try:
                poly = Polygon(ls)
                if not poly.is_empty and poly.area > tolerance * tolerance:
                    polygons.append(poly)
            except Exception:
                pass
    return polygons


def get_layers(doc: Drawing) -> list[str]:
    layers = [layer.dxf.name for layer in doc.layers]
    return list(dict.fromkeys(layers))


def get_bounds(doc: Drawing) -> dict[str, float] | None:
    try:
        from ezdxf.bbox import extents
        bbox = extents(doc.modelspace())
        if bbox.has_data:
            return {
                "minx": bbox.extmin.x,
                "miny": bbox.extmin.y,
                "maxx": bbox.extmax.x,
                "maxy": bbox.extmax.y,
            }
    except Exception:
        pass
    return None


def parse_dxf(path: Path) -> dict[str, Any]:
    """Parse DXF file and return metadata and contours for extrusion."""
    doc = ezdxf.readfile(str(path))
    layers = get_layers(doc)
    bounds = get_bounds(doc)
    lines = collect_geometry(doc)
    polygons = lines_to_polygons(lines)
    return {
        "layers": layers,
        "bounds": bounds,
        "contours": polygons,
        "line_count": len(lines),
    }
