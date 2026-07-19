import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Render a short, single-line preview of a blob's JSON value.
 *
 * We deliberately cap the string in JS (not just via CSS `truncate`) before it
 * ever reaches the DOM. Large blobs can serialize to megabytes of text; handing
 * that whole string to the browser is slow and, in some render pipelines, gets
 * collapsed down to nothing but the ellipsis itself with no real content shown.
 * Truncating here guarantees the preview always shows real, useful content.
 */
export function previewJson(data: unknown, maxLength = 200): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(data) ?? "null";
  } catch {
    return "(unable to preview)";
  }

  if (serialized.length <= maxLength) return serialized;
  return `${serialized.slice(0, maxLength)}…`;
}
