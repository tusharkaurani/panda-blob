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
import { RenameUserModal } from "@/components/RenameUserModal";
import { BlobIdCell } from "@/components/BlobIdCell";

type UserDetail = {
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

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [blobs, setBlobs] = useState<BlobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [blobsLoading, setBlobsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [deleteBlobId, setDeleteBlobId] = useState<string | null>(null);
  const limit = 10;

  const loadUser = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${id}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    setUser(await res.json());
  }, [id]);

  const loadBlobs = useCallback(async () => {
    setBlobsLoading(true);
    const params = new URLSearchParams({
      owner_id: id,
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
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    loadBlobs();
  }, [loadBlobs]);

  async function handleToggleActive() {
    if (!user) return;
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    toast.success(user.is_active ? "User disabled" : "User enabled");
    loadUser();
  }

  async function handleRegenerate() {
    if (!user) return;
    await fetch(`/api/admin/users/${user.id}/regenerate-key`, { method: "POST" });
    toast.success("Access key regenerated");
    setRegenerateOpen(false);
    loadUser();
  }

  async function handleDeleteUser() {
    if (!user) return;
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    toast.success(`Deleted "${user.name}"`);
    router.push("/users");
  }

  async function handleDeleteBlob() {
    if (!deleteBlobId) return;
    await fetch(`/api/admin/blobs/${deleteBlobId}`, { method: "DELETE" });
    toast.success("Blob deleted");
    setDeleteBlobId(null);
    loadBlobs();
    loadUser();
  }

  function handleCopy() {
    if (!user) return;
    navigator.clipboard.writeText(user.access_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (notFound) {
    return <p className="text-sm text-muted-foreground">User not found.</p>;
  }

  if (!user) {
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
          href="/users"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" />
          Users
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-semibold tracking-tight">{user.name}</h1>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Rename user"
                title="Rename user"
                onClick={() => setRenameOpen(true)}
              >
                <PencilIcon className="size-3.5" />
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Created {new Date(user.created_at).toLocaleString()} · {user.blob_count} blob
              {user.blob_count === 1 ? "" : "s"}
            </p>
          </div>
          <StatusBadge active={user.is_active} />
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
                <CopyIcon className="size-3" /> {user.access_key}
              </>
            )}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleToggleActive}>
            {user.is_active ? "Disable" : "Enable"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRegenerateOpen(true)}>
            Regenerate key
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteUserOpen(true)}>
            Delete user
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
                      <BlobIdCell id={blob.id} ownerAccessKey={user.access_key} />
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
        ownerId={user.id}
        onCreated={() => {
          loadBlobs();
          loadUser();
        }}
      />

      <RenameUserModal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        userId={user.id}
        currentName={user.name}
        onRenamed={loadUser}
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

      <AlertDialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes &quot;{user.name}&quot; and all {user.blob_count} of its blobs. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
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
