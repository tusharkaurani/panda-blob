"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { JsonEditor } from "./JsonEditor";

export function CreateBlobModal({
  open,
  onClose,
  ownerId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  onCreated: () => void;
}) {
  const [text, setText] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

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
      body: JSON.stringify({ owner_id: ownerId, data }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create blob");
      return;
    }

    setText("{}");
    onCreated();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Create blob">
      <form onSubmit={handleSubmit} className="space-y-3">
        <JsonEditor value={text} onChange={setText} height="240px" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
