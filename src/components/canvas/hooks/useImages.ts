/**
 * @module useImages
 * @description Loads and manages background and overlay images on the Fabric canvas.
 * Handles file reading, scaling to fit/overlay, and syncing image state with the Zustand store.
 * @dependencies fabric (FabricImage), fabricHelpers (setFabricProps), geometry (fitImageScale, overlayImageScale), store, types (ImageFabricRefs)
 * @usage Called from PlannerCanvas; loadBackgroundImage and addOverlayImage are exposed via the imperative handle to the sidebar.
 */
"use client";

import { useRef, useCallback } from "react";
import { FabricImage } from "fabric";
import type { Canvas } from "fabric";
import { usePlannerStore } from "@/lib/store";
import { setFabricProps } from "@/components/canvas/utils/fabricHelpers";
import {
  fitImageScale,
  overlayImageScale,
} from "@/components/canvas/utils/geometry";
import type { ImageFabricRefs } from "@/lib/types";

export function useImages(
  fabricCanvasRef: React.RefObject<Canvas | null>,
  fabricRefsRef: React.RefObject<Map<number, ImageFabricRefs>>,
) {
  const backgroundRef = useRef<FabricImage | null>(null);

  const loadBackgroundImage = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        usePlannerStore.getState().setBackgroundImageData(dataUrl);
        loadBackgroundFromData(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const loadBackgroundFromData = useCallback(
    async (dataUrl: string, callback?: () => void) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const img = await FabricImage.fromURL(dataUrl);

      if (backgroundRef.current) {
        canvas.remove(backgroundRef.current);
      }

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
      setFabricProps(img, { objectType: "background" });

      backgroundRef.current = img;
      canvas.add(img);
      canvas.sendObjectToBack(img);
      canvas.renderAll();

      usePlannerStore
        .getState()
        .setStatusMessage(
          "Image loaded. Set the scale to start adding shapes.",
        );
      callback?.();
    },
    [fabricCanvasRef],
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

        fabricRefsRef.current.set(id, { image: img });

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

      fabricRefsRef.current.set(id, { image: img });

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
    backgroundRef,
    loadBackgroundImage,
    loadBackgroundFromData,
    addOverlayImage,
    loadImageObject,
  };
}
