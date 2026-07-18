"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

export function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create user");
      return;
    }

    setName("");
    onCreated();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Create user">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="user-name">
            Name
          </label>
          <input
            id="user-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. project-foo"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
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
