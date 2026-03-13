import path from "path";
import fs from "fs";
import type { CloneEvent } from "@/lib/types";
import { encodeSSE, createSSEHeaders } from "@/lib/sse-helpers";
import { streamAnalysis } from "@/lib/openrouter";
import {
  validateUrl,
  createOutputDir,
  launchAndNavigate,
  extractAll,
  inlineExternalResources,
  saveResults,
  cleanupPage,
  acquireLock,
  releaseLock,
} from "@/lib/clone-pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  if (!acquireLock()) {
    return Response.json(
      { error: "Another clone is in progress. Please wait." },
      { status: 429 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: CloneEvent) => {
        controller.enqueue(encodeSSE(event));
      };

      let page: any = null;

      try {
        // Step 1: Validate URL
        if (request.signal.aborted) throw new Error("Aborted");
        emit({ step: "validate", status: "running", progress: 5 });
        const validUrl = validateUrl(body.url!);
        emit({ step: "validate", status: "complete", progress: 10 });

        // Step 2: Create output directory
        const outputDir = createOutputDir(validUrl);

        // Step 3: Launch browser & navigate
        if (request.signal.aborted) throw new Error("Aborted");
        emit({ step: "browser", status: "running", progress: 12 });
        const result = await launchAndNavigate(validUrl);
        page = result.page;
        emit({ step: "browser", status: "complete", progress: 15 });

        emit({ step: "navigate", status: "running", progress: 20 });
        // Navigation already happened in launchAndNavigate
        emit({ step: "navigate", status: "complete", progress: 25 });

        // Step 4: Parallel extraction
        if (request.signal.aborted) throw new Error("Aborted");
        emit({ step: "extract", status: "running", progress: 30 });
        const extracted = await extractAll(page, validUrl, outputDir);
        emit({ step: "extract", status: "complete", progress: 65 });

        // Step 5: Inline external resources
        if (request.signal.aborted) throw new Error("Aborted");
        emit({ step: "inline", status: "running", progress: 68 });

        const combinedCss = extracted.css.cssBlocks
          .map((b: any) => b.css)
          .join("\n\n");

        let finalHtml = extracted.html.html;
        let finalCss = combinedCss;

        try {
          const inlined = await inlineExternalResources(
            page,
            finalHtml,
            finalCss
          );
          finalHtml = inlined.html;
          finalCss = inlined.css;
        } catch {
          // Resource inlining is best-effort
        }
        emit({ step: "inline", status: "complete", progress: 80 });

        // Step 6: Save to disk
        if (request.signal.aborted) throw new Error("Aborted");
        emit({ step: "save", status: "running", progress: 82 });
        const saved = saveResults(outputDir, {
          html: finalHtml,
          css: finalCss,
          dom: extracted.dom,
          screenshotPath: extracted.screenshot.path,
        });
        emit({ step: "save", status: "complete", progress: 85 });

        // Emit HTML + CSS for preview (before AI analysis so preview loads early)
        emit({
          step: "done",
          status: "complete",
          progress: 87,
          data: JSON.stringify({
            outputDir,
            html: finalHtml,
            css: finalCss,
            htmlPath: saved.htmlPath,
            cssPath: saved.cssPath,
          }),
        });

        // Step 7: AI Analysis (streams after preview is available)
        emit({ step: "analysis", status: "running", progress: 88 });
        let fullAnalysis = "";
        try {
          for await (const chunk of streamAnalysis(extracted.dom as any, validUrl)) {
            fullAnalysis += chunk;
            emit({ step: "analysis-chunk", status: "streaming", data: chunk });
          }
          if (fullAnalysis) {
            fs.writeFileSync(
              path.join(outputDir, "structure.md"),
              fullAnalysis,
              "utf-8"
            );
          }
          emit({ step: "analysis", status: "complete", progress: 100 });
        } catch {
          emit({
            step: "analysis",
            status: "complete",
            progress: 100,
            message: "AI analysis failed",
          });
        }

        controller.close();
      } catch (error: any) {
        emit({
          step: "error",
          status: "error",
          message: error.message || "Unknown error",
        });
        controller.close();
      } finally {
        if (page) await cleanupPage(page);
        else releaseLock();
      }
    },
  });

  return new Response(stream, { headers: createSSEHeaders() });
}
