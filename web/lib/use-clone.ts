"use client";

import { useState, useCallback } from "react";
import type { CloneEvent, CloneState } from "./types";

const initialState: CloneState = {
  isCloning: false,
  events: [],
  previewHtml: null,
  previewCss: null,
  analysis: null,
  error: null,
};

function parseSSEChunk(chunk: string): CloneEvent[] {
  return chunk
    .split("\n\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        return null;
      }
    })
    .filter(Boolean) as CloneEvent[];
}

function mergeEvent(prev: CloneState, event: CloneEvent): CloneState {
  const next = { ...prev, events: [...prev.events, event] };

  switch (event.step) {
    case "done": {
      if (event.data) {
        try {
          const data = JSON.parse(event.data);
          next.previewHtml = data.html || null;
          next.previewCss = data.css || null;
        } catch {
          // Ignore parse errors
        }
      }
      break;
    }
    case "error":
      next.error = event.message || "Unknown error";
      break;
    case "analysis-chunk":
      next.analysis = (prev.analysis || "") + (event.data || "");
      break;
  }

  return next;
}

export function useClone() {
  const [state, setState] = useState<CloneState>(initialState);

  const startClone = useCallback(async (url: string) => {
    setState({ ...initialState, isCloning: true });

    try {
      const res = await fetch("/api/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setState((prev) => ({
          ...prev,
          isCloning: false,
          error: err.error || `HTTP ${res.status}`,
        }));
        return;
      }

      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += value;
        // Process complete events (delimited by \n\n)
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        const chunk = parts.join("\n\n");
        if (chunk) {
          const events = parseSSEChunk(chunk + "\n\n");
          for (const event of events) {
            setState((prev) => mergeEvent(prev, event));
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const events = parseSSEChunk(buffer + "\n\n");
        for (const event of events) {
          setState((prev) => mergeEvent(prev, event));
        }
      }
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        error: err.message || "Connection failed",
      }));
    } finally {
      setState((prev) => ({ ...prev, isCloning: false }));
    }
  }, []);

  return { ...state, startClone };
}
