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

export function RenameAppModal({
  open,
  onClose,
  appId,
  currentName,
  onRenamed,
}: {
  open: boolean;
  onClose: () => void;
  appId: string;
  currentName: string;
  onRenamed: () => void | Promise<void>;
}) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
    }
  }, [open, currentName]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (name.trim() === currentName) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/apps/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      setLoading(false);
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to rename app");
      return;
    }

    await onRenamed();
    setLoading(false);
    onClose();
    toast.success("App renamed");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename app</DialogTitle>
            <DialogDescription>Update this app&apos;s display name.</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-2">
            <Label htmlFor="rename-app-name">Name</Label>
            <Input
              id="rename-app-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2Icon className="size-4 animate-spin" />}
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
