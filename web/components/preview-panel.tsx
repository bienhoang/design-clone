"use client";

import { useState, useMemo } from "react";

interface PreviewPanelProps {
  html: string | null;
  css: string | null;
  isCloning: boolean;
}

const VIEWPORT_WIDTHS = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
} as const;

type ViewportKey = keyof typeof VIEWPORT_WIDTHS;

function extractBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : html;
}

export function PreviewPanel({ html, css, isCloning }: PreviewPanelProps) {
  const [viewport, setViewport] = useState<ViewportKey>("desktop");

  const srcdoc = useMemo(() => {
    if (!html) return null;
    const body = extractBody(html);
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css || ""}</style>
</head>
<body>${body}</body>
</html>`;
  }, [html, css]);

  if (!srcdoc && !isCloning) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        <div className="text-center">
          <div className="text-4xl mb-3">&#128196;</div>
          <p className="text-sm">Enter a URL and click Clone to preview</p>
        </div>
      </div>
    );
  }

  if (!srcdoc && isCloning) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-zinc-600 border-t-blue-400 rounded-full animate-spin mb-3" />
          <p className="text-sm">Cloning in progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Viewport selector */}
      <div className="flex items-center gap-1 p-2 border-b border-zinc-800 bg-zinc-900">
        {(Object.keys(VIEWPORT_WIDTHS) as ViewportKey[]).map((vp) => (
          <button
            key={vp}
            onClick={() => setViewport(vp)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              viewport === vp
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            {vp.charAt(0).toUpperCase() + vp.slice(1)}
          </button>
        ))}
      </div>

      {/* iframe container */}
      <div className="flex-1 overflow-auto bg-zinc-100 flex justify-center">
        <iframe
          srcDoc={srcdoc!}
          sandbox="allow-same-origin"
          className="bg-white border-0 h-full"
          style={{ width: VIEWPORT_WIDTHS[viewport] }}
          title="Preview"
        />
      </div>
    </div>
  );
}
