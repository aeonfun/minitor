"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "default" | "destructive";
  icon?: LucideIcon;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "destructive",
  icon: Icon = AlertTriangle,
  onConfirm,
}: Props) {
  const tint = variant === "destructive" ? "rgba(207, 45, 86, 0.14)" : "rgba(38, 37, 30, 0.08)";
  const color = variant === "destructive" ? "#cf2d56" : "#26251e";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col items-center sm:max-w-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm();
            onOpenChange(false);
          }}
          className="contents"
        >
          <div
            className="mx-auto flex size-11 items-center justify-center rounded-full"
            style={{ backgroundColor: tint, color }}
          >
            <Icon className="size-5" strokeWidth={2.25} />
          </div>

          <DialogHeader className="gap-0 text-center">
            <DialogTitle className="text-balance text-center">{title}</DialogTitle>
            <DialogDescription className="mx-auto mt-1.5 text-pretty text-center sm:max-w-[90%]">
              {description}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="w-full gap-2 sm:justify-center">
            <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              autoFocus
              className="flex-1"
              variant={variant === "destructive" ? "destructive" : "default"}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
