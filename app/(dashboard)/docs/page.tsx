"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CodeBlock } from "@/components/CodeBlock";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PLACEHOLDER_ORIGIN = "https://your-deployment.vercel.app";

const METHOD_STYLES: Record<string, string> = {
  POST: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  GET: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  PUT: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  DELETE: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-16 shrink-0 items-center justify-center rounded-md px-2 py-1 font-mono text-xs font-semibold",
        METHOD_STYLES[method]
      )}
    >
      {method}
    </span>
  );
}

const ENDPOINTS = [
  {
    method: "POST",
    path: "/api/blob",
    description:
      "Create a blob. Body is any JSON. Returns 201, a Location header, and the created JSON.",
  },
  {
    method: "GET",
    path: "/api/blob/{id}",
    description: "Fetch a blob's raw JSON.",
  },
  {
    method: "PUT",
    path: "/api/blob/{id}",
    description: "Full replace of a blob's JSON.",
  },
  {
    method: "DELETE",
    path: "/api/blob/{id}",
    description: "Delete a blob.",
  },
];

export default function ApiDocsPage() {
  const [origin, setOrigin] = useState(PLACEHOLDER_ORIGIN);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">API Docs</h1>
        <p className="text-sm text-muted-foreground">
          The public blob storage API — for use from your own projects, not the dashboard.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">Authentication</h2>
        <p className="text-sm text-muted-foreground">
          Every request must carry an App&apos;s access key as an{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">apiKey</code> query
          parameter. Get a key from the{" "}
          <a href="/apps" className="underline hover:text-foreground">
            Apps
          </a>{" "}
          page. A blob can only be read or written with its own app&apos;s key — no key, wrong
          key, or a disabled app&apos;s key is rejected.
        </p>
        <div className="space-y-1">
          <p className="text-sm font-medium">Base URL</p>
          <CodeBlock code={origin} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold tracking-tight">Endpoints</h2>
        {ENDPOINTS.map((ep) => (
          <div key={`${ep.method}-${ep.path}`} className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <MethodBadge method={ep.method} />
              <code className="font-mono text-sm">{ep.path}</code>
            </div>
            <p className="text-sm text-muted-foreground">{ep.description}</p>
            <CodeBlock
              code={`curl -X ${ep.method} "${origin}${ep.path}?apiKey=<key>"${
                ep.method === "POST" || ep.method === "PUT" ? ` -d '{"hello":"world"}'` : ""
              }`}
            />
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">Errors</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Status</TableHead>
              <TableHead>Meaning</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono text-xs">401</TableCell>
              <TableCell className="text-muted-foreground">
                Missing, invalid, or disabled API key.
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-xs">404</TableCell>
              <TableCell className="text-muted-foreground">
                Blob doesn&apos;t exist, or belongs to a different app (indistinguishable on purpose).
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-xs">400</TableCell>
              <TableCell className="text-muted-foreground">
                Malformed JSON body, or an invalid blob id.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
