"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeftIcon, CheckIcon, CopyIcon, LinkIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { JsonEditor } from "@/components/JsonEditor";

type BlobDetail = {
  id: string;
  app_id: string;
  app_name: string | null;
  app_access_key: string | null;
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

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

    toast.success("Blob saved");
    load();
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/admin/blobs/${id}`, { method: "DELETE" });
    toast.success("Blob deleted");
    router.push("/blobs");
  }

  function handleCopyId() {
    if (!blob) return;
    navigator.clipboard.writeText(blob.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  }

  function handleCopyFetchUrl() {
    if (!blob || !blob.app_access_key) return;
    const url = `${window.location.origin}/api/blob/${blob.id}?apiKey=${blob.app_access_key}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.success("Fetch URL copied");
    setTimeout(() => setCopiedUrl(false), 1500);
  }

  if (notFound) {
    return <p className="text-sm text-muted-foreground">Blob not found.</p>;
  }

  if (!blob) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px] w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/blobs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" />
          Blobs
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-1">
            <h1 className="font-mono text-base font-semibold tracking-tight break-all">{blob.id}</h1>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy blob ID"
              title="Copy blob ID"
              onClick={handleCopyId}
            >
              {copiedId ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy fetch URL"
              title="Copy fetch URL (GET, with this app's API key)"
              onClick={handleCopyFetchUrl}
              disabled={!blob.app_access_key}
            >
              {copiedUrl ? <CheckIcon className="size-3.5" /> : <LinkIcon className="size-3.5" />}
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            App:{" "}
            <Link href={`/apps/${blob.app_id}`} className="hover:underline">
              {blob.app_name ?? blob.app_id}
            </Link>{" "}
            · Updated {new Date(blob.updated_at).toLocaleString()}
          </p>
        </div>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          Delete
        </Button>
      </div>

      <JsonEditor value={text} onChange={setText} height="500px" />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={load}>
          Revert
        </Button>
        <Button onClick={handleSave} disabled={saving || !parsedOk}>
          {saving && <Loader2Icon className="size-4 animate-spin" />}
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(next) => !next && !deleting && setDeleteOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this blob?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && <Loader2Icon className="size-4 animate-spin" />}
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
