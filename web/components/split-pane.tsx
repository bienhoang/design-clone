"use client";

import { useRef, useCallback, useState, type ReactNode } from "react";

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
}

export function SplitPane({ left, right }: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(480);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const startX = e.clientX;
      const startWidth = leftWidth;

      const onMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return;
        const containerWidth = containerRef.current.getBoundingClientRect().width;
        const newWidth = Math.max(
          300,
          Math.min(startWidth + e.clientX - startX, containerWidth - 300)
        );
        setLeftWidth(newWidth);
      };

      const onMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [leftWidth]
  );

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div
        className="flex-shrink-0 overflow-y-auto border-r border-zinc-800"
        style={{ width: leftWidth }}
      >
        {left}
      </div>

      {/* Divider */}
      <div
        className={`w-1.5 flex-shrink-0 cursor-col-resize transition-colors ${
          isDragging ? "bg-blue-500" : "bg-zinc-800 hover:bg-zinc-600"
        }`}
        onMouseDown={onMouseDown}
      />

      {/* Right panel */}
      <div className="flex-1 min-w-[300px] overflow-hidden">{right}</div>
    </div>
  );
}
