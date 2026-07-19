"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/Logo";

type Factor = { id: string; friendlyName: string | null; status: string };

export default function MfaChallengePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [factor, setFactor] = useState<Factor | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/mfa/factors");
      if (!res.ok) {
        if (!cancelled) setFactor(null);
        return;
      }
      const body = await res.json();
      const verified = (body.factors ?? []).find((f: Factor) => f.status === "verified");
      if (!cancelled) setFactor(verified ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!factor) return;
    setLoading(true);
    setError(null);

    const challengeRes = await fetch("/api/auth/mfa/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factorId: factor.id }),
    });

    if (!challengeRes.ok) {
      setLoading(false);
      const body = await challengeRes.json().catch(() => ({}));
      setError(body.error ?? "Failed to start verification");
      return;
    }

    const { challengeId } = await challengeRes.json();

    const verifyRes = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factorId: factor.id, challengeId, code }),
    });

    setLoading(false);

    if (!verifyRes.ok) {
      const body = await verifyRes.json().catch(() => ({}));
      setError(body.error ?? "Invalid code");
      return;
    }

    router.push("/apps");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <form onSubmit={handleSubmit}>
          <CardHeader className="items-center gap-4 text-center">
            <Logo size="lg" />
            <div className="space-y-1.5">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Two-factor verification
              </CardTitle>
              <CardDescription className="text-sm">
                Enter the 6-digit code from your authenticator app.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                suppressHydrationWarning
              />
            </div>

            {factor === null && (
              <p className="text-sm text-destructive">
                No two-factor method is set up on this account. Contact an administrator.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="mt-4">
            <Button type="submit" disabled={loading || !factor || code.length < 6} className="w-full">
              {loading && <Loader2Icon className="size-4 animate-spin" />}
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
