import type {
  PlannerObject,
  SerializedProject,
  SerializedProjectV3,
  SerializedObject,
  SerializedShape,
  SerializedLine,
  SerializedMask,
  SerializedImage,
  ShapeObject,
  LineObject,
  MaskObject,
  BackgroundImageObject,
  OverlayImageObject,
} from '@/lib/types'

/** Validate that project data has the expected structure */
export function validateProjectData(data: unknown): data is SerializedProject {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (typeof d.version !== 'number') return false
  if (!Array.isArray(d.objects)) return false
  // pixelsPerMeter can be null or number
  if (d.pixelsPerMeter !== null && typeof d.pixelsPerMeter !== 'number') return false
  return true
}

/** Serialize a PlannerObject + its Fabric state into a plain JSON object */
export function serializeObject(
  obj: PlannerObject,
  fabricState: {
    left: number
    top: number
    scaleX: number
    scaleY: number
    angle: number
    // Shape-specific
    width?: number
    height?: number
    baseWidthPx?: number
    baseHeightPx?: number
    // Line-specific
    x1?: number
    y1?: number
    x2?: number
    y2?: number
    strokeWidth?: number
    // Image-specific
    originX?: string
    originY?: string
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
  }

  switch (obj.type) {
    case 'shape':
      return {
        ...base,
        type: 'shape',
        widthM: obj.widthM,
        heightM: obj.heightM,
        color: obj.color,
        baseWidthPx: fabricState.baseWidthPx ?? 0,
        baseHeightPx: fabricState.baseHeightPx ?? 0,
        width: fabricState.width ?? 0,
        height: fabricState.height ?? 0,
      } satisfies SerializedShape

    case 'line':
      return {
        ...base,
        type: 'line',
        x1: fabricState.x1 ?? 0,
        y1: fabricState.y1 ?? 0,
        x2: fabricState.x2 ?? 0,
        y2: fabricState.y2 ?? 0,
        lengthM: obj.lengthM,
        color: obj.color,
        strokeWidth: fabricState.strokeWidth ?? 3,
      } satisfies SerializedLine

    case 'mask':
      return {
        ...base,
        type: 'mask',
        width: (fabricState.width ?? 0) * fabricState.scaleX,
        height: (fabricState.height ?? 0) * fabricState.scaleY,
      } satisfies SerializedMask

    case 'backgroundImage':
    case 'overlayImage':
      return {
        ...base,
        type: obj.type,
        imageData: obj.imageData,
        originX: fabricState.originX ?? 'left',
        originY: fabricState.originY ?? 'top',
      } satisfies SerializedImage
  }
}

/** Build the full project data object for export */
export function serializeProject(
  pixelsPerMeter: number | null,
  backgroundImageData: string | null,
  objects: PlannerObject[],
  getFabricState: (id: number) => {
    left: number
    top: number
    scaleX: number
    scaleY: number
    angle: number
    width?: number
    height?: number
    baseWidthPx?: number
    baseHeightPx?: number
    x1?: number
    y1?: number
    x2?: number
    y2?: number
    strokeWidth?: number
    originX?: string
    originY?: string
  } | null,
): SerializedProject {
  const serializedObjects: SerializedObject[] = []

  for (const obj of objects) {
    const fabricState = getFabricState(obj.id)
    if (fabricState) {
      serializedObjects.push(serializeObject(obj, fabricState))
    }
  }

  return {
    version: 3,
    pixelsPerMeter,
    backgroundImage: backgroundImageData,
    savedAt: new Date().toISOString(),
    objects: serializedObjects,
    metadata: { appVersion: '1.0.0', exportedFrom: 'plan-the-space' },
  } as SerializedProjectV3
}

/** Deserialize a project JSON into store-ready objects */
export function deserializeProject(data: SerializedProject): {
  pixelsPerMeter: number | null
  backgroundImageData: string | null
  objects: PlannerObject[]
  serializedObjects: SerializedObject[]
} {
  const objects: PlannerObject[] = []

  for (const sObj of data.objects) {
    switch (sObj.type) {
      case 'shape':
        objects.push({
          id: sObj.id,
          type: 'shape',
          name: sObj.name,
          widthM: sObj.widthM,
          heightM: sObj.heightM,
          color: sObj.color,
        } satisfies ShapeObject)
        break
      case 'line':
        objects.push({
          id: sObj.id,
          type: 'line',
          name: sObj.name,
          lengthM: sObj.lengthM,
          color: sObj.color,
        } satisfies LineObject)
        break
      case 'mask':
        objects.push({
          id: sObj.id,
          type: 'mask',
          name: sObj.name,
        } satisfies MaskObject)
        break
      case 'backgroundImage':
        objects.push({
          id: sObj.id,
          type: 'backgroundImage',
          name: sObj.name,
          imageData: sObj.imageData,
        } satisfies BackgroundImageObject)
        break
      case 'overlayImage':
        objects.push({
          id: sObj.id,
          type: 'overlayImage',
          name: sObj.name,
          imageData: sObj.imageData,
        } satisfies OverlayImageObject)
        break
    }
  }

  return {
    pixelsPerMeter: data.pixelsPerMeter,
    backgroundImageData: data.backgroundImage,
    objects,
    serializedObjects: data.objects,
  }
}

/** Migrate a v2 (or earlier) project to v3 format. Already-v3 data passes through unchanged. */
export function migrateProject(data: SerializedProject): SerializedProjectV3 {
  if (data.version === 3 && 'metadata' in data) {
    return data as SerializedProjectV3
  }
  const { id, ...rest } = data
  return {
    ...rest,
    version: 3,
    metadata: { exportedFrom: 'plan-the-space' },
    ...(id ? { id } : {}),
  }
}
