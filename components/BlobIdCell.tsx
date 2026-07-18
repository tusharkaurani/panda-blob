"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, CopyIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BlobIdCell({
  id,
  ownerAccessKey,
}: {
  id: string;
  ownerAccessKey: string | null;
}) {
  const [copied, setCopied] = useState<"id" | "url" | null>(null);

  function copy(type: "id" | "url") {
    const text =
      type === "id" ? id : `${window.location.origin}/api/blob/${id}?apiKey=${ownerAccessKey}`;
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied((c) => (c === type ? null : c)), 1500);
  }

  return (
    <div className="flex items-center gap-0.5">
      <Link href={`/blobs/${id}`} className="font-mono text-xs hover:underline">
        {id}
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Copy blob ID"
        title="Copy blob ID"
        onClick={() => copy("id")}
      >
        {copied === "id" ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Copy fetch URL"
        title="Copy fetch URL (GET, with this owner's API key)"
        disabled={!ownerAccessKey}
        onClick={() => copy("url")}
      >
        {copied === "url" ? <CheckIcon className="size-3" /> : <LinkIcon className="size-3" />}
      </Button>
    </div>
  );
}
