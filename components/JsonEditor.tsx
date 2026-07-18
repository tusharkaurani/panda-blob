"use client";

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
  return (
    <CodeMirror
      value={value}
      height={height}
      extensions={[json()]}
      onChange={onChange}
      className="overflow-hidden rounded-md border border-gray-300 text-sm"
    />
  );
}
