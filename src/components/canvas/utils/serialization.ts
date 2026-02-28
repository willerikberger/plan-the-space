/**
 * @module serialization
 * @description Handles serialization, deserialization, validation, and migration of project data.
 * Converts between runtime PlannerObject/Fabric state and the SerializedProject JSON format (v2/v3/v4).
 * @dependencies types (PlannerObject, SerializedProject, SerializedProjectV3, SerializedProjectV4, SerializedObject, and related subtypes)
 * @usage Used by canvasOrchestration for project load, json-export for file export/import, and autoSave for IndexedDB persistence.
 */
import type {
  PlannerObject,
  SerializedProject,
  SerializedProjectV3,
  SerializedProjectV4,
  SerializedObject,
  SerializedObjectV4,
  SerializedShapeV4,
  SerializedLineV4,
  SerializedMaskV4,
  SerializedImage,
  SerializedCamera,
  ShapeObject,
  LineObject,
  MaskObject,
  BackgroundImageObject,
  OverlayImageObject,
  BackgroundImagePosition,
  Camera,
} from "@/lib/types";

/** Validate that project data has the expected structure */
export function validateProjectData(data: unknown): data is SerializedProject {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (typeof d.version !== "number") return false;
  if (!Array.isArray(d.objects)) return false;
  // pixelsPerMeter can be null or number
  if (d.pixelsPerMeter !== null && typeof d.pixelsPerMeter !== "number")
    return false;
  return true;
}

/** Serialize a PlannerObject + its Fabric state into a plain JSON object */
export function serializeObject(
  obj: PlannerObject,
  fabricState: {
    left: number;
    top: number;
    scaleX: number;
    scaleY: number;
    angle: number;
    // Shape-specific
    width?: number;
    height?: number;
    baseWidthPx?: number;
    baseHeightPx?: number;
    // Line-specific
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    strokeWidth?: number;
    // Image-specific
    originX?: string;
    originY?: string;
  },
): SerializedObject {
  const base = {
    id: obj.id,
    name: obj.name,
    left: fabricState.left,
    top: fabricState.top,
    scaleX: fabricState.scaleX,
    scaleY: fabricState.scaleY,
    angle: fabricState.angle,
  };

  switch (obj.type) {
    case "shape":
      return {
        ...base,
        type: "shape",
        widthM: obj.widthM,
        heightM: obj.heightM,
        color: obj.color,
        baseWidthPx: fabricState.baseWidthPx ?? 0,
        baseHeightPx: fabricState.baseHeightPx ?? 0,
        width: fabricState.width ?? 0,
        height: fabricState.height ?? 0,
        ...(obj.worldX != null ? { worldX: obj.worldX } : {}),
        ...(obj.worldY != null ? { worldY: obj.worldY } : {}),
      } satisfies SerializedShapeV4;

    case "line":
      return {
        ...base,
        type: "line",
        x1: fabricState.x1 ?? 0,
        y1: fabricState.y1 ?? 0,
        x2: fabricState.x2 ?? 0,
        y2: fabricState.y2 ?? 0,
        lengthM: obj.lengthM,
        color: obj.color,
        strokeWidth: fabricState.strokeWidth ?? 3,
        ...(obj.worldX1 != null ? { worldX1: obj.worldX1 } : {}),
        ...(obj.worldY1 != null ? { worldY1: obj.worldY1 } : {}),
        ...(obj.worldX2 != null ? { worldX2: obj.worldX2 } : {}),
        ...(obj.worldY2 != null ? { worldY2: obj.worldY2 } : {}),
      } satisfies SerializedLineV4;

    case "mask":
      return {
        ...base,
        type: "mask",
        width: (fabricState.width ?? 0) * fabricState.scaleX,
        height: (fabricState.height ?? 0) * fabricState.scaleY,
        scaleX: 1, // dimensions already baked in
        scaleY: 1, // dimensions already baked in
        ...(obj.worldX != null ? { worldX: obj.worldX } : {}),
        ...(obj.worldY != null ? { worldY: obj.worldY } : {}),
        ...(obj.widthM != null ? { widthM: obj.widthM } : {}),
        ...(obj.heightM != null ? { heightM: obj.heightM } : {}),
      } satisfies SerializedMaskV4;

    case "backgroundImage":
    case "overlayImage":
      return {
        ...base,
        type: obj.type,
        imageData: obj.imageData,
        originX: fabricState.originX ?? "left",
        originY: fabricState.originY ?? "top",
      } satisfies SerializedImage;
  }
}

/** Build the full project data object for export (v4 format with camera + world coords) */
export function serializeProject(
  pixelsPerMeter: number | null,
  backgroundImageData: string | null,
  objects: PlannerObject[],
  getFabricState: (id: number) => {
    left: number;
    top: number;
    scaleX: number;
    scaleY: number;
    angle: number;
    width?: number;
    height?: number;
    baseWidthPx?: number;
    baseHeightPx?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    strokeWidth?: number;
    originX?: string;
    originY?: string;
  } | null,
  backgroundImagePosition?: BackgroundImagePosition | null,
  camera?: Camera | null,
): SerializedProject {
  const serializedObjects: SerializedObject[] = [];

  for (const obj of objects) {
    const fabricState = getFabricState(obj.id);
    if (fabricState) {
      serializedObjects.push(serializeObject(obj, fabricState));
    }
  }

  const serializedCamera: SerializedCamera | undefined = camera
    ? {
        pixelsPerMeter: camera.pixelsPerMeter,
        zoom: camera.zoom,
        panX: camera.panX,
        panY: camera.panY,
        viewportWidth: camera.viewportWidth,
        viewportHeight: camera.viewportHeight,
      }
    : undefined;

  return {
    version: 4,
    pixelsPerMeter,
    backgroundImage: backgroundImageData,
    ...(backgroundImagePosition ? { backgroundImagePosition } : {}),
    ...(serializedCamera ? { camera: serializedCamera } : {}),
    savedAt: new Date().toISOString(),
    objects: serializedObjects,
    metadata: { appVersion: "1.0.0", exportedFrom: "plan-the-space" },
  } as SerializedProjectV4;
}

/** Deserialize a project JSON into store-ready objects */
export function deserializeProject(data: SerializedProject): {
  pixelsPerMeter: number | null;
  backgroundImageData: string | null;
  backgroundImagePosition?: BackgroundImagePosition;
  camera?: Camera;
  objects: PlannerObject[];
  serializedObjects: SerializedObject[];
} {
  const objects: PlannerObject[] = [];

  for (const sObj of data.objects) {
    // Cast to v4 types to access optional world-space fields
    const s = sObj as SerializedObjectV4;
    switch (s.type) {
      case "shape": {
        const sv4 = s as SerializedShapeV4;
        objects.push({
          id: sv4.id,
          type: "shape",
          name: sv4.name,
          widthM: sv4.widthM,
          heightM: sv4.heightM,
          color: sv4.color,
          ...(sv4.worldX != null ? { worldX: sv4.worldX } : {}),
          ...(sv4.worldY != null ? { worldY: sv4.worldY } : {}),
          ...(sv4.angle != null && sv4.angle !== 0 ? { angle: sv4.angle } : {}),
        } satisfies ShapeObject);
        break;
      }
      case "line": {
        const lv4 = s as SerializedLineV4;
        objects.push({
          id: lv4.id,
          type: "line",
          name: lv4.name,
          lengthM: lv4.lengthM,
          color: lv4.color,
          ...(lv4.worldX1 != null ? { worldX1: lv4.worldX1 } : {}),
          ...(lv4.worldY1 != null ? { worldY1: lv4.worldY1 } : {}),
          ...(lv4.worldX2 != null ? { worldX2: lv4.worldX2 } : {}),
          ...(lv4.worldY2 != null ? { worldY2: lv4.worldY2 } : {}),
        } satisfies LineObject);
        break;
      }
      case "mask": {
        const mv4 = s as SerializedMaskV4;
        objects.push({
          id: mv4.id,
          type: "mask",
          name: mv4.name,
          ...(mv4.worldX != null ? { worldX: mv4.worldX } : {}),
          ...(mv4.worldY != null ? { worldY: mv4.worldY } : {}),
          ...(mv4.widthM != null ? { widthM: mv4.widthM } : {}),
          ...(mv4.heightM != null ? { heightM: mv4.heightM } : {}),
          ...(mv4.angle != null && mv4.angle !== 0 ? { angle: mv4.angle } : {}),
        } satisfies MaskObject);
        break;
      }
      case "backgroundImage":
        objects.push({
          id: sObj.id,
          type: "backgroundImage",
          name: sObj.name,
          imageData: (sObj as SerializedImage).imageData,
        } satisfies BackgroundImageObject);
        break;
      case "overlayImage":
        objects.push({
          id: sObj.id,
          type: "overlayImage",
          name: sObj.name,
          imageData: (sObj as SerializedImage).imageData,
        } satisfies OverlayImageObject);
        break;
    }
  }

  // Extract camera from v4 projects
  const v4Data = data as Partial<SerializedProjectV4>;
  const camera: Camera | undefined = v4Data.camera
    ? {
        pixelsPerMeter: v4Data.camera.pixelsPerMeter,
        zoom: v4Data.camera.zoom,
        panX: v4Data.camera.panX,
        panY: v4Data.camera.panY,
        viewportWidth: v4Data.camera.viewportWidth,
        viewportHeight: v4Data.camera.viewportHeight,
      }
    : undefined;

  return {
    pixelsPerMeter: data.pixelsPerMeter,
    backgroundImageData: data.backgroundImage,
    ...(data.backgroundImagePosition
      ? { backgroundImagePosition: data.backgroundImagePosition }
      : {}),
    ...(camera ? { camera } : {}),
    objects,
    serializedObjects: data.objects,
  };
}

/** Migrate a v2 (or earlier) project to v3 format. Already-v3+ data passes through unchanged. */
export function migrateV2toV3(data: SerializedProject): SerializedProjectV3 {
  if (data.version >= 3 && "metadata" in data) {
    return data as SerializedProjectV3;
  }
  const { id, ...rest } = data;
  return {
    ...rest,
    version: 3,
    metadata: { exportedFrom: "plan-the-space" },
    ...(id ? { id } : {}),
  };
}

/**
 * Migrate a v3 project to v4 format.
 * Computes world coordinates from pixel positions when pixelsPerMeter is available.
 * Background image anchor = world origin; pixel positions / pixelsPerMeter = world coords.
 * If pixelsPerMeter is null, world coordinates are omitted (deferred conversion).
 */
export function migrateV3toV4(data: SerializedProject): SerializedProjectV4 {
  if (data.version >= 4) {
    return data as SerializedProjectV4;
  }

  const ppm = data.pixelsPerMeter;
  const objects: SerializedObject[] = data.objects.map((sObj) => {
    if (!ppm) return sObj; // Can't compute world coords without ppm

    switch (sObj.type) {
      case "shape": {
        // Shape left/top is the top-left corner. Center = left + width*scaleX/2, top + height*scaleY/2
        const scaledW = (sObj.width ?? 0) * (sObj.scaleX ?? 1);
        const scaledH = (sObj.height ?? 0) * (sObj.scaleY ?? 1);
        const centerX = (sObj.left ?? 0) + scaledW / 2;
        const centerY = (sObj.top ?? 0) + scaledH / 2;
        return {
          ...sObj,
          worldX: centerX / ppm,
          worldY: centerY / ppm,
        } satisfies SerializedShapeV4;
      }
      case "line": {
        // Line endpoints are relative to left/top
        const lx = sObj.left ?? 0;
        const ly = sObj.top ?? 0;
        return {
          ...sObj,
          worldX1: (lx + (sObj.x1 ?? 0)) / ppm,
          worldY1: (ly + (sObj.y1 ?? 0)) / ppm,
          worldX2: (lx + (sObj.x2 ?? 0)) / ppm,
          worldY2: (ly + (sObj.y2 ?? 0)) / ppm,
        } satisfies SerializedLineV4;
      }
      case "mask": {
        return {
          ...sObj,
          worldX: (sObj.left ?? 0) / ppm,
          worldY: (sObj.top ?? 0) / ppm,
          widthM: (sObj.width ?? 0) / ppm,
          heightM: (sObj.height ?? 0) / ppm,
        } satisfies SerializedMaskV4;
      }
      default:
        return sObj;
    }
  });

  const { id, ...rest } = data;
  return {
    ...rest,
    version: 4,
    objects,
    metadata: {
      ...((data as SerializedProjectV3).metadata ?? {}),
      exportedFrom: "plan-the-space",
    },
    ...(id ? { id } : {}),
  } as SerializedProjectV4;
}

/** Full migration chain: v2 → v3 → v4. Already-current data passes through unchanged. */
export function migrateProject(data: SerializedProject): SerializedProjectV4 {
  const v3 = migrateV2toV3(data);
  return migrateV3toV4(v3);
}
