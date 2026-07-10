import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, sanitizeNext, verifySessionToken } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in · Minitor",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const password = process.env.MINITOR_PASSWORD;
  const next = sanitizeNext((await searchParams)?.next);

  // No gate configured → nothing to log into; send them to the app.
  if (!password) redirect(next);

  // Already logged in → skip the form.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, password)) redirect(next);

  return <LoginForm next={next} />;
}
