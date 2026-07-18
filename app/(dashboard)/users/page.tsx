"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, MoreHorizontalIcon, PlusIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { CreateUserModal } from "@/components/CreateUserModal";
import { RenameUserModal } from "@/components/RenameUserModal";

type ApiUserRow = {
  id: string;
  name: string;
  access_key: string;
  is_active: boolean;
  created_at: string;
  blob_count: number;
};

export default function UsersPage() {
  const [items, setItems] = useState<ApiUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiUserRow | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<ApiUserRow | null>(null);
  const [renameTarget, setRenameTarget] = useState<ApiUserRow | null>(null);
  const limit = 10;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/users?${params}`);
    const body = await res.json();
    setItems(body.items ?? []);
    setTotal(body.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggleActive(user: ApiUserRow) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    toast.success(user.is_active ? `Disabled "${user.name}"` : `Enabled "${user.name}"`);
    load();
  }

  async function handleRegenerate() {
    if (!regenerateTarget) return;
    await fetch(`/api/admin/users/${regenerateTarget.id}/regenerate-key`, { method: "POST" });
    toast.success(`Regenerated access key for "${regenerateTarget.name}"`);
    setRegenerateTarget(null);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
    toast.success(`Deleted "${deleteTarget.name}"`);
    setDeleteTarget(null);
    load();
  }

  function handleCopy(user: ApiUserRow) {
    navigator.clipboard.writeText(user.access_key);
    setCopiedId(user.id);
    setTimeout(() => setCopiedId((id) => (id === user.id ? null : id)), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">API consumer accounts and their access keys.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          Create user
        </Button>
      </div>

      <div className="relative max-w-xs">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="pl-8"
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Access key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Blobs</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No users yet.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <Link href={`/users/${user.id}`} className="hover:underline">
                      {user.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleCopy(user)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs transition-colors hover:bg-muted/70"
                      title="Copy access key"
                    >
                      {copiedId === user.id ? (
                        <>
                          <CheckIcon className="size-3" /> Copied
                        </>
                      ) : (
                        <>
                          <CopyIcon className="size-3" /> {user.access_key}
                        </>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={user.is_active} />
                  </TableCell>
                  <TableCell className="tabular-nums">{user.blob_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="Actions" />
                        }
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setRenameTarget(user)}>
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                          {user.is_active ? "Disable" : "Enable"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRegenerateTarget(user)}>
                          Regenerate key
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(user)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />

      <RenameUserModal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        userId={renameTarget?.id ?? ""}
        currentName={renameTarget?.name ?? ""}
        onRenamed={load}
      />

      <AlertDialog
        open={regenerateTarget !== null}
        onOpenChange={(next) => !next && setRegenerateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate access key?</AlertDialogTitle>
            <AlertDialogDescription>
              The old key for &quot;{regenerateTarget?.name}&quot; will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate}>Regenerate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes &quot;{deleteTarget?.name}&quot; and all {deleteTarget?.blob_count}{" "}
              of its blobs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
