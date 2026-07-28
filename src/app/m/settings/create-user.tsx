"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateUserForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("field");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      name?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create user.");
      return;
    }
    setOk(`Created ${data.name}.`);
    setName("");
    setEmail("");
    setPassword("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded border p-3">
      <p className="text-sm font-medium">Create user</p>
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Temporary password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <select
        className="w-full rounded-lg border px-2 py-1.5 text-sm"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="field">Field</option>
        <option value="manager">Manager</option>
        <option value="admin">Admin</option>
      </select>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="text-sm text-green-700">{ok}</p> : null}
      <Button type="submit" disabled={busy} size="sm">
        Create
      </Button>
    </form>
  );
}
