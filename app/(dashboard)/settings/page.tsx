"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheckIcon, ShieldOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EnrollMfaModal } from "@/components/EnrollMfaModal";

type Factor = { id: string; friendlyName: string | null; status: string };

export default function SettingsPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Factor | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/auth/mfa/factors");
    const body = await res.json().catch(() => ({}));
    setFactors(body.factors ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const verifiedFactor = factors.find((f) => f.status === "verified");

  async function handleRemove() {
    if (!removeTarget) return;
    const res = await fetch("/api/auth/mfa/unenroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factorId: removeTarget.id }),
    });
    setRemoveTarget(null);
    if (!res.ok) {
      toast.error("Failed to remove two-factor authentication");
      return;
    }
    toast.success("Two-factor authentication removed");
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account security.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Two-factor authentication</CardTitle>
          <CardDescription>
            Require a verification code from an authenticator app when signing in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-9 w-48" />
          ) : verifiedFactor ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-emerald-600/20 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                >
                  <ShieldCheckIcon className="size-3.5" />
                  Enabled
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {verifiedFactor.friendlyName ?? "Authenticator app"}
                </span>
              </div>
              <Button variant="outline" onClick={() => setRemoveTarget(verifiedFactor)}>
                <ShieldOffIcon className="size-4" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                Not enabled
              </Badge>
              <Button onClick={() => setEnrollOpen(true)}>
                <ShieldCheckIcon className="size-4" />
                Set up two-factor authentication
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <EnrollMfaModal open={enrollOpen} onClose={() => setEnrollOpen(false)} onEnrolled={load} />

      <AlertDialog open={!!removeTarget} onOpenChange={(next) => !next && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove two-factor authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll no longer be asked for a verification code when signing in. You can set it up
              again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
