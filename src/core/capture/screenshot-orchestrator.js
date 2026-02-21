/**
 * Screenshot Orchestrator
 *
 * Post-capture orchestration: hover state capture, video recording,
 * section-based cropping, and component dimension output assembly.
 * Called after per-viewport screenshots are complete.
 *
 * @module screenshot-orchestrator
 */

import path from 'path';
import fs from 'fs/promises';
import { captureAllHoverStates, generateHoverCss } from '../animation/state-capture.js';
import { captureVideo, hasFfmpeg, FFMPEG_REQUIRED_FORMATS } from '../media/video-capture.js';
import { buildDimensionsOutput, generateAISummary } from '../dimension/dimension-output.js';
import { VIEWPORTS } from '../../shared/viewports.js';

/**
 * Capture hover states with headed→headless fallback.
 * Writes hover.css to output if captures succeed.
 */
export async function runHoverCapture(
  browserMgr, extraction, output, url,
  initBrowser, getHeadlessForViewport, requestedViewports
) {
  const readCss = async () => extraction?.css?.path ? fs.readFile(extraction.css.path, 'utf-8') : null;
  try {
    const wasHeadless = browserMgr.getCurrentHeadless();
    let hoverResult = null;
    let hoverCaptureSuccess = false;

    if (!wasHeadless) {
      try {
        hoverResult = await captureAllHoverStates(browserMgr.getPage(), await readCss(), output);
        hoverCaptureSuccess = hoverResult.captured > 0;
      } catch (headedError) {
        if (process.stderr.isTTY) console.error(`[WARN] Headed hover capture failed, switching to headless: ${headedError.message}`);
      }
    }

    if (!hoverCaptureSuccess) {
      if (!browserMgr.getCurrentHeadless()) await initBrowser(true, url);
      hoverResult = await captureAllHoverStates(browserMgr.getPage(), await readCss(), output);
    }

    if (hoverResult?.elements && hoverResult.captured > 0) {
      const hoverCssPath = path.join(output, 'hover.css');
      await fs.writeFile(hoverCssPath, generateHoverCss(hoverResult.elements), 'utf-8');
      hoverResult.generatedCss = path.resolve(hoverCssPath);
    }
    if (process.stderr.isTTY && hoverResult) console.error(`[INFO] Hover states: ${hoverResult.captured}/${hoverResult.detected} captured`);
    if (!wasHeadless && browserMgr.getCurrentHeadless() && requestedViewports.some(v => !getHeadlessForViewport(v))) {
      await initBrowser(false, url);
    }
    return hoverResult;
  } catch (error) {
    if (process.stderr.isTTY) console.error(`[WARN] Hover capture failed: ${error.message}`);
    return { error: error.message, failed: true };
  }
}

/** Record a scroll video (WebM → optionally MP4/GIF). Returns error object on failure. */
export async function runVideoCapture(browserMgr, output, videoFormat, videoDuration) {
  try {
    if (FFMPEG_REQUIRED_FORMATS.includes(videoFormat)) {
      const hasFf = await hasFfmpeg();
      if (!hasFf && process.stderr.isTTY) {
        console.error(`[WARN] ffmpeg not found. Will output WebM instead of ${videoFormat}`);
        console.error('[WARN] Install: npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg');
      }
    }

    const videoPage = browserMgr.getPage();
    await videoPage.setViewportSize(VIEWPORTS.desktop);
    await new Promise(r => setTimeout(r, 1000));

    if (process.stderr.isTTY) {
      console.error(`[INFO] Recording video (${videoDuration / 1000}s)...`);
    }

    const videoResult = await captureVideo(videoPage, output, {
      format: videoFormat,
      duration: videoDuration,
      filename: 'preview'
    });

    if (process.stderr.isTTY) {
      const outputFormat = videoResult.output.split('.').pop();
      console.error(`[INFO] Video saved: ${outputFormat} (${(videoResult.duration / 1000).toFixed(1)}s)`);
    }

    return videoResult;
  } catch (error) {
    if (process.stderr.isTTY) {
      console.error(`[WARN] Video capture failed: ${error.message}`);
    }
    return { error: error.message, failed: true };
  }
}

/** Detect sections and crop desktop screenshot into individual section images. */
export async function runSectionCapture(browserMgr, desktopScreenshot, output) {
  try {
    const { detectSections } = await import('../section/section-detector.js');
    const { cropSections } = await import('../section/section-cropper.js');

    const sectionPage = browserMgr.getPage();
    await sectionPage.setViewportSize(VIEWPORTS.desktop);
    await new Promise(r => setTimeout(r, 500));

    if (process.stderr.isTTY) console.error('[INFO] Detecting sections...');

    const sections = await detectSections(sectionPage, {
      padding: 40,
      minSections: 3,
      fallbackToViewport: true
    });

    if (process.stderr.isTTY) {
      console.error(`[INFO] Found ${sections.length} sections, cropping...`);
    }

    const croppedResult = await cropSections(desktopScreenshot.path, sections, output);

    if (process.stderr.isTTY) {
      console.error(`[INFO] Sections: ${croppedResult.sections.length} cropped, ${croppedResult.skipped.length} skipped`);
    }

    return {
      enabled: true,
      count: croppedResult.sections.length,
      skipped: croppedResult.skipped.length,
      sections: croppedResult.sections.map(s => ({
        index: s.index,
        name: s.name,
        path: s.relativePath,
        bounds: s.bounds,
        role: s.role
      })),
      directory: croppedResult.directory,
      summary: croppedResult.summary
    };
  } catch (err) {
    if (process.stderr.isTTY) {
      console.error(`[WARN] Section processing failed: ${err.message}`);
    }
    return { enabled: true, error: err.message };
  }
}

/** Build component-dimensions.json + dimensions-summary.json; return stats. */
export async function runDimensionOutput(screenshots, url, output) {
  const allViewportDimensions = {};
  for (const screenshot of screenshots) {
    if (screenshot.componentDimensions) {
      allViewportDimensions[screenshot.viewport] = screenshot.componentDimensions;
    }
  }

  const dimensionsOutput = buildDimensionsOutput(allViewportDimensions, url);
  const dimensionsPath = path.join(output, 'component-dimensions.json');
  await fs.writeFile(dimensionsPath, JSON.stringify(dimensionsOutput, null, 2));

  const aiSummary = generateAISummary(dimensionsOutput);
  const summaryPath = path.join(output, 'dimensions-summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(aiSummary, null, 2));

  const vpValues = Object.values(dimensionsOutput.viewports);
  const sum = (key) => vpValues.reduce((s, vp) => s + (vp[key]?.length || 0), 0);
  const stats = { containers: sum('containers'), cards: sum('cards'), gridLayouts: sum('gridLayouts'), typography: sum('typography') };

  if (process.stderr.isTTY) console.error(`[INFO] Extracted: ${stats.containers} containers, ${stats.cards} card groups, ${stats.gridLayouts} grid layouts`);

  return { dimensionsOutput, dimensionsPath: path.resolve(dimensionsPath), summaryPath: path.resolve(summaryPath), stats };
}

/** Write dom-hierarchy.json from desktopScreenshot.domHierarchy. Returns path or null. */
export async function writeDomHierarchy(desktopScreenshot, output) {
  if (!desktopScreenshot?.domHierarchy) return null;
  const hierarchyPath = path.join(output, 'dom-hierarchy.json');
  await fs.writeFile(hierarchyPath, JSON.stringify(desktopScreenshot.domHierarchy, null, 2));
  if (process.stderr.isTTY) {
    const s = desktopScreenshot.domHierarchy.stats || {};
    console.error(`[INFO] DOM hierarchy: ${s.totalNodes || 0} nodes, ${s.landmarkCount || 0} landmarks, ${s.extractionTimeMs || 0}ms`);
  }
  return path.resolve(hierarchyPath);
}
