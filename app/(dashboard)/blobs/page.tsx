"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PlusIcon, SearchIcon } from "lucide-react";
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
import { Pagination } from "@/components/ui/Pagination";
import { CreateBlobModal } from "@/components/CreateBlobModal";
import { BlobIdCell } from "@/components/BlobIdCell";

type BlobRow = {
  id: string;
  app_id: string;
  app_name: string | null;
  app_access_key: string | null;
  data: unknown;
  updated_at: string;
};

export default function BlobsPage() {
  const [items, setItems] = useState<BlobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const limit = 10;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/blobs?${params}`);
    const body = await res.json();
    setItems(body.items ?? []);
    setTotal(body.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Blobs</h1>
          <p className="text-sm text-muted-foreground">{total} total across all apps.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          Create blob
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by blob ID or app name..."
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
              <TableHead>Blob ID</TableHead>
              <TableHead>App</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No blobs found.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              items.map((blob) => (
                <TableRow key={blob.id}>
                  <TableCell>
                    <BlobIdCell id={blob.id} ownerAccessKey={blob.app_access_key} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/apps/${blob.app_id}`} className="hover:underline">
                      {blob.app_name ?? blob.app_id}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                    {JSON.stringify(blob.data)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(blob.updated_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />

      <CreateBlobModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setPage(1);
          load();
        }}
      />
    </div>
  );
}
