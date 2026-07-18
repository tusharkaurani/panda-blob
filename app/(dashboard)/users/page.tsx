"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { CreateUserModal } from "@/components/CreateUserModal";

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
    load();
  }

  async function handleRegenerate(user: ApiUserRow) {
    if (
      !confirm(
        `Regenerate the access key for "${user.name}"? The old key will stop working immediately.`
      )
    )
      return;
    await fetch(`/api/admin/users/${user.id}/regenerate-key`, { method: "POST" });
    load();
  }

  async function handleDelete(user: ApiUserRow) {
    if (
      !confirm(
        `Delete "${user.name}" and all ${user.blob_count} of its blobs? This cannot be undone.`
      )
    )
      return;
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
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
        <h1 className="text-lg font-semibold">Users</h1>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          Create user
        </Button>
      </div>

      <input
        placeholder="Search by name..."
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
        className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Access key</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Blobs</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No users yet.
                </td>
              </tr>
            )}
            {items.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-2 font-medium">
                  <Link href={`/users/${user.id}`} className="hover:underline">
                    {user.name}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleCopy(user)}
                    className="rounded bg-gray-100 px-2 py-1 font-mono text-xs hover:bg-gray-200"
                    title="Copy access key"
                  >
                    {copiedId === user.id ? "Copied!" : user.access_key}
                  </button>
                </td>
                <td className="px-4 py-2">
                  <Badge active={user.is_active} />
                </td>
                <td className="px-4 py-2">{user.blob_count}</td>
                <td className="px-4 py-2 text-gray-500">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => handleToggleActive(user)}>
                      {user.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="ghost" onClick={() => handleRegenerate(user)}>
                      Regenerate key
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(user)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}
