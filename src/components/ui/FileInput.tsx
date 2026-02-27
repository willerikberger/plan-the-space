"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";

interface FileInputProps {
  accept?: string;
  onChange: (file: File) => void;
  label?: string;
  variant?: "default" | "secondary" | "outline";
}

export function FileInput({
  accept,
  onChange,
  label = "Choose File",
  variant = "secondary",
}: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative w-full">
      <Button
        type="button"
        variant={variant}
        className="w-full"
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onChange(file);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
