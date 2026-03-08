import { describe, it, expect } from "vitest";
import {
  importShapesFromFile,
  validateShapeBundleData,
} from "@/lib/storage/shape-import";

describe("shape-import", () => {
  it("validates a well-formed shape bundle", () => {
    expect(
      validateShapeBundleData({
        format: "plan-the-space-shapes",
        version: 1,
        shapes: [
          {
            name: "Deck",
            color: "#22aa44",
            widthM: 3,
            heightM: 2,
            worldX: 10,
            worldY: 12,
            angle: 0,
          },
        ],
      }),
    ).toBe(true);
  });

  it("rejects invalid shape bundles", () => {
    expect(
      validateShapeBundleData({
        format: "plan-the-space-shapes",
        version: 1,
        shapes: [{ name: "Bad", color: "#000", widthM: 0, heightM: 2 }],
      }),
    ).toBe(false);
  });

  it("imports a valid shape bundle file", async () => {
    const file = new File(
      [
        JSON.stringify({
          format: "plan-the-space-shapes",
          version: 1,
          source: { pixelsPerMeter: 100 },
          shapes: [
            { name: "Shape A", color: "#123456", widthM: 2, heightM: 3 },
          ],
        }),
      ],
      "shapes.json",
      { type: "application/json" },
    );

    const result = await importShapesFromFile(file);
    expect(result.format).toBe("plan-the-space-shapes");
    expect(result.shapes).toHaveLength(1);
    expect(result.source?.pixelsPerMeter).toBe(100);
  });

  it("throws for invalid JSON file content", async () => {
    const file = new File(["{not-valid-json"], "bad.json", {
      type: "application/json",
    });

    await expect(importShapesFromFile(file)).rejects.toThrow();
  });

  it("throws for JSON that is not a valid shape bundle", async () => {
    const file = new File(
      [
        JSON.stringify({
          format: "plan-the-space-shapes",
          version: 1,
          shapes: [],
        }),
      ],
      "invalid-shapes.json",
      { type: "application/json" },
    );

    await expect(importShapesFromFile(file)).rejects.toThrow(
      "Invalid shapes file format",
    );
  });
});
