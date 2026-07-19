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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JsonEditor } from "./JsonEditor";

type OwnerOption = { id: string; name: string };

export function CreateBlobModal({
  open,
  onClose,
  ownerId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Fixed owner. When omitted, the modal shows a picker to choose one. */
  ownerId?: string;
  onCreated: () => void | Promise<void>;
}) {
  const [text, setText] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Owner picker state — only used when no fixed ownerId was provided.
  const pickOwner = ownerId === undefined;
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [selectedOwner, setSelectedOwner] = useState("");

  useEffect(() => {
    if (!open || !pickOwner) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/apps?page=1&limit=1000");
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;
      const items: OwnerOption[] = (body.items ?? []).map((u: OwnerOption) => ({
        id: u.id,
        name: u.name,
      }));
      setOwners(items);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pickOwner]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const effectiveOwner = pickOwner ? selectedOwner : ownerId;
    if (!effectiveOwner) {
      setError("Select an app");
      return;
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      setError("Invalid JSON");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/admin/blobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: effectiveOwner, data }),
    });

    if (!res.ok) {
      setLoading(false);
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create blob");
      return;
    }

    await onCreated();
    setLoading(false);
    setText("{}");
    setSelectedOwner("");
    onClose();
    toast.success("Blob created");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-3">
          <DialogHeader>
            <DialogTitle>Create blob</DialogTitle>
            <DialogDescription>Store a new JSON document.</DialogDescription>
          </DialogHeader>

          {pickOwner && (
            <div className="space-y-1.5">
              <Label htmlFor="blob-owner">App</Label>
              <Select value={selectedOwner} onValueChange={(v) => setSelectedOwner(v ?? "")}>
                <SelectTrigger id="blob-owner" className="w-full">
                  <SelectValue placeholder="Select an app…" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <JsonEditor value={text} onChange={setText} height="240px" />
          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2Icon className="size-4 animate-spin" />}
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
