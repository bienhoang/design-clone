"use client";

import { useState, type FormEvent } from "react";

interface CloneFormProps {
  onSubmit: (url: string) => void;
  isCloning: boolean;
}

export function CloneForm({ onSubmit, isCloning }: CloneFormProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    // Auto-add https:// if missing
    const finalUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    onSubmit(finalUrl);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
        disabled={isCloning}
        className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isCloning || !url.trim()}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isCloning ? "Cloning..." : "Clone"}
      </button>
    </form>
  );
}
