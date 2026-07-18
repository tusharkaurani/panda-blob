"use client";

import { Button } from "./Button";

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm text-gray-600">
      <span>
        {total === 0
          ? "0 results"
          : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span>
          Page {page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
