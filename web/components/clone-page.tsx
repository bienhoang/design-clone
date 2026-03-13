"use client";

import { useClone } from "@/lib/use-clone";
import { SplitPane } from "./split-pane";
import { CloneForm } from "./clone-form";
import { ProgressLog } from "./progress-log";
import { PreviewPanel } from "./preview-panel";

export function ClonePage() {
  const { isCloning, events, previewHtml, previewCss, analysis, error, startClone } =
    useClone();

  const leftPanel = (
    <div className="flex flex-col h-full p-4 gap-4">
      <div>
        <h1 className="text-lg font-bold mb-3">Design Clone</h1>
        <CloneForm onSubmit={startClone} isCloning={isCloning} />
      </div>
      <ProgressLog events={events} analysis={analysis} error={error} />
    </div>
  );

  const rightPanel = (
    <PreviewPanel html={previewHtml} css={previewCss} isCloning={isCloning} />
  );

  return <SplitPane left={leftPanel} right={rightPanel} />;
}
