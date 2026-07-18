import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4 text-sm font-medium">
            <span className="font-semibold text-gray-900">pandablob</span>
            <Link href="/users" className="text-gray-600 hover:text-gray-900">
              Users
            </Link>
            <Link href="/blobs" className="text-gray-600 hover:text-gray-900">
              Blobs
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            {user?.email && <span>{user.email}</span>}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
