"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Eye, EyeOff, KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";

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
import { ENV_KEYS } from "@/lib/env-keys";
import { IS_HOSTED_CLIENT } from "@/lib/hosted";
import { logout } from "@/app/login/actions";
import {
  getEnvKeysStatus,
  setEnvKeys,
  type EnvKeyStatus,
} from "@/app/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SENTINEL = "•••keep•••"; // marks "user didn't touch this field"

export function SettingsDialog({ open, onOpenChange }: Props) {
  const [status, setStatus] = useState<EnvKeyStatus[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Refresh status each time the dialog opens — keys may have changed via
  // .env.local edits since last open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getEnvKeysStatus().then((s) => {
      if (cancelled) return;
      setStatus(s);
      const next: Record<string, string> = {};
      for (const row of s) next[row.key] = SENTINEL;
      setValues(next);
      setReveal({});
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const statusByKey = useMemo(() => {
    const map = new Map<string, EnvKeyStatus>();
    for (const s of status) map.set(s.key, s);
    return map;
  }, [status]);

  const dirty = useMemo(
    () => Object.values(values).some((v) => v !== SENTINEL),
    [values],
  );

  async function save() {
    const updates: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v === SENTINEL) continue;
      updates[k] = v.trim();
    }
    if (Object.keys(updates).length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await setEnvKeys(updates);
      toast.success("Saved API keys");
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save keys";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings · API keys</DialogTitle>
        </DialogHeader>
        {IS_HOSTED_CLIENT ? (
          <p className="-mt-1 text-[12.5px] text-muted-foreground">
            This is a hosted deployment. API keys are read from server
            environment variables and can&apos;t be edited here — set them on
            your host (e.g. Railway / Render variables) and redeploy.
          </p>
        ) : (
          <p className="-mt-1 text-[12.5px] text-muted-foreground">
            Keys are written to{" "}
            <code className="rounded bg-foreground/[0.06] px-1 py-px text-[11.5px] text-foreground/90">
              .env.local
            </code>{" "}
            and applied immediately — no restart needed.
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="contents"
        >
          <div className="grid gap-4">
            {ENV_KEYS.map((spec) => {
              const s = statusByKey.get(spec.key);
              const set = !!s?.set;
              const preview = s?.preview;
              const isRevealed = !!reveal[spec.key];
              const value = values[spec.key] ?? SENTINEL;
              const placeholder = set
                ? preview
                  ? `currently set, ending in …${preview}`
                  : "currently set"
                : "not set";
              return (
                <div key={spec.key} className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor={`env-${spec.key}`}
                      className="flex items-center gap-1.5 text-[13px] font-medium"
                    >
                      <KeyRound className="size-3.5 text-muted-foreground" />
                      {spec.label}
                      {spec.required && (
                        <span className="rounded bg-amber-500/10 px-1 py-px text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          required
                        </span>
                      )}
                      {set ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1 py-px text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                          <Check className="size-2.5" strokeWidth={3} />
                          set
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1 py-px text-[10px] text-muted-foreground">
                          not set
                        </span>
                      )}
                    </Label>
                    <a
                      href={spec.signupUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Get a key
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <Input
                      id={`env-${spec.key}`}
                      type={isRevealed ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      value={value === SENTINEL ? "" : value}
                      placeholder={placeholder}
                      disabled={IS_HOSTED_CLIENT}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [spec.key]: e.target.value }))
                      }
                      className="pr-9 font-mono text-[12.5px] disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setReveal((r) => ({ ...r, [spec.key]: !r[spec.key] }))
                      }
                      className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={isRevealed ? "Hide value" : "Show value"}
                      tabIndex={-1}
                    >
                      {isRevealed ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                    {spec.description}
                  </p>
                  {set && value !== SENTINEL && value.trim() === "" && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Saving an empty value will remove this key from{" "}
                      <code className="rounded bg-foreground/[0.06] px-1">
                        .env.local
                      </code>
                      .
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            {IS_HOSTED_CLIENT && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void logout()}
                className="mr-auto text-muted-foreground"
              >
                <LogOut className="size-3.5" />
                Log out
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!dirty || saving || IS_HOSTED_CLIENT}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
