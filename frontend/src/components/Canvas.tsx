"use client";

import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { type ComponentProps, useEffect, useRef, useState } from "react";

// Derive the imperative API type from the component, avoiding fragile deep type imports.
type ExcalidrawAPI = Parameters<
  NonNullable<ComponentProps<typeof Excalidraw>["excalidrawAPI"]>
>[0];

type Props = { onDiagram: (base64: string) => void };

export default function Canvas({ onDiagram }: Props) {
  const [api, setApi] = useState<ExcalidrawAPI | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDiagramRef = useRef(onDiagram);
  onDiagramRef.current = onDiagram;

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleChange = () => {
    if (!api) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    // Debounce: only snapshot ~1.5s after drawing settles.
    timerRef.current = setTimeout(async () => {
      const elements = api.getSceneElements();
      if (!elements || elements.length === 0) return;
      try {
        const blob = await exportToBlob({
          elements,
          files: api.getFiles(),
          mimeType: "image/png",
          exportPadding: 16,
          getDimensions: (width: number, height: number) => {
            const scale = Math.min(1, 1024 / Math.max(width, height));
            return { width: width * scale, height: height * scale, scale };
          },
        });
        const arr = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
        onDiagramRef.current(btoa(bin));
      } catch (err) {
        console.error("diagram export failed", err);
      }
    }, 1500);
  };

  return (
    <div className="h-full w-full">
      <Excalidraw excalidrawAPI={(a) => setApi(a)} onChange={handleChange} theme="dark" />
    </div>
  );
}
