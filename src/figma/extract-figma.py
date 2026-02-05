#!/usr/bin/env python3
"""
Extract design data from Figma files and generate design tokens.

Usage:
    python extract-figma.py --url "https://figma.com/design/abc123/..." --output ./output
    python extract-figma.py --file-key abc123 --node-id 1:2 --output ./output

Options:
    --url           Figma URL (auto-parses file key and node ID)
    --file-key      Figma file key (alternative to URL)
    --node-id       Specific node ID to extract (optional)
    --output        Output directory for tokens and screenshot
    --verbose       Enable verbose output

Output:
    - figma-export.png: Screenshot of the design
    - figma-nodes.json: Raw node data from Figma API
    - design-tokens.json: Extracted design tokens
    - tokens.css: CSS custom properties

Environment:
    FIGMA_ACCESS_TOKEN - Required for API access
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.request import urlopen
from urllib.error import HTTPError

# Add parent to path for imports
SCRIPT_DIR = Path(__file__).parent.resolve()
SRC_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(SRC_DIR))
sys.path.insert(0, str(SCRIPT_DIR))

from utils.env import load_env, resolve_env

# Load environment
load_env()

# Import FigmaClient from same directory (figma_client.py)
from figma_client import FigmaClient


# =============================================================================
# Constants & Validation
# =============================================================================

# Figma file key: 22 alphanumeric characters (based on Figma's format)
FILE_KEY_PATTERN = re.compile(r'^[a-zA-Z0-9]{15,30}$')

# Maximum recursion depth for node traversal
MAX_RECURSION_DEPTH = 20

# Maximum file size for downloads (10MB)
MAX_DOWNLOAD_SIZE = 10 * 1024 * 1024

# Allowed image content types
ALLOWED_CONTENT_TYPES = {'image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'}

# Retry configuration (conservative to respect Figma rate limits)
MAX_RETRIES = 2
RETRY_BACKOFF_BASE = 2.0  # seconds - higher base to avoid rate limit hits


def validate_file_key(file_key: str) -> bool:
    """Validate Figma file key format."""
    return bool(FILE_KEY_PATTERN.match(file_key))


def validate_figma_hostname(url: str) -> bool:
    """Strictly validate that URL is from figma.com domain."""
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or ''
        # Only allow exact figma.com or www.figma.com
        return hostname in ('figma.com', 'www.figma.com')
    except Exception:
        return False


def sanitize_error(error: Exception) -> str:
    """Sanitize error message to not expose internal paths."""
    msg = str(error)
    # Remove home directory paths
    home = os.path.expanduser('~')
    msg = msg.replace(home, '~')
    # Remove common internal paths
    msg = re.sub(r'/Users/[^/]+/', '~/', msg)
    msg = re.sub(r'/home/[^/]+/', '~/', msg)
    return msg


def retry_with_backoff(func, max_retries: int = MAX_RETRIES):
    """Retry a function with exponential backoff. Does NOT retry on 429 rate limit."""
    import time
    last_error = None
    for attempt in range(max_retries):
        try:
            return func()
        except HTTPError as e:
            # Never retry on 429 - it only makes rate limiting worse
            if e.code == 429:
                raise
            last_error = e
            if attempt < max_retries - 1:
                delay = RETRY_BACKOFF_BASE * (2 ** attempt)
                time.sleep(delay)
        except (TimeoutError, ConnectionError) as e:
            last_error = e
            if attempt < max_retries - 1:
                delay = RETRY_BACKOFF_BASE * (2 ** attempt)
                time.sleep(delay)
    raise last_error


# =============================================================================
# URL Parsing (calls Node.js script for consistency)
# =============================================================================

def parse_figma_url(url: str) -> Dict[str, Any]:
    """
    Parse Figma URL using the Node.js parser for consistency.
    Falls back to Python regex if Node.js unavailable.
    Includes strict hostname validation.
    """
    # Strict hostname validation first
    if not validate_figma_hostname(url):
        return {'success': False, 'error': 'URL must be from figma.com domain'}

    parse_script = SCRIPT_DIR / 'parse-url.js'

    if parse_script.exists():
        try:
            result = subprocess.run(
                ['node', str(parse_script), '--url', url],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                parsed = json.loads(result.stdout)
                # Validate file key from Node.js result
                if parsed.get('success') and not validate_file_key(parsed.get('fileKey', '')):
                    return {'success': False, 'error': 'Invalid file key format'}
                return parsed
        except Exception:
            pass  # Fall through to Python fallback

    # Python fallback with strict patterns
    patterns = [
        (r'(?:^|//)(?:www\.)?figma\.com/design/([a-zA-Z0-9]{15,30})(?:/[^?]*)?(?:\?.*node-id=([0-9%A-Fa-f:-]+))?', 'design'),
        (r'(?:^|//)(?:www\.)?figma\.com/file/([a-zA-Z0-9]{15,30})(?:/[^?]*)?(?:\?.*node-id=([0-9%A-Fa-f:-]+))?', 'file'),
        (r'(?:^|//)(?:www\.)?figma\.com/proto/([a-zA-Z0-9]{15,30})(?:/[^?]*)?(?:\?.*node-id=([0-9%A-Fa-f:-]+))?', 'proto'),
    ]

    for pattern, url_type in patterns:
        match = re.search(pattern, url)
        if match:
            file_key = match.group(1)
            # Validate file key
            if not validate_file_key(file_key):
                return {'success': False, 'error': 'Invalid file key format'}

            from urllib.parse import unquote
            node_id = unquote(match.group(2)) if match.group(2) else None
            return {
                'success': True,
                'fileKey': file_key,
                'nodeId': node_id,
                'urlType': url_type
            }

    return {'success': False, 'error': 'Invalid Figma URL format'}


# =============================================================================
# Color Extraction
# =============================================================================

def rgba_to_hex(rgba: Dict[str, float]) -> str:
    """Convert Figma RGBA (0-1 range) to hex color."""
    r = int(rgba.get('r', 0) * 255)
    g = int(rgba.get('g', 0) * 255)
    b = int(rgba.get('b', 0) * 255)
    return f"#{r:02x}{g:02x}{b:02x}"


def extract_colors_from_node(node: Dict[str, Any], colors: List[Dict]) -> None:
    """Extract colors from a single node's fills and strokes."""
    node_name = node.get('name', 'unknown')

    # Extract from fills
    for fill in node.get('fills', []):
        if fill.get('type') == 'SOLID' and fill.get('visible', True):
            color_data = fill.get('color', {})
            if color_data:
                colors.append({
                    'name': node_name,
                    'hex': rgba_to_hex(color_data),
                    'opacity': fill.get('opacity', 1),
                    'source': 'fill'
                })

    # Extract from strokes
    for stroke in node.get('strokes', []):
        if stroke.get('type') == 'SOLID' and stroke.get('visible', True):
            color_data = stroke.get('color', {})
            if color_data:
                colors.append({
                    'name': f"{node_name}-stroke",
                    'hex': rgba_to_hex(color_data),
                    'opacity': stroke.get('opacity', 1),
                    'source': 'stroke'
                })


# =============================================================================
# Typography Extraction
# =============================================================================

def extract_typography_from_node(node: Dict[str, Any], typography: List[Dict]) -> None:
    """Extract typography from TEXT nodes."""
    if node.get('type') != 'TEXT':
        return

    style = node.get('style', {})
    if not style:
        return

    typography.append({
        'name': node.get('name', 'unknown'),
        'fontFamily': style.get('fontFamily'),
        'fontSize': style.get('fontSize'),
        'fontWeight': style.get('fontWeight'),
        'lineHeightPx': style.get('lineHeightPx'),
        'lineHeightPercent': style.get('lineHeightPercent'),
        'letterSpacing': style.get('letterSpacing', 0),
        'textCase': style.get('textCase', 'ORIGINAL'),
        'textDecoration': style.get('textDecoration', 'NONE')
    })


# =============================================================================
# Spacing Extraction
# =============================================================================

def extract_spacing_from_node(node: Dict[str, Any], spacing: Set[int]) -> None:
    """Extract spacing values from auto-layout frames."""
    layout_mode = node.get('layoutMode')
    if layout_mode not in ['HORIZONTAL', 'VERTICAL']:
        return

    # Item spacing (gap)
    item_spacing = node.get('itemSpacing')
    if item_spacing is not None and item_spacing > 0:
        spacing.add(int(item_spacing))

    # Padding
    for key in ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']:
        value = node.get(key)
        if value is not None and value > 0:
            spacing.add(int(value))


# =============================================================================
# Effects Extraction (Shadows, Borders)
# =============================================================================

def extract_effects_from_node(node: Dict[str, Any], shadows: List[Dict], radii: Set[int]) -> None:
    """Extract shadows and border radius from nodes."""
    # Border radius
    corner_radius = node.get('cornerRadius')
    if corner_radius is not None and corner_radius > 0:
        radii.add(int(corner_radius))

    # Individual corner radii
    for key in ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']:
        value = node.get(key)
        if value is not None and value > 0:
            radii.add(int(value))

    # Effects (shadows)
    for effect in node.get('effects', []):
        if effect.get('type') in ['DROP_SHADOW', 'INNER_SHADOW'] and effect.get('visible', True):
            color = effect.get('color', {})
            shadows.append({
                'type': effect['type'],
                'color': rgba_to_hex(color) if color else '#000000',
                'opacity': color.get('a', 1) if color else 0.1,
                'offset': {
                    'x': effect.get('offset', {}).get('x', 0),
                    'y': effect.get('offset', {}).get('y', 0)
                },
                'radius': effect.get('radius', 0),
                'spread': effect.get('spread', 0)
            })


# =============================================================================
# Node Traversal
# =============================================================================

def traverse_nodes(
    node: Dict[str, Any],
    colors: List[Dict],
    typography: List[Dict],
    spacing: Set[int],
    shadows: List[Dict],
    radii: Set[int],
    depth: int = 0,
    max_depth: int = MAX_RECURSION_DEPTH
) -> None:
    """Recursively traverse node tree and extract design data."""
    if depth > max_depth:
        return

    # Extract from current node
    extract_colors_from_node(node, colors)
    extract_typography_from_node(node, typography)
    extract_spacing_from_node(node, spacing)
    extract_effects_from_node(node, shadows, radii)

    # Traverse children
    for child in node.get('children', []):
        traverse_nodes(child, colors, typography, spacing, shadows, radii, depth + 1, max_depth)


# =============================================================================
# Token Generation
# =============================================================================

def categorize_colors(colors: List[Dict]) -> Dict[str, str]:
    """Categorize extracted colors into semantic groups."""
    if not colors:
        return {
            'primary': '#2563eb',
            'secondary': '#64748b',
            'background': '#ffffff',
            'text': {'primary': '#0f172a', 'secondary': '#475569'}
        }

    # Dedupe by hex
    unique_colors = {}
    for c in colors:
        hex_val = c['hex'].lower()
        if hex_val not in unique_colors:
            unique_colors[hex_val] = c

    color_list = list(unique_colors.values())

    # Simple heuristics for categorization
    result = {}

    # Find lightest (background) and darkest (text)
    def brightness(hex_color):
        hex_color = hex_color.lstrip('#')
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        return (r * 299 + g * 587 + b * 114) / 1000

    sorted_by_brightness = sorted(color_list, key=lambda c: brightness(c['hex']))

    if len(sorted_by_brightness) >= 1:
        result['text'] = {'primary': sorted_by_brightness[0]['hex']}
    if len(sorted_by_brightness) >= 2:
        result['background'] = sorted_by_brightness[-1]['hex']
    if len(sorted_by_brightness) >= 3:
        # Middle colors as primary/secondary
        mid = len(sorted_by_brightness) // 2
        result['primary'] = sorted_by_brightness[mid]['hex']
    if len(sorted_by_brightness) >= 4:
        result['secondary'] = sorted_by_brightness[mid - 1]['hex']

    return result


def normalize_spacing(spacing: Set[int]) -> Dict[str, str]:
    """Normalize spacing values to standard scale."""
    if not spacing:
        return {'4': '16px', '8': '32px'}

    sorted_spacing = sorted(spacing)
    result = {}

    # Map to Tailwind-like scale
    scale_map = {4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8', 40: '10', 48: '12', 64: '16'}

    for value in sorted_spacing:
        # Find closest scale
        closest = min(scale_map.keys(), key=lambda x: abs(x - value))
        if abs(closest - value) <= 4:  # Allow 4px tolerance
            result[scale_map[closest]] = f"{value}px"
        else:
            # Use actual value
            result[str(value // 4)] = f"{value}px"

    return result


def normalize_typography(typography: List[Dict]) -> Dict[str, Any]:
    """Normalize typography into standard structure."""
    if not typography:
        return {
            'fontFamily': {'heading': 'Inter, sans-serif', 'body': 'Inter, sans-serif'},
            'fontSize': {'base': '16px'},
            'fontWeight': {'normal': 400, 'bold': 700}
        }

    # Collect unique values
    families = set()
    sizes = set()
    weights = set()

    for t in typography:
        if t.get('fontFamily'):
            families.add(t['fontFamily'])
        if t.get('fontSize'):
            sizes.add(int(t['fontSize']))
        if t.get('fontWeight'):
            weights.add(int(t['fontWeight']))

    # Build result
    result = {'fontFamily': {}, 'fontSize': {}, 'fontWeight': {}, 'lineHeight': {}}

    # Font families
    family_list = list(families)
    if family_list:
        result['fontFamily']['body'] = f"{family_list[0]}, sans-serif"
        result['fontFamily']['heading'] = f"{family_list[-1]}, sans-serif"

    # Font sizes
    size_scale = {12: 'xs', 14: 'sm', 16: 'base', 18: 'lg', 20: 'xl', 24: '2xl', 30: '3xl', 36: '4xl'}
    for size in sorted(sizes):
        closest = min(size_scale.keys(), key=lambda x: abs(x - size))
        if abs(closest - size) <= 2:
            result['fontSize'][size_scale[closest]] = f"{size}px"
        else:
            result['fontSize'][f"custom-{size}"] = f"{size}px"

    # Font weights
    weight_map = {300: 'light', 400: 'normal', 500: 'medium', 600: 'semibold', 700: 'bold'}
    for weight in sorted(weights):
        closest = min(weight_map.keys(), key=lambda x: abs(x - weight))
        result['fontWeight'][weight_map[closest]] = weight

    # Default line heights
    result['lineHeight'] = {'tight': 1.25, 'normal': 1.5, 'relaxed': 1.75}

    return result


def normalize_radii(radii: Set[int]) -> Dict[str, str]:
    """Normalize border radius values."""
    if not radii:
        return {'sm': '4px', 'md': '8px', 'lg': '16px'}

    sorted_radii = sorted(radii)
    result = {}

    scale = ['sm', 'md', 'lg', 'xl', '2xl']
    for i, r in enumerate(sorted_radii[:5]):
        result[scale[i]] = f"{r}px"

    return result


def format_shadow(shadow: Dict) -> str:
    """Format shadow dict into CSS box-shadow value."""
    x = shadow['offset']['x']
    y = shadow['offset']['y']
    blur = shadow['radius']
    spread = shadow.get('spread', 0)
    color = shadow['color']
    opacity = shadow.get('opacity', 0.1)

    # Convert hex to rgba
    hex_color = color.lstrip('#')
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)

    if shadow['type'] == 'INNER_SHADOW':
        return f"inset {x}px {y}px {blur}px {spread}px rgba({r},{g},{b},{opacity:.2f})"
    return f"{x}px {y}px {blur}px {spread}px rgba({r},{g},{b},{opacity:.2f})"


def normalize_shadows(shadows: List[Dict]) -> Dict[str, str]:
    """Normalize shadows into CSS values."""
    if not shadows:
        return {
            'sm': '0 1px 2px rgba(0,0,0,0.05)',
            'md': '0 4px 6px rgba(0,0,0,0.1)',
            'lg': '0 10px 15px rgba(0,0,0,0.1)'
        }

    # Dedupe and sort by blur radius
    unique = {}
    for s in shadows:
        key = f"{s['radius']}-{s['offset']['y']}"
        if key not in unique:
            unique[key] = s

    sorted_shadows = sorted(unique.values(), key=lambda s: s['radius'])

    result = {}
    scale = ['sm', 'md', 'lg', 'xl']
    for i, s in enumerate(sorted_shadows[:4]):
        result[scale[i]] = format_shadow(s)

    return result


def generate_tokens(
    colors: List[Dict],
    typography: List[Dict],
    spacing: Set[int],
    shadows: List[Dict],
    radii: Set[int]
) -> Dict[str, Any]:
    """Generate complete design tokens structure."""
    return {
        'colors': categorize_colors(colors),
        'typography': normalize_typography(typography),
        'spacing': normalize_spacing(spacing),
        'borderRadius': normalize_radii(radii),
        'shadows': normalize_shadows(shadows),
        'source': 'figma',
        'meta': {
            'colorsFound': len(colors),
            'typographyFound': len(typography),
            'spacingFound': len(spacing),
            'shadowsFound': len(shadows)
        }
    }


def generate_tokens_css(tokens: Dict[str, Any]) -> str:
    """Generate tokens.css from design tokens."""
    lines = [
        "/* Design Tokens - Extracted from Figma */",
        "/* Edit values below to customize the design */",
        "",
        ":root {",
        "  /* Colors */"
    ]

    colors = tokens.get('colors', {})
    for key, value in colors.items():
        if isinstance(value, dict):
            for sub_key, sub_value in value.items():
                lines.append(f"  --color-{key}-{sub_key}: {sub_value};")
        else:
            lines.append(f"  --color-{key}: {value};")

    lines.append("")
    lines.append("  /* Typography */")

    typography = tokens.get('typography', {})
    for category, values in typography.items():
        if isinstance(values, dict):
            for key, value in values.items():
                css_key = f"--{category.replace('fontFamily', 'font').replace('fontSize', 'font-size').replace('fontWeight', 'font-weight').replace('lineHeight', 'line-height')}-{key}"
                lines.append(f"  {css_key}: {value};")

    lines.append("")
    lines.append("  /* Spacing */")

    for key, value in tokens.get('spacing', {}).items():
        lines.append(f"  --space-{key}: {value};")

    lines.append("")
    lines.append("  /* Border Radius */")

    for key, value in tokens.get('borderRadius', {}).items():
        lines.append(f"  --radius-{key}: {value};")

    lines.append("")
    lines.append("  /* Shadows */")

    for key, value in tokens.get('shadows', {}).items():
        lines.append(f"  --shadow-{key}: {value};")

    lines.append("}")
    lines.append("")

    return "\n".join(lines)


# =============================================================================
# Screenshot Download
# =============================================================================

def download_screenshot(
    client: 'FigmaClient',
    file_key: str,
    node_id: str,
    output_dir: Path,
    verbose: bool = False
) -> Optional[str]:
    """
    Download node screenshot from Figma API with security validation.

    Security measures:
    - Validates image URL is from Figma CDN
    - Validates content-type is an allowed image format
    - Enforces maximum file size limit
    - Uses retry with exponential backoff
    """
    from urllib.parse import urlparse

    try:
        # Get image URL with retry
        def fetch_image_url():
            return client.get_images(file_key, [node_id], format='png', scale=2)

        result = retry_with_backoff(fetch_image_url)

        images = result.get('images', {})
        image_url = images.get(node_id)

        if not image_url:
            if verbose:
                print(f"No image URL returned for node {node_id}")
            return None

        # Validate URL is from Figma CDN (figma-alpha-*.s3.amazonaws.com or s3-*.figma.com)
        parsed_url = urlparse(image_url)
        hostname = parsed_url.hostname or ''
        if not (hostname.endswith('.amazonaws.com') or hostname.endswith('.figma.com')):
            if verbose:
                print(f"Invalid image URL hostname: {hostname}")
            return None

        if verbose:
            print(f"Downloading image from: {image_url[:60]}...")

        # Download image with validation
        def download_with_validation():
            with urlopen(image_url, timeout=30) as response:
                # Validate content-type
                content_type = response.headers.get('Content-Type', '').split(';')[0].strip()
                if content_type not in ALLOWED_CONTENT_TYPES:
                    raise ValueError(f"Invalid content type: {content_type}")

                # Check content-length if available
                content_length = response.headers.get('Content-Length')
                if content_length and int(content_length) > MAX_DOWNLOAD_SIZE:
                    raise ValueError(f"File too large: {content_length} bytes (max: {MAX_DOWNLOAD_SIZE})")

                # Read with size limit
                image_data = b''
                bytes_read = 0
                chunk_size = 8192

                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    bytes_read += len(chunk)
                    if bytes_read > MAX_DOWNLOAD_SIZE:
                        raise ValueError(f"File exceeds size limit of {MAX_DOWNLOAD_SIZE} bytes")
                    image_data += chunk

                return image_data

        image_data = retry_with_backoff(download_with_validation)

        output_path = output_dir / 'figma-export.png'
        output_path.write_bytes(image_data)

        if verbose:
            print(f"Saved screenshot: {output_path} ({len(image_data)} bytes)")

        return str(output_path)

    except Exception as e:
        if verbose:
            print(f"Failed to download screenshot: {sanitize_error(e)}")
        return None


# =============================================================================
# Main Extraction
# =============================================================================

def extract_from_figma(
    file_key: str,
    node_id: Optional[str] = None,
    output_dir: str = './output',
    verbose: bool = False,
    skip_screenshot: bool = False
) -> Dict[str, Any]:
    """
    Main extraction function.

    API calls made:
    - 1x get_nodes() or get_file() (required)
    - 1x get_images() (optional, skipped with skip_screenshot=True)

    Args:
        file_key: Figma file key (validated alphanumeric, 15-30 chars)
        node_id: Optional specific node ID
        output_dir: Output directory path
        verbose: Enable verbose output
        skip_screenshot: Skip screenshot download to reduce API calls

    Returns:
        Result dict with tokens and file paths
    """
    # Validate file key
    if not validate_file_key(file_key):
        return {'success': False, 'error': 'Invalid file key format (must be 15-30 alphanumeric characters)'}

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Initialize client
    try:
        client = FigmaClient()
    except ValueError as e:
        return {'success': False, 'error': sanitize_error(e)}

    # Fetch data from Figma with retry
    if verbose:
        print(f"Fetching data for file: {file_key}")

    try:
        if node_id:
            # Fetch specific node with retry
            def fetch_nodes():
                return client.get_nodes(file_key, [node_id])

            result = retry_with_backoff(fetch_nodes)
            nodes_data = result.get('nodes', {})
            if node_id in nodes_data:
                root_node = nodes_data[node_id].get('document', {})
            else:
                return {'success': False, 'error': f'Node {node_id} not found'}
        else:
            # Fetch full file with retry
            def fetch_file():
                return client.get_file(file_key)

            result = retry_with_backoff(fetch_file)
            root_node = result.get('document', {})
            # Use first page's first frame if no node_id
            pages = root_node.get('children', [])
            if pages:
                frames = pages[0].get('children', [])
                if frames:
                    root_node = frames[0]
                    node_id = root_node.get('id')
    except HTTPError as e:
        return {'success': False, 'error': f'Figma API error: {sanitize_error(e)}'}
    except Exception as e:
        return {'success': False, 'error': f'Failed to fetch data: {sanitize_error(e)}'}

    # Save raw nodes
    nodes_path = output_path / 'figma-nodes.json'
    with open(nodes_path, 'w') as f:
        json.dump(root_node, f, indent=2)
    if verbose:
        print(f"Saved nodes: {nodes_path}")

    # Extract design data
    colors: List[Dict] = []
    typography: List[Dict] = []
    spacing: Set[int] = set()
    shadows: List[Dict] = []
    radii: Set[int] = set()

    traverse_nodes(root_node, colors, typography, spacing, shadows, radii)

    if verbose:
        print(f"Extracted: {len(colors)} colors, {len(typography)} typography, {len(spacing)} spacing values")

    # Generate tokens
    tokens = generate_tokens(colors, typography, spacing, shadows, radii)

    # Save tokens
    tokens_json_path = output_path / 'design-tokens.json'
    with open(tokens_json_path, 'w') as f:
        json.dump(tokens, f, indent=2)
    if verbose:
        print(f"Saved tokens: {tokens_json_path}")

    # Generate CSS
    tokens_css = generate_tokens_css(tokens)
    tokens_css_path = output_path / 'tokens.css'
    with open(tokens_css_path, 'w') as f:
        f.write(tokens_css)
    if verbose:
        print(f"Saved CSS: {tokens_css_path}")

    # Download screenshot (optional - skip to reduce API calls)
    screenshot_path = None
    if node_id and not skip_screenshot:
        import time
        time.sleep(1)  # Brief pause between API calls to respect rate limits
        screenshot_path = download_screenshot(client, file_key, node_id, output_path, verbose)

    return {
        'success': True,
        'tokens': tokens,
        'files': {
            'nodes': str(nodes_path),
            'tokensJson': str(tokens_json_path),
            'tokensCss': str(tokens_css_path),
            'screenshot': screenshot_path
        }
    }


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Extract design tokens from Figma")
    parser.add_argument(
        '--url', '-u',
        help='Figma URL (auto-parses file key and node ID)'
    )
    parser.add_argument(
        '--file-key', '-f',
        help='Figma file key (alternative to URL)'
    )
    parser.add_argument(
        '--node-id', '-n',
        help='Specific node ID to extract'
    )
    parser.add_argument(
        '--output', '-o',
        default='./figma-output',
        help='Output directory (default: ./figma-output)'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    parser.add_argument(
        '--no-screenshot',
        action='store_true',
        help='Skip screenshot download (saves 1 API call)'
    )

    args = parser.parse_args()

    # Get file key and node ID
    file_key = args.file_key
    node_id = args.node_id

    if args.url:
        parsed = parse_figma_url(args.url)
        if not parsed.get('success'):
            print(json.dumps({'success': False, 'error': parsed.get('error', 'Failed to parse URL')}))
            sys.exit(1)
        file_key = parsed['fileKey']
        node_id = parsed.get('nodeId') or node_id

    # Figma API expects colon-separated node IDs (e.g., "3204:2"), but URLs use hyphens
    if node_id and '-' in node_id and ':' not in node_id:
        node_id = node_id.replace('-', ':')

    if not file_key:
        print(json.dumps({'success': False, 'error': 'Either --url or --file-key required'}))
        sys.exit(1)

    if args.verbose:
        print(f"File key: {file_key}")
        print(f"Node ID: {node_id or 'auto-detect'}")
        print(f"Output: {args.output}")

    # Run extraction
    result = extract_from_figma(
        file_key=file_key,
        node_id=node_id,
        output_dir=args.output,
        verbose=args.verbose,
        skip_screenshot=args.no_screenshot
    )

    print(json.dumps(result, indent=2))
    sys.exit(0 if result.get('success') else 1)


if __name__ == '__main__':
    main()
