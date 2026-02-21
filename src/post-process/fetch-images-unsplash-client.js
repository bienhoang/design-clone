/**
 * Unsplash API Client
 *
 * Handles searching Unsplash for photos and triggering download attribution.
 * Uses a module-level cache to avoid duplicate API calls within a session.
 */

const UNSPLASH_API = 'https://api.unsplash.com';

// Cache for search results to avoid duplicate API calls
const searchCache = new Map();

/**
 * Generate search keywords from image context.
 * Prioritises alt text; falls back to surrounding text words.
 * Translates common Japanese keywords for better Unsplash results.
 * @param {{ alt: string, context: string }} imageContext
 * @returns {string} Keyword string
 */
export function generateKeywords(imageContext) {
  const { alt, context } = imageContext;
  let keywords = alt;

  if (!keywords || keywords.length < 3) {
    const words = context
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .filter(w => !['http', 'https', 'www', 'html', 'class', 'style'].includes(w));
    keywords = words.slice(0, 3).join(' ');
  }

  const translations = {
    '会社': 'company office',
    '仕事': 'work business',
    '人': 'people team',
    'サービス': 'service',
    'ビジネス': 'business',
    '技術': 'technology',
    'オフィス': 'office',
    'チーム': 'team',
    'ミーティング': 'meeting',
    '開発': 'development',
    'デザイン': 'design',
    'マーケティング': 'marketing',
    '事例': 'case study business',
    '導入': 'implementation',
    'CTA': 'business success'
  };

  for (const [jp, en] of Object.entries(translations)) {
    if (keywords.includes(jp)) keywords = keywords.replace(jp, en);
  }

  if (!keywords || keywords.length < 3) keywords = 'business professional';

  return keywords.trim();
}

/**
 * Search Unsplash for an image matching the keywords.
 * Returns null if no API key or no results found.
 * @param {string} keywords
 * @param {'landscape'|'portrait'|'squarish'} orientation
 * @returns {Promise<{ id, url, thumb, photographer, photographerUrl, downloadLocation }|null>}
 */
export async function searchUnsplash(keywords, orientation = 'landscape') {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) return null;

  const cacheKey = `${keywords}-${orientation}`;
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);

  try {
    const params = new URLSearchParams({ query: keywords, orientation, per_page: '1' });
    const response = await fetch(`${UNSPLASH_API}/search/photos?${params}`, {
      headers: {
        'Authorization': `Client-ID ${apiKey}`,
        'Accept-Version': 'v1'
      }
    });

    if (!response.ok) {
      if (response.status === 403) console.warn('  ⚠ Unsplash rate limit reached');
      return null;
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    const photo  = data.results[0];
    const result = {
      id:                photo.id,
      url:               photo.urls.regular,
      thumb:             photo.urls.thumb,
      photographer:      photo.user.name,
      photographerUrl:   photo.user.links.html,
      downloadLocation:  photo.links.download_location
    };

    searchCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.warn(`  ⚠ Unsplash search failed: ${error.message}`);
    return null;
  }
}

/**
 * Trigger download event for attribution (required by Unsplash API terms).
 * Silently ignores failures — not critical.
 * @param {string} downloadLocation
 */
export async function triggerDownload(downloadLocation) {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey || !downloadLocation) return;
  try {
    await fetch(downloadLocation, {
      headers: { 'Authorization': `Client-ID ${apiKey}` }
    });
  } catch { /* silently fail */ }
}
