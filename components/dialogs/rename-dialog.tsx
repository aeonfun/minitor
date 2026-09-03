"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialValue: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
}

export function RenameDialog({
  open,
  onOpenChange,
  title,
  initialValue,
  placeholder,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setValue(initialValue);
  }

  function commit() {
    const next = value.trim();
    if (!next) return;
    onSubmit(next);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="rename-input">Name</Label>
            <Input
              id="rename-input"
              value={value}
              placeholder={placeholder}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
