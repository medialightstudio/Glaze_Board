// Public service form — no login.

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PublicServiceFormPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [issue, setIssue] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/service/${slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, address, issue, name, email }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not send.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold">Got it</h1>
          <p className="text-stone-600">We&apos;ll call you back today.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
      <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-xl border bg-white p-5">
        <h1 className="text-xl font-semibold">Service request</h1>
        <p className="text-sm text-stone-600">Tell us what&apos;s going on — we&apos;ll call you back.</p>
        <Input
          placeholder="Phone *"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          inputMode="tel"
        />
        <Input
          placeholder="Address *"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <Input
          placeholder="What's wrong *"
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          required
        />
        <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          type="email"
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={busy} className="w-full">
          Submit
        </Button>
      </form>
    </div>
  );
}
