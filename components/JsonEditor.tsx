"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

export function JsonEditor({
  value,
  onChange,
  height = "400px",
}: {
  value: string;
  onChange: (value: string) => void;
  height?: string;
}) {
  // CodeMirror builds its DOM imperatively and doesn't render identically on the
  // server, which triggers hydration mismatches. Render it only after mount so the
  // server and first client render agree on a plain placeholder.
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className="overflow-hidden rounded-md border border-input bg-muted/40"
        style={{ height }}
        aria-hidden
      />
    );
  }

  return (
    <CodeMirror
      value={value}
      height={height}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      extensions={[json()]}
      onChange={onChange}
      className="overflow-hidden rounded-md border border-input text-sm"
    />
  );
}
