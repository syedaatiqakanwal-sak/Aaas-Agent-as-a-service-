import { KeyRound } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiErrorMessage, clearApiKey, getAgents, saveApiKey } from "@/lib/api";

export function ApiKeyScreen({ onSaved }: { onSaved: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = key.trim();
    if (!next) {
      setError("Enter the API key from your .env file.");
      return;
    }
    setPending(true);
    setError("");
    saveApiKey(next);
    try {
      await getAgents();
      onSaved(next);
    } catch (caught) {
      clearApiKey();
      setError(apiErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Agent as a Service</h1>
            <p className="text-sm text-muted-foreground">Connect with your API key</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="api-key">X-API-Key</Label>
          <Input
            id="api-key"
            type="password"
            autoComplete="off"
            placeholder="Paste the key from API_KEYS"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Use the value before the colon in API_KEYS. It stays in this browser only.
          </p>
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <Button className="mt-5 w-full" type="submit" disabled={pending}>
          {pending ? "Checking key..." : "Continue"}
        </Button>
      </form>
    </main>
  );
}
