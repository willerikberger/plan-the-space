import type { ShapeBundleV1, ShapeBundleShape } from "@/lib/types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isShapeRecord(value: unknown): value is ShapeBundleShape {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  if (typeof s.name !== "string" || s.name.trim().length === 0) return false;
  if (typeof s.color !== "string" || s.color.trim().length === 0) return false;
  if (!isFiniteNumber(s.widthM) || !isFiniteNumber(s.heightM)) return false;
  if (s.widthM <= 0 || s.heightM <= 0) return false;
  if (s.worldX != null && !isFiniteNumber(s.worldX)) return false;
  if (s.worldY != null && !isFiniteNumber(s.worldY)) return false;
  if (s.angle != null && !isFiniteNumber(s.angle)) return false;
  return true;
}

export function validateShapeBundleData(data: unknown): data is ShapeBundleV1 {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.format !== "plan-the-space-shapes") return false;
  if (d.version !== 1) return false;
  if (!Array.isArray(d.shapes)) return false;
  if (d.shapes.length === 0) return false;
  return d.shapes.every(isShapeRecord);
}

export function importShapesFromFile(file: File): Promise<ShapeBundleV1> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!validateShapeBundleData(data)) {
          reject(new Error("Invalid shapes file format"));
          return;
        }
        resolve(data as ShapeBundleV1);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Failed to parse JSON"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
