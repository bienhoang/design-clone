#!/usr/bin/env python3
"""
Extract design tokens from website screenshots using Gemini Vision API.

Usage:
  python extract-design-tokens.py --screenshots ./analysis --output ./output
  python extract-design-tokens.py -s ./analysis -o ./out --css source.css
  python extract-design-tokens.py -s ./analysis -o ./out --section-mode

Options:
  --screenshots   Directory containing desktop.png, tablet.png, mobile.png
  --output        Output directory for design-tokens.json and tokens.css
  --css           Path to filtered CSS file for exact token extraction (optional)
  --model         Gemini model (default: gemini-2.5-flash)
  --verbose       Enable verbose output
  --section-mode  Analyze sections instead of viewports (sections/*.png)

Output:
  - design-tokens.json: Machine-readable tokens
  - tokens.css: CSS custom properties
  - section-analysis/*.json: Per-section tokens (section-mode only)

When CSS provided, extracts EXACT colors/fonts from source instead of estimating.
Section mode analyzes each section separately for better detail accuracy.
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add src directory to path for local imports
SCRIPT_DIR = Path(__file__).parent.resolve()
SRC_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(SRC_DIR))

# Import local env resolver (portable)
try:
    from utils.env import resolve_env, load_env
    load_env()  # Load .env files on startup
except ImportError:
    # Fallback: simple env getter
    def resolve_env(key, default=None):
        return os.environ.get(key, default)

# Check for google-genai dependency
try:
    from google import genai
    from google.genai import types
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "google-genai not installed",
        "hint": "Run: pip install google-genai"
    }, indent=2))
    sys.exit(1)

# Import prompts from extracted module
from prompts.design_tokens import build_extraction_prompt, build_section_prompt


# Default tokens (fallback)
DEFAULT_TOKENS = {
    "colors": {
        "primary": "#2563eb",
        "secondary": "#64748b",
        "accent": "#f59e0b",
        "background": "#ffffff",
        "surface": "#f8fafc",
        "text": {
            "primary": "#0f172a",
            "secondary": "#475569",
            "muted": "#94a3b8"
        },
        "border": "#e2e8f0"
    },
    "typography": {
        "fontFamily": {
            "heading": "Inter, sans-serif",
            "body": "Inter, sans-serif"
        },
        "fontSize": {
            "xs": "12px",
            "sm": "14px",
            "base": "16px",
            "lg": "18px",
            "xl": "20px",
            "2xl": "24px",
            "3xl": "30px",
            "4xl": "36px"
        },
        "fontWeight": {
            "normal": 400,
            "medium": 500,
            "semibold": 600,
            "bold": 700
        },
        "lineHeight": {
            "tight": 1.25,
            "normal": 1.5,
            "relaxed": 1.75
        }
    },
    "spacing": {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "6": "24px",
        "8": "32px",
        "12": "48px",
        "16": "64px"
    },
    "borderRadius": {
        "sm": "4px",
        "md": "8px",
        "lg": "16px",
        "full": "9999px"
    },
    "shadows": {
        "sm": "0 1px 2px rgba(0,0,0,0.05)",
        "md": "0 4px 6px rgba(0,0,0,0.1)",
        "lg": "0 10px 15px rgba(0,0,0,0.1)"
    },
    "notes": ["Using default tokens - extraction failed or was not performed"]
}


def get_api_key() -> Optional[str]:
    """Get Gemini API key from environment (supports GEMINI_API_KEY or GOOGLE_API_KEY)."""
    return resolve_env('GEMINI_API_KEY') or resolve_env('GOOGLE_API_KEY')


def validate_hex_color(color: str) -> bool:
    """Validate hex color format."""
    return bool(re.match(r'^#[0-9A-Fa-f]{6}$', color))


def validate_tokens(tokens: Dict[str, Any]) -> tuple[bool, list[str]]:
    """Validate extracted tokens, return (is_valid, errors)."""
    errors = []

    # Check colors
    if 'colors' in tokens:
        colors = tokens['colors']
        for key in ['primary', 'secondary', 'accent', 'background', 'surface', 'border']:
            if key in colors and not validate_hex_color(colors[key]):
                errors.append(f"Invalid hex color: colors.{key} = {colors[key]}")

        if 'text' in colors:
            for key in ['primary', 'secondary', 'muted']:
                if key in colors['text'] and not validate_hex_color(colors['text'][key]):
                    errors.append(f"Invalid hex color: colors.text.{key} = {colors['text'][key]}")

    return len(errors) == 0, errors


def merge_with_defaults(tokens: Dict[str, Any]) -> Dict[str, Any]:
    """Merge extracted tokens with defaults for missing values."""
    def deep_merge(base: dict, override: dict) -> dict:
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    return deep_merge(DEFAULT_TOKENS.copy(), tokens)


def extract_section_tokens(
    section_path: str,
    css_content: Optional[str],
    client,
    model: str,
    verbose: bool = False
) -> Dict[str, Any]:
    """Extract tokens from a single section image.

    Args:
        section_path: Path to section image
        css_content: Optional CSS content for context
        client: Gemini client instance
        model: Model name to use
        verbose: Enable verbose output

    Returns:
        Extracted tokens for this section
    """
    section_name = Path(section_path).stem  # e.g., section-0-header

    # Build section-specific prompt
    prompt = build_section_prompt(section_name, css_content)

    # Load image
    with open(section_path, 'rb') as f:
        img_bytes = f.read()

    content = [
        prompt,
        types.Part.from_bytes(data=img_bytes, mime_type='image/png')
    ]

    try:
        config = types.GenerateContentConfig(
            response_mime_type='application/json'
        )

        response = client.models.generate_content(
            model=model,
            contents=content,
            config=config
        )

        if hasattr(response, 'text') and response.text:
            tokens = json.loads(response.text)
            tokens['_section'] = section_name
            return tokens
        else:
            return {'_section': section_name, 'error': 'Empty response'}

    except Exception as e:
        if verbose:
            print(f"Error extracting {section_name}: {e}", file=sys.stderr)
        return {'_section': section_name, 'error': str(e)}


def merge_section_tokens(section_tokens: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Merge tokens from multiple sections into unified set.

    Strategy:
    - Colors: First non-null occurrence wins (header colors take priority)
    - Typography: Collect all unique values
    - Spacing: Merge unique values
    - Notes: Collect all

    Args:
        section_tokens: List of per-section token dicts

    Returns:
        Merged token dictionary
    """
    merged = {
        'colors': {
            'primary': None,
            'secondary': None,
            'accent': None,
            'background': None,
            'surface': None,
            'text': {
                'primary': None,
                'secondary': None,
                'muted': None
            },
            'border': None
        },
        'typography': {
            'fontFamily': {
                'heading': None,
                'body': None
            },
            'fontSize': {},
            'fontWeight': {
                'normal': None,
                'medium': None,
                'semibold': None,
                'bold': None
            },
            'lineHeight': {}
        },
        'spacing': {},
        'borderRadius': {},
        'shadows': {},
        'notes': [],
        '_sections': [],
        '_sectionCount': len(section_tokens)
    }

    # Track seen font sizes for deduplication
    seen_sizes = set()

    for tokens in section_tokens:
        if 'error' in tokens:
            merged['notes'].append(f"Section {tokens.get('_section', 'unknown')} failed: {tokens['error']}")
            continue

        section_name = tokens.get('_section', 'unknown')
        merged['_sections'].append(section_name)

        # Merge colors (first occurrence wins)
        if 'colors' in tokens:
            colors = tokens['colors']

            # Direct color mappings
            color_mappings = [
                ('background', 'background'),
                ('text', 'text.primary'),
                ('heading', 'text.secondary'),
                ('accent', 'accent'),
                ('border', 'border')
            ]

            for src_key, dest_key in color_mappings:
                if src_key in colors and colors[src_key] and colors[src_key] != 'null':
                    value = colors[src_key]
                    if validate_hex_color(value):
                        if '.' in dest_key:
                            parent, child = dest_key.split('.')
                            if merged['colors'][parent][child] is None:
                                merged['colors'][parent][child] = value
                        else:
                            if merged['colors'][dest_key] is None:
                                merged['colors'][dest_key] = value

            # Infer primary from accent if not set
            if merged['colors']['primary'] is None and 'accent' in colors:
                if colors['accent'] and validate_hex_color(colors['accent']):
                    merged['colors']['primary'] = colors['accent']

        # Merge typography
        if 'typography' in tokens:
            typo = tokens['typography']

            # Font family
            if 'fontFamily' in typo and typo['fontFamily']:
                font = typo['fontFamily']
                if isinstance(font, str) and font != 'null':
                    if merged['typography']['fontFamily']['heading'] is None:
                        merged['typography']['fontFamily']['heading'] = font
                    if merged['typography']['fontFamily']['body'] is None:
                        merged['typography']['fontFamily']['body'] = font

            # Font sizes - collect unique values
            for key in ['headingSize', 'bodySize']:
                if key in typo and typo[key] and typo[key] != 'null':
                    size = typo[key]
                    if size not in seen_sizes:
                        seen_sizes.add(size)
                        # Map to our size scale
                        if 'heading' in key.lower():
                            if '4xl' not in merged['typography']['fontSize']:
                                merged['typography']['fontSize']['4xl'] = size
                        else:
                            if 'base' not in merged['typography']['fontSize']:
                                merged['typography']['fontSize']['base'] = size

            # Font weights
            if 'fontWeight' in typo and isinstance(typo['fontWeight'], dict):
                for key, val in typo['fontWeight'].items():
                    if val and val != 'null':
                        target_key = key.lower()
                        if target_key in merged['typography']['fontWeight']:
                            if merged['typography']['fontWeight'][target_key] is None:
                                merged['typography']['fontWeight'][target_key] = val

        # Merge spacing
        if 'spacing' in tokens:
            spacing = tokens['spacing']
            if isinstance(spacing, dict):
                for key, val in spacing.items():
                    if val and val != 'null':
                        # Map section spacing to our scale
                        if 'section' in key.lower() or 'container' in key.lower():
                            if '16' not in merged['spacing']:
                                merged['spacing']['16'] = val
                        elif 'gap' in key.lower():
                            if '4' not in merged['spacing']:
                                merged['spacing']['4'] = val

        # Merge border radius
        if 'borderRadius' in tokens and tokens['borderRadius'] and tokens['borderRadius'] != 'null':
            radius = tokens['borderRadius']
            if 'md' not in merged['borderRadius']:
                merged['borderRadius']['md'] = radius

        # Merge shadows
        if 'shadow' in tokens and tokens['shadow'] and tokens['shadow'] != 'null':
            shadow = tokens['shadow']
            if 'md' not in merged['shadows']:
                merged['shadows']['md'] = shadow

        # Collect notes
        if 'notes' in tokens and isinstance(tokens['notes'], list):
            merged['notes'].extend(tokens['notes'])

    # Clean up None values
    def clean_nones(d):
        if isinstance(d, dict):
            return {k: clean_nones(v) for k, v in d.items() if v is not None}
        return d

    # Don't clean top-level structure, just nested Nones
    for key in ['colors', 'typography']:
        if key in merged:
            merged[key] = clean_nones(merged[key])

    return merged


def generate_tokens_css(tokens: Dict[str, Any]) -> str:
    """Generate tokens.css from design tokens."""
    lines = [
        "/* Design Tokens - Auto-generated */",
        "/* Edit values below to customize the design */",
        "",
        ":root {",
        "  /* Colors */",
    ]

    colors = tokens.get('colors', {})
    lines.append(f"  --color-primary: {colors.get('primary', '#2563eb')};")
    lines.append(f"  --color-secondary: {colors.get('secondary', '#64748b')};")
    lines.append(f"  --color-accent: {colors.get('accent', '#f59e0b')};")
    lines.append(f"  --color-background: {colors.get('background', '#ffffff')};")
    lines.append(f"  --color-surface: {colors.get('surface', '#f8fafc')};")

    text_colors = colors.get('text', {})
    lines.append(f"  --color-text-primary: {text_colors.get('primary', '#0f172a')};")
    lines.append(f"  --color-text-secondary: {text_colors.get('secondary', '#475569')};")
    lines.append(f"  --color-text-muted: {text_colors.get('muted', '#94a3b8')};")
    lines.append(f"  --color-border: {colors.get('border', '#e2e8f0')};")

    lines.append("")
    lines.append("  /* Typography */")

    typography = tokens.get('typography', {})
    font_family = typography.get('fontFamily', {})
    lines.append(f"  --font-heading: {font_family.get('heading', 'Inter, sans-serif')};")
    lines.append(f"  --font-body: {font_family.get('body', 'Inter, sans-serif')};")

    font_sizes = typography.get('fontSize', {})
    for key in ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl']:
        default = DEFAULT_TOKENS['typography']['fontSize'].get(key, '16px')
        lines.append(f"  --font-size-{key}: {font_sizes.get(key, default)};")

    font_weights = typography.get('fontWeight', {})
    for key in ['normal', 'medium', 'semibold', 'bold']:
        default = DEFAULT_TOKENS['typography']['fontWeight'].get(key, 400)
        lines.append(f"  --font-weight-{key}: {font_weights.get(key, default)};")

    line_heights = typography.get('lineHeight', {})
    for key in ['tight', 'normal', 'relaxed']:
        default = DEFAULT_TOKENS['typography']['lineHeight'].get(key, 1.5)
        lines.append(f"  --line-height-{key}: {line_heights.get(key, default)};")

    lines.append("")
    lines.append("  /* Spacing */")

    spacing = tokens.get('spacing', {})
    for key in ['1', '2', '3', '4', '6', '8', '12', '16']:
        default = DEFAULT_TOKENS['spacing'].get(key, '16px')
        lines.append(f"  --space-{key}: {spacing.get(key, default)};")

    lines.append("")
    lines.append("  /* Border Radius */")

    border_radius = tokens.get('borderRadius', {})
    for key in ['sm', 'md', 'lg', 'full']:
        default = DEFAULT_TOKENS['borderRadius'].get(key, '8px')
        lines.append(f"  --radius-{key}: {border_radius.get(key, default)};")

    lines.append("")
    lines.append("  /* Shadows */")

    shadows = tokens.get('shadows', {})
    for key in ['sm', 'md', 'lg']:
        default = DEFAULT_TOKENS['shadows'].get(key, '0 1px 2px rgba(0,0,0,0.05)')
        lines.append(f"  --shadow-{key}: {shadows.get(key, default)};")

    lines.append("}")
    lines.append("")

    return "\n".join(lines)


def extract_tokens(
    screenshots_dir: str,
    css_path: str = None,
    model: str = "gemini-2.5-flash",
    verbose: bool = False
) -> Dict[str, Any]:
    """Extract design tokens from screenshots using Gemini Vision.

    Args:
        screenshots_dir: Directory containing screenshots
        css_path: Optional path to filtered CSS (improves accuracy)
        model: Gemini model to use
        verbose: Enable verbose output

    Returns:
        Design tokens dictionary
    """

    api_key = get_api_key()
    if not api_key:
        if verbose:
            print("Warning: GEMINI_API_KEY not found, using default tokens")
        return DEFAULT_TOKENS.copy()

    # Load CSS if provided
    css_content = None
    if css_path and Path(css_path).exists():
        with open(css_path, 'r', encoding='utf-8') as f:
            css_content = f.read()
        if verbose:
            print(f"Loaded CSS: {len(css_content)} chars")

    # Build prompt with context
    prompt = build_extraction_prompt(css_content)

    if verbose and css_content:
        print("Using enhanced prompt with CSS context")

    # Find screenshots
    screenshots_path = Path(screenshots_dir)
    desktop = screenshots_path / "desktop.png"
    tablet = screenshots_path / "tablet.png"
    mobile = screenshots_path / "mobile.png"

    # Check which files exist
    available_images = []
    for img in [desktop, tablet, mobile]:
        if img.exists():
            available_images.append(img)
            if verbose:
                print(f"Found: {img}")

    if not available_images:
        if verbose:
            print("Warning: No screenshots found, using default tokens")
        return DEFAULT_TOKENS.copy()

    try:
        # Initialize client
        client = genai.Client(api_key=api_key)

        # Build content with images
        content = [prompt]

        for img_path in available_images:
            with open(img_path, 'rb') as f:
                img_bytes = f.read()
            content.append(
                types.Part.from_bytes(data=img_bytes, mime_type='image/png')
            )

        if verbose:
            print(f"Sending {len(available_images)} images to {model}...")

        # Request structured JSON output
        config = types.GenerateContentConfig(
            response_mime_type='application/json'
        )

        response = client.models.generate_content(
            model=model,
            contents=content,
            config=config
        )

        # Parse response
        if hasattr(response, 'text') and response.text:
            tokens = json.loads(response.text)

            # Validate
            is_valid, errors = validate_tokens(tokens)
            if not is_valid:
                if verbose:
                    print(f"Validation warnings: {errors}")
                tokens['notes'] = tokens.get('notes', []) + errors

            # Merge with defaults for missing values
            tokens = merge_with_defaults(tokens)

            if verbose:
                print("Tokens extracted successfully")

            return tokens
        else:
            if verbose:
                print("Warning: Empty response, using default tokens")
            return DEFAULT_TOKENS.copy()

    except Exception as e:
        if verbose:
            print(f"Error during extraction: {e}")

        # Return defaults with error note
        tokens = DEFAULT_TOKENS.copy()
        tokens['notes'] = [f"Extraction failed: {str(e)}"]
        return tokens


def main():
    parser = argparse.ArgumentParser(
        description="Extract design tokens from screenshots using Gemini Vision"
    )
    parser.add_argument(
        '--screenshots', '-s',
        required=True,
        help='Directory containing screenshots (desktop.png, tablet.png, mobile.png)'
    )
    parser.add_argument(
        '--output', '-o',
        required=True,
        help='Output directory for design-tokens.json and tokens.css'
    )
    parser.add_argument(
        '--css',
        default=None,
        help='Path to filtered CSS file for exact token extraction (optional)'
    )
    parser.add_argument(
        '--model', '-m',
        default='gemini-2.5-flash',
        help='Gemini model to use (default: gemini-2.5-flash)'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    parser.add_argument(
        '--section-mode',
        action='store_true',
        help='Analyze sections instead of viewports (looks for sections/*.png)'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=1.0,
        help='Delay between API calls in seconds (default: 1.0)'
    )

    args = parser.parse_args()

    # Create output directory
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)

    # Section mode: analyze each section separately
    if args.section_mode:
        sections_dir = Path(args.screenshots) / 'sections'
        if not sections_dir.exists():
            print(json.dumps({
                "success": False,
                "error": f"Sections directory not found: {sections_dir}",
                "hint": "Run screenshot.js with --section-mode true first"
            }, indent=2))
            sys.exit(1)

        section_files = sorted(sections_dir.glob('section-*.png'))
        if not section_files:
            print(json.dumps({
                "success": False,
                "error": "No section images found in sections/ directory"
            }, indent=2))
            sys.exit(1)

        # Limit sections to avoid excessive API calls
        MAX_SECTIONS = 15
        if len(section_files) > MAX_SECTIONS:
            if args.verbose:
                print(f"Warning: Limiting to {MAX_SECTIONS} sections (found {len(section_files)})", file=sys.stderr)
            section_files = section_files[:MAX_SECTIONS]

        if args.verbose:
            print(f"Found {len(section_files)} sections to analyze", file=sys.stderr)

        # Check API key
        api_key = get_api_key()
        if not api_key:
            print(json.dumps({
                "success": False,
                "error": "GEMINI_API_KEY not set",
                "hint": "Set GEMINI_API_KEY environment variable"
            }, indent=2))
            sys.exit(1)

        # Load CSS if provided
        css_content = None
        if args.css and Path(args.css).exists():
            with open(args.css, 'r', encoding='utf-8') as f:
                css_content = f.read()
            if args.verbose:
                print(f"Loaded CSS: {len(css_content)} chars", file=sys.stderr)

        # Initialize client
        client = genai.Client(api_key=api_key)

        # Create section-analysis directory
        section_output_dir = output_path / 'section-analysis'
        section_output_dir.mkdir(exist_ok=True)

        # Process each section
        section_results = []
        for i, section_path in enumerate(section_files):
            if args.verbose:
                print(f"[{i+1}/{len(section_files)}] Analyzing {section_path.name}...", file=sys.stderr)

            tokens = extract_section_tokens(
                str(section_path),
                css_content,
                client,
                args.model,
                args.verbose
            )
            section_results.append(tokens)

            # Save individual section result
            section_out_path = section_output_dir / f'{section_path.stem}-tokens.json'
            with open(section_out_path, 'w') as f:
                json.dump(tokens, f, indent=2)

            # Rate limiting delay (except for last section)
            if i < len(section_files) - 1:
                time.sleep(args.delay)

        if args.verbose:
            print(f"Merging tokens from {len(section_results)} sections...", file=sys.stderr)

        # Merge all section tokens
        merged_tokens = merge_section_tokens(section_results)

        # Merge with defaults for complete token set
        tokens = merge_with_defaults(merged_tokens)
        tokens['_mode'] = 'section'
        tokens['_sections'] = merged_tokens.get('_sections', [])
        tokens['_sectionCount'] = merged_tokens.get('_sectionCount', 0)

    else:
        # Standard mode: analyze viewport screenshots
        tokens = extract_tokens(
            screenshots_dir=args.screenshots,
            css_path=args.css,
            model=args.model,
            verbose=args.verbose
        )
        tokens['_mode'] = 'viewport'

    # Save design-tokens.json
    json_path = output_path / "design-tokens.json"
    with open(json_path, 'w') as f:
        json.dump(tokens, f, indent=2)

    if args.verbose:
        print(f"Saved: {json_path}", file=sys.stderr)

    # Generate and save tokens.css
    css_output = generate_tokens_css(tokens)
    css_path = output_path / "tokens.css"
    with open(css_path, 'w') as f:
        f.write(css_output)

    if args.verbose:
        print(f"Saved: {css_path}", file=sys.stderr)

    # Output result as JSON
    result = {
        "success": True,
        "tokens_json": str(json_path),
        "tokens_css": str(css_path),
        "model": args.model,
        "mode": tokens.get('_mode', 'viewport'),
        "notes": tokens.get('notes', [])
    }

    # Add section info if in section mode
    if args.section_mode:
        result["section_analysis"] = str(section_output_dir)
        result["sections_processed"] = len(section_results)

    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
