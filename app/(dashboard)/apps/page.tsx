"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckIcon,
  CopyIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
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
import { CreateAppModal } from "@/components/CreateAppModal";
import { RenameAppModal } from "@/components/RenameAppModal";

type AppRow = {
  id: string;
  name: string;
  access_key: string;
  is_active: boolean;
  created_at: string;
  blob_count: number;
};

export default function AppsPage() {
  const [items, setItems] = useState<AppRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppRow | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<AppRow | null>(null);
  const [renameTarget, setRenameTarget] = useState<AppRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const hasLoaded = useRef(false);
  const limit = 10;

  const load = useCallback(async () => {
    if (hasLoaded.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/apps?${params}`);
    const body = await res.json();
    setItems(body.items ?? []);
    setTotal(body.total ?? 0);
    hasLoaded.current = true;
    setLoading(false);
    setRefreshing(false);
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggleActive(app: AppRow) {
    setTogglingId(app.id);
    await fetch(`/api/admin/apps/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !app.is_active }),
    });
    toast.success(app.is_active ? `Disabled "${app.name}"` : `Enabled "${app.name}"`);
    await load();
    setTogglingId(null);
  }

  async function handleRegenerate() {
    if (!regenerateTarget) return;
    setRegenerating(true);
    await fetch(`/api/admin/apps/${regenerateTarget.id}/regenerate-key`, { method: "POST" });
    toast.success(`Regenerated access key for "${regenerateTarget.name}"`);
    await load();
    setRegenerating(false);
    setRegenerateTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/admin/apps/${deleteTarget.id}`, { method: "DELETE" });
    toast.success(`Deleted "${deleteTarget.name}"`);
    await load();
    setDeleting(false);
    setDeleteTarget(null);
  }

  function handleCopy(app: AppRow) {
    navigator.clipboard.writeText(app.access_key);
    setCopiedId(app.id);
    setTimeout(() => setCopiedId((id) => (id === app.id ? null : id)), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Apps</h1>
          <p className="text-sm text-muted-foreground">Apps and their access keys.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          Create app
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
          <TableBody className={refreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>
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
                  No apps yet.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              items.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">
                    <Link href={`/apps/${app.id}`} className="hover:underline">
                      {app.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleCopy(app)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs transition-colors hover:bg-muted/70"
                      title="Copy access key"
                    >
                      {copiedId === app.id ? (
                        <>
                          <CheckIcon className="size-3" /> Copied
                        </>
                      ) : (
                        <>
                          <CopyIcon className="size-3" /> {app.access_key}
                        </>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={app.is_active} />
                  </TableCell>
                  <TableCell className="tabular-nums">{app.blob_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(app.created_at).toLocaleDateString()}
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
                        <DropdownMenuItem onClick={() => setRenameTarget(app)}>
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(app)}
                          disabled={togglingId === app.id}
                        >
                          {togglingId === app.id && (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          )}
                          {app.is_active ? "Disable" : "Enable"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRegenerateTarget(app)}>
                          Regenerate key
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(app)}
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

      <CreateAppModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />

      <RenameAppModal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        appId={renameTarget?.id ?? ""}
        currentName={renameTarget?.name ?? ""}
        onRenamed={load}
      />

      <AlertDialog
        open={regenerateTarget !== null}
        onOpenChange={(next) => !next && !regenerating && setRegenerateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate access key?</AlertDialogTitle>
            <AlertDialogDescription>
              The old key for &quot;{regenerateTarget?.name}&quot; will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate} disabled={regenerating}>
              {regenerating && <Loader2Icon className="size-4 animate-spin" />}
              {regenerating ? "Regenerating..." : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => !next && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this app?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes &quot;{deleteTarget?.name}&quot; and all {deleteTarget?.blob_count}{" "}
              of its blobs. This cannot be undone.
            </AlertDialogDescription>
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
