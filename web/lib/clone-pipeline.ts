import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = path.resolve(__dirname, "../output");

// Request lock for singleton browser
let isLocked = false;

export function acquireLock(): boolean {
  if (isLocked) return false;
  isLocked = true;
  return true;
}

export function releaseLock(): void {
  isLocked = false;
}

// Browser singleton
let browserInstance: Awaited<ReturnType<typeof import("@src/utils/browser.js")["getBrowser"]>> | null = null;

async function getBrowserInstance() {
  const { getBrowser } = await import("@src/utils/browser.js");

  if (!browserInstance || !(browserInstance as any).isConnected?.()) {
    browserInstance = await getBrowser();
  }
  return browserInstance;
}

async function getNewPage(browser: any) {
  const { getPage } = await import("@src/utils/browser.js");
  return getPage(browser);
}

export function validateUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Only HTTP(S) URLs are supported: ${url}`);
  }

  // Basic SSRF prevention: reject private IPs
  const hostname = parsed.hostname;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.16.")
  ) {
    throw new Error(`Private/local URLs are not allowed: ${url}`);
  }

  return parsed.href;
}

export function createOutputDir(url: string): string {
  const hostname = new URL(url).hostname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const dirName = `${Date.now()}-${hostname}`;
  const outputDir = path.join(OUTPUT_ROOT, dirName);
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

export async function launchAndNavigate(url: string) {
  const browser = await getBrowserInstance();
  const page = await getNewPage(browser);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Wait for network to settle
  try {
    await page.waitForLoadState("networkidle", { timeout: 10000 });
  } catch {
    // Acceptable: some pages never reach networkidle
  }

  return { browser, page };
}

const VIEWPORT_MAP = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

export async function extractAll(
  page: any,
  url: string,
  outputDir: string
) {
  const [htmlModule, cssModule, domModule, screenshotModule] =
    await Promise.all([
      import("@src/core/html/html-extractor.js"),
      import("@src/core/css/css-extractor.js"),
      import("@src/core/dimension/dom-tree-analyzer.js"),
      import("@src/core/capture/screenshot-viewport.js"),
    ]);

  const [htmlResult, cssResult, domResult, screenshotResult] =
    await Promise.all([
      htmlModule.extractAndEnhanceHtml(page),
      cssModule.extractAllCss(page, url),
      domModule.extractDOMHierarchy(page, { maxDepth: 8 }),
      (screenshotModule.captureViewport as any)({
        page,
        viewport: "desktop",
        outputPath: path.join(outputDir, "desktop.png"),
        viewportMap: VIEWPORT_MAP,
      }),
    ]);

  return { html: htmlResult, css: cssResult, dom: domResult, screenshot: screenshotResult };
}

export async function inlineExternalResources(
  page: any,
  html: string,
  css: string
): Promise<{ html: string; css: string }> {
  // Fetch external images referenced in HTML and convert to data URIs
  const inlinedHtml = await page.evaluate(async (htmlStr: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, "text/html");

    const images = doc.querySelectorAll("img[src]");
    for (const img of images) {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) continue;
      try {
        const absoluteUrl = new URL(src, document.location.href).href;
        const res = await fetch(absoluteUrl);
        if (!res.ok) continue;
        const blob = await res.blob();
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        img.setAttribute("src", dataUri);
      } catch {
        // Keep original src if fetch fails
      }
    }

    // Inline background images in style attributes
    const styledEls = doc.querySelectorAll("[style]");
    for (const el of styledEls) {
      const style = el.getAttribute("style") || "";
      const urlMatch = style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/);
      if (urlMatch) {
        try {
          const res = await fetch(urlMatch[1]);
          if (!res.ok) continue;
          const blob = await res.blob();
          const reader = new FileReader();
          const dataUri = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          el.setAttribute(
            "style",
            style.replace(urlMatch[0], `url(${dataUri})`)
          );
        } catch {
          // Keep original
        }
      }
    }

    return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
  }, html);

  // Inline font URLs in CSS (url() references)
  let inlinedCss = css;
  const fontUrlRegex = /url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/g;
  const fontMatches = [...css.matchAll(fontUrlRegex)];

  for (const match of fontMatches) {
    try {
      const dataUri = await page.evaluate(async (fontUrl: string) => {
        const res = await fetch(fontUrl);
        if (!res.ok) return null;
        const blob = await res.blob();
        const reader = new FileReader();
        return new Promise<string | null>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }, match[1]);

      if (dataUri) {
        inlinedCss = inlinedCss.replace(match[0], `url(${dataUri})`);
      }
    } catch {
      // Keep original URL
    }
  }

  return { html: inlinedHtml, css: inlinedCss };
}

export function saveResults(
  outputDir: string,
  results: {
    html: string;
    css: string;
    dom: any;
    screenshotPath: string;
  }
): { htmlPath: string; cssPath: string; domPath: string } {
  const htmlPath = path.join(outputDir, "source.html");
  const cssPath = path.join(outputDir, "source.css");
  const domPath = path.join(outputDir, "dom-tree.json");

  fs.writeFileSync(htmlPath, results.html, "utf-8");
  fs.writeFileSync(cssPath, results.css, "utf-8");
  fs.writeFileSync(domPath, JSON.stringify(results.dom, null, 2), "utf-8");

  return { htmlPath, cssPath, domPath };
}

export async function cleanupPage(page: any): Promise<void> {
  try {
    await page.close();
  } catch {
    // Ignore close errors
  } finally {
    releaseLock();
  }
}
