"""Extrude 2D contours to 3D mesh and export STL/OBJ."""
from pathlib import Path
import numpy as np
import trimesh
from shapely.geometry import Polygon


def polygon_to_vertices_faces(poly: Polygon, z_bottom: float = 0.0, z_top: float = 1.0):
    """Convert a Shapely Polygon to vertices and faces for bottom, top, and sides."""
    if poly.is_empty or not poly.exterior:
        return np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int32)
    coords = np.array(poly.exterior.coords)
    if len(coords) < 3:
        return np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int32)
    # Remove duplicate closing point for cleaner mesh
    if np.allclose(coords[0], coords[-1]):
        coords = coords[:-1]
    n = len(coords)
    vertices = []
    # Bottom: z_bottom
    for i in range(n):
        vertices.append([coords[i, 0], coords[i, 1], z_bottom])
    # Top: z_top
    for i in range(n):
        vertices.append([coords[i, 0], coords[i, 1], z_top])
    vertices = np.array(vertices, dtype=np.float64)
    faces = []
    # Bottom face (CCW when viewed from below)
    for i in range(1, n - 1):
        faces.append([0, i, i + 1])
    # Top face (CCW when viewed from above)
    for i in range(1, n - 1):
        faces.append([n, n + i + 1, n + i])
    # Side quads (two triangles each)
    for i in range(n):
        i2 = (i + 1) % n
        faces.append([i, n + i, n + i2])
        faces.append([i, n + i2, i2])
    faces = np.array(faces, dtype=np.int32)
    return vertices, faces


def contours_to_mesh(polygons: list[Polygon], height: float = 1.0) -> trimesh.Trimesh:
    """Build a single mesh from multiple 2D polygons by extruding along Z."""
    all_vertices: list[np.ndarray] = []
    all_faces: list[np.ndarray] = []
    offset = 0
    for poly in polygons:
        if poly.is_empty:
            continue
        v, f = polygon_to_vertices_faces(poly, z_bottom=0.0, z_top=height)
        if len(v) == 0:
            continue
        f = f + offset
        offset += len(v)
        all_vertices.append(v)
        all_faces.append(f)
    if not all_vertices:
        return trimesh.Trimesh(vertices=np.zeros((0, 3)), faces=np.zeros((0, 3), dtype=np.int32))
    vertices = np.vstack(all_vertices)
    faces = np.vstack(all_faces)
    return trimesh.Trimesh(vertices=vertices, faces=faces)


def export_mesh(mesh: trimesh.Trimesh, out_path: Path, fmt: str) -> None:
    """Export mesh to STL or OBJ using trimesh exchange (avoids export() callable issues)."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    path_str = str(out_path)
    if fmt == "stl":
        data = trimesh.exchange.stl.export_stl(mesh)
        with open(path_str, "wb") as f:
            f.write(data)
    elif fmt == "obj":
        data = trimesh.exchange.obj.export_obj(mesh)
        with open(path_str, "w", encoding="utf-8") as f:
            f.write(data)
    else:
        raise ValueError(f"Unsupported format: {fmt}")
