"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSessionToken,
  sanitizeNext,
} from "@/lib/auth/session";

export interface LoginState {
  error: string | null;
}

// Constant-time compare of the submitted password against `MINITOR_PASSWORD`.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = process.env.MINITOR_PASSWORD;
  if (!password) {
    // No gate configured — nothing to log into.
    return { error: "This instance has no password configured." };
  }

  const provided = String(formData.get("password") ?? "");
  const next = sanitizeNext(String(formData.get("next") ?? "/"));

  if (!safeEqual(provided, password)) {
    return { error: "Incorrect password." };
  }

  const token = await createSessionToken(password);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  // Throws NEXT_REDIRECT — navigates the client on success.
  redirect(next);
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
