"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Pagination } from "@/components/ui/Pagination";

type BlobRow = {
  id: string;
  owner_id: string;
  owner_name: string | null;
  data: unknown;
  updated_at: string;
};

export default function BlobsPage() {
  const [items, setItems] = useState<BlobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
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
        <h1 className="text-lg font-semibold">Blobs</h1>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>

      <input
        placeholder="Search by blob ID or owner name..."
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
        className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Blob ID</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2">Preview</th>
              <th className="px-4 py-2">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  No blobs found.
                </td>
              </tr>
            )}
            {items.map((blob) => (
              <tr key={blob.id}>
                <td className="px-4 py-2 font-mono text-xs">
                  <Link href={`/blobs/${blob.id}`} className="hover:underline">
                    {blob.id}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/users/${blob.owner_id}`} className="hover:underline">
                    {blob.owner_name ?? blob.owner_id}
                  </Link>
                </td>
                <td className="max-w-xs truncate px-4 py-2 font-mono text-xs text-gray-500">
                  {JSON.stringify(blob.data)}
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {new Date(blob.updated_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
    </div>
  );
}
