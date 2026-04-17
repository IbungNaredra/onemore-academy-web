"use client";

import { useState } from "react";

/** Copies submission id (content id) to the clipboard for admin workflows. */
export function CopyContentIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="admin-table-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : "Copy content id"}
    </button>
  );
}
