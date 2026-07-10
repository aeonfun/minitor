"use client";

import { useActionState } from "react";
import Image from "next/image";
import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login, type LoginState } from "@/app/login/actions";

const INITIAL: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, INITIAL);

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo.png"
            alt="Minitor"
            width={48}
            height={48}
            priority
            className="rounded-xl"
          />
          <div className="space-y-1">
            <h1 className="font-serif text-2xl">Minitor</h1>
            <p className="text-[13px] text-muted-foreground">
              This instance is password-protected. Enter the password to
              continue.
            </p>
          </div>
        </div>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />

          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              name="password"
              autoFocus
              autoComplete="current-password"
              required
              placeholder="Password"
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "login-error" : undefined}
              className="h-10 pl-9"
            />
          </div>

          {state.error && (
            <p
              id="login-error"
              role="alert"
              className="text-[12.5px] text-destructive"
            >
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="h-10 w-full"
          >
            {pending ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
