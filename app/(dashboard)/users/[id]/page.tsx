"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { CreateBlobModal } from "@/components/CreateBlobModal";

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
  const [createOpen, setCreateOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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
    const params = new URLSearchParams({
      owner_id: id,
      page: String(page),
      limit: String(limit),
    });
    const res = await fetch(`/api/admin/blobs?${params}`);
    const body = await res.json();
    setBlobs(body.items ?? []);
    setTotal(body.total ?? 0);
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
    loadUser();
  }

  async function handleRegenerate() {
    if (!user) return;
    if (
      !confirm("Regenerate this user's access key? The old key will stop working immediately.")
    )
      return;
    await fetch(`/api/admin/users/${user.id}/regenerate-key`, { method: "POST" });
    loadUser();
  }

  async function handleDeleteUser() {
    if (!user) return;
    if (
      !confirm(
        `Delete "${user.name}" and all ${user.blob_count} of its blobs? This cannot be undone.`
      )
    )
      return;
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    router.push("/users");
  }

  async function handleDeleteBlob(blobId: string) {
    if (!confirm("Delete this blob? This cannot be undone.")) return;
    await fetch(`/api/admin/blobs/${blobId}`, { method: "DELETE" });
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
    return <p className="text-sm text-gray-500">User not found.</p>;
  }

  if (!user) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/users" className="text-sm text-gray-500 hover:underline">
          ← Users
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{user.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Created {new Date(user.created_at).toLocaleString()} · {user.blob_count} blob
              {user.blob_count === 1 ? "" : "s"}
            </p>
          </div>
          <Badge active={user.is_active} />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Access key:</span>
          <button
            onClick={handleCopy}
            className="rounded bg-gray-100 px-2 py-1 font-mono text-xs hover:bg-gray-200"
          >
            {copied ? "Copied!" : user.access_key}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleToggleActive}>
            {user.is_active ? "Disable" : "Enable"}
          </Button>
          <Button variant="secondary" onClick={handleRegenerate}>
            Regenerate key
          </Button>
          <Button variant="danger" onClick={handleDeleteUser}>
            Delete user
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Blobs</h2>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            Create blob
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Blob ID</th>
                <th className="px-4 py-2">Preview</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {blobs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    No blobs yet.
                  </td>
                </tr>
              )}
              {blobs.map((blob) => (
                <tr key={blob.id}>
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/blobs/${blob.id}`} className="hover:underline">
                      {blob.id}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 font-mono text-xs text-gray-500">
                    {JSON.stringify(blob.data)}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(blob.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="danger" onClick={() => handleDeleteBlob(blob.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  );
}
