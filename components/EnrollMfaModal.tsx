"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EnrollMfaModal({
  open,
  onClose,
  onEnrolled,
}: {
  open: boolean;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!open) {
      setFactorId(null);
      setQrCode(null);
      setSecret(null);
      setCode("");
      setError(null);
      return;
    }

    setStarting(true);
    setError(null);
    fetch("/api/auth/mfa/enroll", { method: "POST" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error ?? "Failed to start enrollment");
          return;
        }
        setFactorId(body.factorId);
        setQrCode(body.qrCode);
        setSecret(body.secret);
      })
      .finally(() => setStarting(false));
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setVerifying(true);
    setError(null);

    const challengeRes = await fetch("/api/auth/mfa/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factorId }),
    });

    if (!challengeRes.ok) {
      setVerifying(false);
      const body = await challengeRes.json().catch(() => ({}));
      setError(body.error ?? "Failed to verify code");
      return;
    }

    const { challengeId } = await challengeRes.json();

    const verifyRes = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factorId, challengeId, code }),
    });

    setVerifying(false);

    if (!verifyRes.ok) {
      const body = await verifyRes.json().catch(() => ({}));
      setError(body.error ?? "Invalid code");
      return;
    }

    onEnrolled();
    onClose();
    toast.success("Two-factor authentication enabled");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with an authenticator app, then enter the 6-digit code to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {starting && (
              <div className="flex items-center justify-center py-8">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {qrCode && (
              <div className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="Scan this QR code with your authenticator app"
                  className="size-40 rounded-md border border-border bg-white p-2"
                />
                {secret && (
                  <p className="text-center font-mono text-xs break-all text-muted-foreground">
                    {secret}
                  </p>
                )}
              </div>
            )}

            {factorId && (
              <div className="space-y-1.5">
                <Label htmlFor="mfa-code">Verification code</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={verifying || !factorId || code.length < 6}>
              {verifying && <Loader2Icon className="size-4 animate-spin" />}
              {verifying ? "Verifying..." : "Enable"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
