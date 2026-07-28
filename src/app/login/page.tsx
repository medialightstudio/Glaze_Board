// Sign-in page — email + password; office → /m, field → /f.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: err } = await authClient.signIn.email({ email, password });
    if (err) {
      setBusy(false);
      setError("Wrong email or password.");
      return;
    }
    const { data } = await authClient.getSession();
    const role = (data?.user as { role?: string } | undefined)?.role;
    const dest =
      role === "admin" || role === "manager" ? "/m" : "/f";
    setBusy(false);
    router.replace(dest);
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-stone-100">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Glaze Board</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to continue.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
