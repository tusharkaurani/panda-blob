"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { JsonEditor } from "@/components/JsonEditor";

type BlobDetail = {
  id: string;
  owner_id: string;
  owner_name: string | null;
  data: unknown;
  created_at: string;
  updated_at: string;
};

export default function BlobEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [blob, setBlob] = useState<BlobDetail | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/blobs/${id}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const body: BlobDetail = await res.json();
    setBlob(body);
    setText(JSON.stringify(body.data, null, 2));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  let parsedOk = true;
  try {
    JSON.parse(text);
  } catch {
    parsedOk = false;
  }

  async function handleSave() {
    setError(null);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      setError("Invalid JSON");
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/admin/blobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save");
      return;
    }

    load();
  }

  async function handleDelete() {
    if (!confirm("Delete this blob? This cannot be undone.")) return;
    await fetch(`/api/admin/blobs/${id}`, { method: "DELETE" });
    router.push("/blobs");
  }

  if (notFound) {
    return <p className="text-sm text-gray-500">Blob not found.</p>;
  }

  if (!blob) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/blobs" className="text-sm text-gray-500 hover:underline">
          ← Blobs
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-base font-semibold">{blob.id}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Owner:{" "}
            <Link href={`/users/${blob.owner_id}`} className="hover:underline">
              {blob.owner_name ?? blob.owner_id}
            </Link>{" "}
            · Updated {new Date(blob.updated_at).toLocaleString()}
          </p>
        </div>
        <Button variant="danger" onClick={handleDelete}>
          Delete
        </Button>
      </div>

      <JsonEditor value={text} onChange={setText} height="500px" />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={load}>
          Revert
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving || !parsedOk}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
