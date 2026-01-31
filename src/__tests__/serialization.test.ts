import { describe, it, expect } from 'vitest'
import {
  serializeObject,
  serializeProject,
  deserializeProject,
  validateProjectData,
  migrateProject,
} from '@/components/canvas/utils/serialization'
import type { ShapeObject, LineObject, MaskObject, SerializedProject, SerializedProjectV3 } from '@/lib/types'

describe('validateProjectData', () => {
  it('accepts valid v2 project', () => {
    expect(
      validateProjectData({
        version: 2,
        pixelsPerMeter: 50,
        backgroundImage: null,
        savedAt: '2024-01-01',
        objects: [],
      }),
    ).toBe(true)
  })

  it('accepts valid v3 project', () => {
    expect(
      validateProjectData({
        version: 3,
        pixelsPerMeter: 50,
        backgroundImage: null,
        savedAt: '2024-01-01',
        objects: [],
        metadata: { appVersion: '1.0.0', exportedFrom: 'plan-the-space' },
      }),
    ).toBe(true)
  })

  it('accepts null pixelsPerMeter', () => {
    expect(
      validateProjectData({
        version: 2,
        pixelsPerMeter: null,
        backgroundImage: null,
        savedAt: '2024-01-01',
        objects: [],
      }),
    ).toBe(true)
  })

  it('rejects non-object', () => {
    expect(validateProjectData('hello')).toBe(false)
    expect(validateProjectData(null)).toBe(false)
  })

  it('rejects missing version', () => {
    expect(validateProjectData({ objects: [] })).toBe(false)
  })

  it('rejects missing objects array', () => {
    expect(validateProjectData({ version: 2 })).toBe(false)
  })
})

describe('serializeObject', () => {
  it('serializes shape', () => {
    const shape: ShapeObject = {
      id: 0,
      type: 'shape',
      name: 'Test Shape',
      widthM: 2,
      heightM: 3,
      color: 'rgba(76, 175, 80, 0.6)',
    }
    const result = serializeObject(shape, {
      left: 100,
      top: 200,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      width: 100,
      height: 150,
      baseWidthPx: 100,
      baseHeightPx: 150,
    })
    expect(result.type).toBe('shape')
    expect(result).toHaveProperty('widthM', 2)
    expect(result).toHaveProperty('heightM', 3)
  })

  it('serializes line', () => {
    const line: LineObject = {
      id: 1,
      type: 'line',
      name: 'Test Line',
      lengthM: 5,
      color: 'red',
    }
    const result = serializeObject(line, {
      left: 50,
      top: 50,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 100,
      strokeWidth: 3,
    })
    expect(result.type).toBe('line')
    expect(result).toHaveProperty('lengthM', 5)
    expect(result).toHaveProperty('x1', 0)
    expect(result).toHaveProperty('x2', 100)
  })

  it('serializes mask with combined scale', () => {
    const mask: MaskObject = { id: 2, type: 'mask', name: 'Mask 1' }
    const result = serializeObject(mask, {
      left: 10,
      top: 20,
      scaleX: 2,
      scaleY: 3,
      angle: 0,
      width: 50,
      height: 40,
    })
    expect(result.type).toBe('mask')
    expect(result).toHaveProperty('width', 100) // 50 * 2
    expect(result).toHaveProperty('height', 120) // 40 * 3
  })
})

describe('round-trip serialize -> deserialize', () => {
  it('preserves all shape data', () => {
    const shape: ShapeObject = {
      id: 0,
      type: 'shape',
      name: 'Garden',
      widthM: 2.5,
      heightM: 3.1,
      color: 'rgba(76, 175, 80, 0.6)',
    }
    const line: LineObject = {
      id: 1,
      type: 'line',
      name: 'Fence',
      lengthM: 4.2,
      color: 'rgba(244, 67, 54, 1)',
    }

    const project = serializeProject(
      50,
      'data:image/png;base64,abc',
      [shape, line],
      (id) => {
        if (id === 0)
          return {
            left: 100,
            top: 200,
            scaleX: 1,
            scaleY: 1,
            angle: 45,
            width: 125,
            height: 155,
            baseWidthPx: 125,
            baseHeightPx: 155,
          }
        if (id === 1)
          return {
            left: 50,
            top: 50,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            x1: 0,
            y1: 0,
            x2: 200,
            y2: 0,
            strokeWidth: 3,
          }
        return null
      },
    )

    expect(project.version).toBe(3)
    expect(project.pixelsPerMeter).toBe(50)
    expect(project.objects).toHaveLength(2)
    expect((project as SerializedProjectV3).metadata?.exportedFrom).toBe('plan-the-space')

    const deserialized = deserializeProject(project)
    expect(deserialized.pixelsPerMeter).toBe(50)
    expect(deserialized.backgroundImageData).toBe('data:image/png;base64,abc')
    expect(deserialized.objects).toHaveLength(2)

    const dShape = deserialized.objects[0]
    expect(dShape.type).toBe('shape')
    if (dShape.type === 'shape') {
      expect(dShape.name).toBe('Garden')
      expect(dShape.widthM).toBe(2.5)
      expect(dShape.heightM).toBe(3.1)
    }

    const dLine = deserialized.objects[1]
    expect(dLine.type).toBe('line')
    if (dLine.type === 'line') {
      expect(dLine.name).toBe('Fence')
      expect(dLine.lengthM).toBe(4.2)
    }
  })
})

describe('backward compatibility (v2 format from vanilla app)', () => {
  it('deserializes a v2 project', () => {
    const v2Data: SerializedProject = {
      version: 2,
      pixelsPerMeter: 73.5,
      backgroundImage: 'data:image/png;base64,xyz',
      savedAt: '2024-06-15T10:30:00.000Z',
      objects: [
        {
          id: 0,
          type: 'shape',
          name: 'Patio',
          left: 120,
          top: 80,
          scaleX: 1.2,
          scaleY: 0.8,
          angle: 15,
          widthM: 3,
          heightM: 4,
          color: 'rgba(33, 150, 243, 0.6)',
          baseWidthPx: 220.5,
          baseHeightPx: 294,
          width: 220.5,
          height: 294,
        },
        {
          id: 1,
          type: 'mask',
          name: 'Mask 1',
          left: 10,
          top: 20,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          width: 100,
          height: 80,
        },
      ],
    }

    expect(validateProjectData(v2Data)).toBe(true)
    const result = deserializeProject(v2Data)
    expect(result.objects).toHaveLength(2)
    expect(result.objects[0].type).toBe('shape')
    expect(result.objects[1].type).toBe('mask')
    // Serialized data preserved for canvas reconstruction
    expect(result.serializedObjects[0]).toHaveProperty('baseWidthPx', 220.5)
  })
})

describe('migrateProject', () => {
  it('migrates v2 to v3 with metadata', () => {
    const v2Data: SerializedProject = {
      version: 2,
      pixelsPerMeter: 50,
      backgroundImage: null,
      savedAt: '2024-01-01',
      objects: [],
    }
    const v3 = migrateProject(v2Data)
    expect(v3.version).toBe(3)
    expect(v3.metadata?.exportedFrom).toBe('plan-the-space')
    expect(v3.pixelsPerMeter).toBe(50)
    expect(v3.objects).toEqual([])
  })

  it('passes through v3 data unchanged', () => {
    const v3Data: SerializedProjectV3 = {
      version: 3,
      pixelsPerMeter: 75,
      backgroundImage: 'data:test',
      savedAt: '2024-06-01',
      objects: [],
      metadata: { appVersion: '1.0.0', exportedFrom: 'plan-the-space' },
    }
    const result = migrateProject(v3Data)
    expect(result).toEqual(v3Data)
  })

  it('preserves IDB id during migration', () => {
    const v2Data: SerializedProject = {
      version: 2,
      pixelsPerMeter: 50,
      backgroundImage: null,
      savedAt: '2024-01-01',
      objects: [],
      id: 'plan-the-space-project',
    }
    const v3 = migrateProject(v2Data)
    expect(v3.id).toBe('plan-the-space-project')
  })
})
