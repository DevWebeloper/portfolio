"use client";

import { useState } from "react";

export default function CopyEmail({ email, className }: { email: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${email}`;
    }
  };

  return (
    <button type="button" className={className} onClick={copy} title="Copy email address">
      <span aria-live="polite">{copied ? "Copied" : email}</span>
    </button>
  );
}
