/**
 * @module useImages
 * @description Loads and manages background and overlay images on the Fabric canvas.
 * Both background and overlay images are tracked as regular store objects with Fabric refs.
 * @dependencies fabric (FabricImage), fabricHelpers (setFabricProps), geometry (fitImageScale, overlayImageScale), store, types (ImageFabricRefs)
 * @usage Called from PlannerCanvas; loadBackgroundImage and addOverlayImage are exposed via the imperative handle to the sidebar.
 */
"use client";

import { useCallback } from "react";
import { FabricImage } from "fabric";
import type { Canvas } from "fabric";
import { usePlannerStore } from "@/lib/store";
import { setFabricProps } from "@/components/canvas/utils/fabricHelpers";
import {
  fitImageScale,
  overlayImageScale,
} from "@/components/canvas/utils/geometry";
import type { ImageFabricRefs } from "@/lib/types";

export interface UseImagesReturn {
  loadBackgroundImage: (file: File) => void;
  addOverlayImage: (file: File) => void;
  loadImageObject: (data: {
    type: "backgroundImage" | "overlayImage";
    left: number;
    top: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
    imageData: string;
    name: string;
    originX?: string;
    originY?: string;
  }) => Promise<void>;
}

export function useImages(
  fabricCanvasRef: React.RefObject<Canvas | null>,
  fabricRefsRef: React.RefObject<Map<number, ImageFabricRefs>>,
): UseImagesReturn {
  const loadBackgroundImage = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const dataUrl = e.target?.result as string;

        // Remove any existing background image
        const store = usePlannerStore.getState();
        for (const [id, obj] of store.objects) {
          if (obj.type === "backgroundImage") {
            const refs = fabricRefsRef.current.get(id);
            if (refs) {
              canvas.remove(refs.image);
              fabricRefsRef.current.delete(id);
            }
            store.removeObject(id);
            break;
          }
        }

        const img = await FabricImage.fromURL(dataUrl);

        // First load — fit to canvas
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();
        const scale = fitImageScale(
          img.width!,
          img.height!,
          canvasWidth,
          canvasHeight,
        );

        img.set({
          scaleX: scale,
          scaleY: scale,
          left: (canvasWidth - img.width! * scale) / 2,
          top: (canvasHeight - img.height! * scale) / 2,
          selectable: false,
          evented: false,
          hoverCursor: "default",
        });

        const id = usePlannerStore.getState().nextObjectId();
        setFabricProps(img, {
          objectId: id,
          objectType: "backgroundImage",
          imageData: dataUrl,
        });

        canvas.add(img);
        canvas.renderAll();

        fabricRefsRef.current.set(id, { type: "image", image: img });

        usePlannerStore.getState().addObject({
          id,
          type: "backgroundImage",
          name: "Background",
          imageData: dataUrl,
        });

        usePlannerStore
          .getState()
          .setStatusMessage(
            "Image loaded. Set the scale to start adding shapes.",
          );
      };
      reader.readAsDataURL(file);
    },
    [fabricCanvasRef, fabricRefsRef],
  );

  const addOverlayImage = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const dataUrl = e.target?.result as string;

        const img = await FabricImage.fromURL(dataUrl);
        const scale = overlayImageScale(
          img.width!,
          img.height!,
          canvas.getWidth(),
          canvas.getHeight(),
        );

        img.set({
          scaleX: scale,
          scaleY: scale,
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() / 2,
          originX: "center",
          originY: "center",
        });

        const store = usePlannerStore.getState();
        const id = store.nextObjectId();
        setFabricProps(img, {
          objectId: id,
          objectType: "overlayImage",
          imageData: dataUrl,
        });

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();

        fabricRefsRef.current.set(id, { type: "image", image: img });

        store.addObject({
          id,
          type: "overlayImage",
          name: `Image ${id + 1}`,
          imageData: dataUrl,
        });

        store.setStatusMessage("Added overlay image");
      };
      reader.readAsDataURL(file);
    },
    [fabricCanvasRef, fabricRefsRef],
  );

  const loadImageObject = useCallback(
    async (data: {
      imageData: string;
      left: number;
      top: number;
      scaleX?: number;
      scaleY?: number;
      angle?: number;
      originX?: string;
      originY?: string;
      type: "backgroundImage" | "overlayImage";
      name: string;
    }) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const img = await FabricImage.fromURL(data.imageData);

      img.set({
        left: data.left,
        top: data.top,
        scaleX: data.scaleX ?? 1,
        scaleY: data.scaleY ?? 1,
        angle: data.angle ?? 0,
        originX: (data.originX ?? "left") as "left" | "center" | "right",
        originY: (data.originY ?? "top") as "top" | "center" | "bottom",
        selectable: data.type === "overlayImage",
        evented: data.type === "overlayImage",
      });

      const store = usePlannerStore.getState();
      const id = store.nextObjectId();
      setFabricProps(img, {
        objectId: id,
        objectType: data.type,
        imageData: data.imageData,
      });

      canvas.add(img);
      canvas.renderAll();

      fabricRefsRef.current.set(id, { type: "image", image: img });

      store.addObject({
        id,
        type: data.type,
        name: data.name,
        imageData: data.imageData,
      });
    },
    [fabricCanvasRef, fabricRefsRef],
  );

  return {
    loadBackgroundImage,
    addOverlayImage,
    loadImageObject,
  };
}
