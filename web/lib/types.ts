export type CloneEventStep =
  | "validate"
  | "browser"
  | "navigate"
  | "extract"
  | "inline"
  | "save"
  | "analysis"
  | "analysis-chunk"
  | "done"
  | "error";

export type CloneEventStatus =
  | "running"
  | "complete"
  | "streaming"
  | "error";

export interface CloneEvent {
  step: CloneEventStep;
  status: CloneEventStatus;
  progress?: number;
  message?: string;
  data?: string;
}

export interface CloneState {
  isCloning: boolean;
  events: CloneEvent[];
  previewHtml: string | null;
  previewCss: string | null;
  analysis: string | null;
  error: string | null;
}

export interface CloneRequest {
  url: string;
}
