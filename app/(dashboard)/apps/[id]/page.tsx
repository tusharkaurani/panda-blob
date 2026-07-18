"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeftIcon, CheckIcon, CopyIcon, PencilIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { CreateBlobModal } from "@/components/CreateBlobModal";
import { RenameAppModal } from "@/components/RenameAppModal";
import { BlobIdCell } from "@/components/BlobIdCell";

type AppDetail = {
  id: string;
  name: string;
  access_key: string;
  is_active: boolean;
  created_at: string;
  blob_count: number;
};

type BlobRow = {
  id: string;
  data: unknown;
  updated_at: string;
};

export default function AppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<AppDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [blobs, setBlobs] = useState<BlobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [blobsLoading, setBlobsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteAppOpen, setDeleteAppOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [deleteBlobId, setDeleteBlobId] = useState<string | null>(null);
  const limit = 10;

  const loadApp = useCallback(async () => {
    const res = await fetch(`/api/admin/apps/${id}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    setApp(await res.json());
  }, [id]);

  const loadBlobs = useCallback(async () => {
    setBlobsLoading(true);
    const params = new URLSearchParams({
      app_id: id,
      page: String(page),
      limit: String(limit),
    });
    const res = await fetch(`/api/admin/blobs?${params}`);
    const body = await res.json();
    setBlobs(body.items ?? []);
    setTotal(body.total ?? 0);
    setBlobsLoading(false);
  }, [id, page]);

  useEffect(() => {
    loadApp();
  }, [loadApp]);

  useEffect(() => {
    loadBlobs();
  }, [loadBlobs]);

  async function handleToggleActive() {
    if (!app) return;
    await fetch(`/api/admin/apps/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !app.is_active }),
    });
    toast.success(app.is_active ? "App disabled" : "App enabled");
    loadApp();
  }

  async function handleRegenerate() {
    if (!app) return;
    await fetch(`/api/admin/apps/${app.id}/regenerate-key`, { method: "POST" });
    toast.success("Access key regenerated");
    setRegenerateOpen(false);
    loadApp();
  }

  async function handleDeleteApp() {
    if (!app) return;
    await fetch(`/api/admin/apps/${app.id}`, { method: "DELETE" });
    toast.success(`Deleted "${app.name}"`);
    router.push("/apps");
  }

  async function handleDeleteBlob() {
    if (!deleteBlobId) return;
    await fetch(`/api/admin/blobs/${deleteBlobId}`, { method: "DELETE" });
    toast.success("Blob deleted");
    setDeleteBlobId(null);
    loadBlobs();
    loadApp();
  }

  function handleCopy() {
    if (!app) return;
    navigator.clipboard.writeText(app.access_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (notFound) {
    return <p className="text-sm text-muted-foreground">App not found.</p>;
  }

  if (!app) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/apps"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" />
          Apps
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-semibold tracking-tight">{app.name}</h1>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Rename app"
                title="Rename app"
                onClick={() => setRenameOpen(true)}
              >
                <PencilIcon className="size-3.5" />
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Created {new Date(app.created_at).toLocaleString()} · {app.blob_count} blob
              {app.blob_count === 1 ? "" : "s"}
            </p>
          </div>
          <StatusBadge active={app.is_active} />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Access key:</span>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs transition-colors hover:bg-muted/70"
          >
            {copied ? (
              <>
                <CheckIcon className="size-3" /> Copied
              </>
            ) : (
              <>
                <CopyIcon className="size-3" /> {app.access_key}
              </>
            )}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleToggleActive}>
            {app.is_active ? "Disable" : "Enable"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRegenerateOpen(true)}>
            Regenerate key
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteAppOpen(true)}>
            Delete app
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Blobs</h2>
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            Create blob
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Blob ID</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blobsLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-32" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!blobsLoading && blobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No blobs yet.
                  </TableCell>
                </TableRow>
              )}
              {!blobsLoading &&
                blobs.map((blob) => (
                  <TableRow key={blob.id}>
                    <TableCell>
                      <BlobIdCell id={blob.id} ownerAccessKey={app.access_key} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                      {JSON.stringify(blob.data)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(blob.updated_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteBlobId(blob.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      <CreateBlobModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        ownerId={app.id}
        onCreated={() => {
          loadBlobs();
          loadApp();
        }}
      />

      <RenameAppModal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        appId={app.id}
        currentName={app.name}
        onRenamed={loadApp}
      />

      <AlertDialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate access key?</AlertDialogTitle>
            <AlertDialogDescription>
              The old key will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate}>Regenerate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteAppOpen} onOpenChange={setDeleteAppOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this app?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes &quot;{app.name}&quot; and all {app.blob_count} of its blobs. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteApp}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteBlobId !== null} onOpenChange={(next) => !next && setDeleteBlobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this blob?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBlob}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
