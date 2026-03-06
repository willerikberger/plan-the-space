"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface NewProjectResult {
  name: string;
  description?: string;
  backgroundImage?: File;
}

interface NewProjectWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (result: NewProjectResult) => void;
}

export function NewProjectWizard({
  open,
  onClose,
  onComplete,
}: NewProjectWizardProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);

  const totalSteps = 2;

  const resetWizard = () => {
    setStep(1);
    setName("");
    setDescription("");
    setBackgroundImage(null);
  };

  const handleComplete = () => {
    onComplete({
      name: name.trim(),
      description: description.trim() || undefined,
      backgroundImage: backgroundImage ?? undefined,
    });
    resetWizard();
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            New Project — Step {step} of {totalSteps}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Backyard Redesign"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="project-description">
                Description (optional)
              </Label>
              <Input
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)} disabled={!name.trim()}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Background Image (optional)</Label>
              <p className="text-xs text-planner-text-muted mt-1 mb-2">
                Upload a floor plan or site photo to trace over.
              </p>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setBackgroundImage(file);
                }}
              />
              {backgroundImage && (
                <p className="text-xs text-planner-green mt-1">
                  {backgroundImage.name}
                </p>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <div className="flex gap-2">
                {!backgroundImage && (
                  <Button variant="outline" onClick={handleComplete}>
                    Skip
                  </Button>
                )}
                <Button onClick={handleComplete}>Done</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
