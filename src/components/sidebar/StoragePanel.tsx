"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/FileInput";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { checkProjectExists } from "@/lib/storage/indexeddb";

interface StoragePanelProps {
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onToggleAutoSave: () => void;
}

export function StoragePanel({
  onSave,
  onLoad,
  onClear,
  onExport,
  onImport,
}: StoragePanelProps) {
  const [storageStatus, setStorageStatus] = useState("No saved data");

  useEffect(() => {
    checkProjectExists().then((data) => {
      if (data?.savedAt) {
        const d = new Date(data.savedAt);
        setStorageStatus(
          `Last saved: ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`,
        );
      }
    });
  }, []);

  return (
    <div className="mb-6">
      <h2 className="text-xs uppercase tracking-wide text-planner-primary mb-3 pb-2 border-b border-planner-accent font-semibold">
        Save / Load
      </h2>

      <div className="mb-3">
        <span className="text-xs text-planner-success font-medium">
          Auto-save: On
        </span>
      </div>

      <div className="flex gap-2 mb-2">
        <Button
          variant="secondary"
          size="sm"
          data-testid="save-btn"
          onClick={() => {
            onSave();
            toast.success("Project saved");
          }}
        >
          Save Now
        </Button>
        <Button
          variant="secondary"
          size="sm"
          data-testid="load-btn"
          onClick={() => {
            onLoad();
            toast.success("Project loaded");
          }}
        >
          Load
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="text-planner-danger-alt"
          onClick={onClear}
          data-testid="clear-storage-btn"
        >
          Clear
        </Button>
      </div>
      <p className="text-xs text-planner-text-dim mb-4">{storageStatus}</p>

      <Separator className="my-4 bg-planner-accent" />
      <div>
        <label className="text-planner-text-secondary text-xs block mb-1.5">
          File Export/Import
        </label>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            data-testid="export-btn"
            onClick={() => {
              onExport();
              toast.success("Project exported");
            }}
          >
            Export JSON
          </Button>
          <div className="flex-1" data-testid="import-btn">
            <FileInput
              accept=".json"
              onChange={(file) => {
                onImport(file);
                toast.success("Project imported");
              }}
              label="Import JSON"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
