"use client";

import { useRef, useEffect } from "react";
import type { CloneEvent } from "@/lib/types";

interface ProgressLogProps {
  events: CloneEvent[];
  analysis: string | null;
  error: string | null;
}

const STEP_LABELS: Record<string, string> = {
  validate: "Validating URL",
  browser: "Launching browser",
  navigate: "Navigating to page",
  extract: "Extracting HTML/CSS/DOM",
  inline: "Inlining resources",
  save: "Saving files",
  analysis: "AI Analysis",
  "analysis-chunk": "AI Analysis",
  done: "Complete",
  error: "Error",
};

function StepIcon({ status }: { status: string }) {
  if (status === "running" || status === "streaming") {
    return (
      <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    );
  }
  if (status === "complete") {
    return <span className="text-green-400 text-sm">&#10003;</span>;
  }
  if (status === "error") {
    return <span className="text-red-400 text-sm">&#10007;</span>;
  }
  return <span className="text-zinc-500 text-sm">&#9679;</span>;
}

export function ProgressLog({ events, analysis, error }: ProgressLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, analysis]);

  // Deduplicate: show latest event per step (except analysis-chunk)
  const stepMap = new Map<string, CloneEvent>();
  for (const event of events) {
    if (event.step === "analysis-chunk") continue;
    stepMap.set(event.step, event);
  }
  const displayEvents = Array.from(stepMap.values());

  // Overall progress
  const latestProgress = events.reduce(
    (max, e) => Math.max(max, e.progress || 0),
    0
  );

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      {/* Progress bar */}
      {displayEvents.length > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Progress</span>
            <span>{latestProgress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${latestProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Step log */}
      <div className="space-y-1.5">
        {displayEvents.map((event, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <StepIcon status={event.status} />
            <span className="text-zinc-300">
              {STEP_LABELS[event.step] || event.step}
            </span>
            {event.status === "error" && event.message && (
              <span className="text-red-400 text-xs ml-1">
                {event.message}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 p-2 rounded bg-red-950 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* AI Analysis */}
      {analysis && (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">
            AI Analysis
          </h3>
          <pre className="whitespace-pre-wrap text-xs text-zinc-400 leading-relaxed">
            {analysis}
          </pre>
        </div>
      )}
    </div>
  );
}
