#!/usr/bin/env python3
"""
Analyze website screenshot structure using Gemini Vision API.

Usage:
  python analyze-structure.py --screenshot ./analysis/desktop.png --output ./analysis
  python analyze-structure.py -s desktop.png -o ./out --html source.html --css source.css

Options:
  --screenshot   Path to desktop screenshot
  --output       Output directory for structure.md
  --html         Path to source HTML file (optional, improves accuracy)
  --css          Path to filtered CSS file (optional, improves accuracy)
  --model        Gemini model (default: gemini-2.5-flash)
  --verbose      Enable verbose output

Output:
  - structure.md: Markdown description of page structure

When HTML/CSS provided, extracts EXACT values from source instead of estimating.
"""

import argparse
import json
import os
import sys
from pathlib import Path

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
from prompts.structure_analysis import build_structure_prompt


# Fallback structure when analysis fails
DEFAULT_STRUCTURE = """# Page Structure Analysis

## 1. Header Section
- Logo: Left-aligned, text-based
- Navigation: Horizontal, 4-5 items
- CTA Button: Right-aligned, primary color
- Mobile menu: Hamburger icon for small screens

## 2. Hero Section
- Layout: Centered
- Headline: Large (36-48px), bold, dark text
- Subheadline: Medium (18-20px), lighter text
- Primary CTA: Prominent button, primary color
- Background: Solid light color

## 3. Content Sections
### Features Section
- Layout: 3-column grid
- Items: 3 feature cards with icons
- Components: Icon + heading + description

### About/Info Section
- Layout: 2-column (text + image)
- Alternating left-right pattern

## 4. Footer Section
- Layout: 4-column grid
- Content: Logo, nav links, contact, social icons
- Copyright: Centered at bottom

## 5. Global Patterns
- Container max-width: 1200px
- Section padding: 64px vertical
- Card style: Subtle shadows, 8px border-radius
- Color scheme: Light mode
- Typography: Sans-serif (modern)

## 6. Responsive Hints
- Navigation collapses to hamburger on mobile
- Grid sections stack vertically
- Padding reduces on smaller screens

## 7. BEM Class Suggestions
- header, header__container, header__logo, header__nav, header__cta
- hero, hero__container, hero__title, hero__subtitle, hero__cta
- features, features__grid, feature-card, feature-card__icon, feature-card__title
- footer, footer__container, footer__column, footer__links
"""


def get_api_key():
    """Get Gemini API key from environment (supports GEMINI_API_KEY or GOOGLE_API_KEY)."""
    return resolve_env('GEMINI_API_KEY') or resolve_env('GOOGLE_API_KEY')


def load_dimensions(output_dir: str) -> dict:
    """Load extracted dimensions summary if available.

    Args:
        output_dir: Directory containing dimensions-summary.json

    Returns:
        Dimensions dict or None if not found
    """
    summary_path = Path(output_dir) / "dimensions-summary.json"
    if summary_path.exists():
        try:
            with open(summary_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Failed to load dimensions: {e}", file=sys.stderr)
    return None


def load_dom_hierarchy(output_dir: str) -> dict:
    """Load extracted DOM hierarchy if available.

    Args:
        output_dir: Directory containing dom-hierarchy.json

    Returns:
        Hierarchy dict or None if not found
    """
    hierarchy_path = Path(output_dir) / "dom-hierarchy.json"
    if hierarchy_path.exists():
        try:
            with open(hierarchy_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Failed to load DOM hierarchy: {e}", file=sys.stderr)
    return None


def load_content_counts(output_dir: str) -> tuple:
    """Load content counts and summary if available.

    Args:
        output_dir: Directory containing content-counts.json and content-summary.md

    Returns:
        Tuple of (counts_dict, summary_text) or (None, None) if not found
    """
    counts_path = Path(output_dir) / "content-counts.json"
    summary_path = Path(output_dir) / "content-summary.md"

    counts = None
    summary = None

    if counts_path.exists():
        try:
            with open(counts_path, 'r', encoding='utf-8') as f:
                counts = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Failed to load content counts: {e}", file=sys.stderr)

    if summary_path.exists():
        try:
            with open(summary_path, 'r', encoding='utf-8') as f:
                summary = f.read()
        except IOError as e:
            print(f"Warning: Failed to load content summary: {e}", file=sys.stderr)

    return counts, summary


def analyze_structure(
    screenshot_path: str,
    output_dir: str = None,
    html_path: str = None,
    css_path: str = None,
    model: str = "gemini-2.5-flash",
    verbose: bool = False
) -> str:
    """Analyze screenshot structure using Gemini Vision.

    Args:
        screenshot_path: Path to desktop screenshot
        output_dir: Output directory (also reads dimensions-summary.json if present)
        html_path: Optional path to source HTML (improves accuracy)
        css_path: Optional path to filtered CSS (improves accuracy)
        model: Gemini model to use
        verbose: Enable verbose output

    Returns:
        Markdown structure analysis
    """

    api_key = get_api_key()
    if not api_key:
        if verbose:
            print("Warning: GEMINI_API_KEY not found, using default structure")
        return DEFAULT_STRUCTURE

    screenshot = Path(screenshot_path)
    if not screenshot.exists():
        if verbose:
            print(f"Warning: Screenshot not found: {screenshot_path}")
        return DEFAULT_STRUCTURE

    # Load extracted dimensions if available (highest priority)
    dimensions = None
    if output_dir:
        dimensions = load_dimensions(output_dir)
        if dimensions and verbose:
            print(f"Loaded extracted dimensions from {output_dir}/dimensions-summary.json")

    # Load DOM hierarchy if available (enhances dimensions)
    hierarchy = None
    if output_dir:
        hierarchy = load_dom_hierarchy(output_dir)
        if hierarchy and verbose:
            stats = hierarchy.get('stats', {})
            print(f"Loaded DOM hierarchy: {stats.get('totalNodes', 0)} nodes, depth {stats.get('maxDepth', 0)}")

    # Load content counts if available
    content_counts, content_summary = None, None
    if output_dir:
        content_counts, content_summary = load_content_counts(output_dir)
        if content_counts and verbose:
            print(f"Loaded content counts: {content_counts.get('summary', {}).get('totalRepeatedItems', 0)} items")

    # Load HTML/CSS if provided
    html_content = None
    css_content = None

    if html_path and Path(html_path).exists():
        with open(html_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        if verbose:
            print(f"Loaded HTML: {len(html_content)} chars")

    if css_path and Path(css_path).exists():
        with open(css_path, 'r', encoding='utf-8') as f:
            css_content = f.read()
        if verbose:
            print(f"Loaded CSS: {len(css_content)} chars")

    # Build prompt with context (hierarchy+dimensions have highest priority)
    prompt = build_structure_prompt(html_content, css_content, dimensions, content_summary, hierarchy)

    if verbose:
        if hierarchy and dimensions:
            print("Using HIERARCHY prompt with DOM structure + EXACT dimensions")
        elif dimensions:
            print("Using ENHANCED prompt with EXACT extracted dimensions")
        if content_summary:
            print("Using prompt with EXACT content counts")
        elif html_content and css_content:
            print("Using prompt with HTML/CSS context")

    try:
        client = genai.Client(api_key=api_key)

        # Load image
        with open(screenshot, 'rb') as f:
            img_bytes = f.read()

        content = [
            prompt,
            types.Part.from_bytes(data=img_bytes, mime_type='image/png')
        ]

        if verbose:
            print(f"Analyzing structure with {model}...")

        response = client.models.generate_content(
            model=model,
            contents=content
        )

        if hasattr(response, 'text') and response.text:
            if verbose:
                print("Structure analysis complete")
            return response.text
        else:
            if verbose:
                print("Warning: Empty response, using default structure")
            return DEFAULT_STRUCTURE

    except Exception as e:
        if verbose:
            print(f"Error during analysis: {e}")
        return DEFAULT_STRUCTURE


def main():
    parser = argparse.ArgumentParser(
        description="Analyze website screenshot structure using Gemini Vision"
    )
    parser.add_argument(
        '--screenshot', '-s',
        required=True,
        help='Path to desktop screenshot'
    )
    parser.add_argument(
        '--output', '-o',
        required=True,
        help='Output directory for structure.md (also reads dimensions-summary.json if present)'
    )
    parser.add_argument(
        '--html',
        default=None,
        help='Path to source HTML file (optional, improves accuracy)'
    )
    parser.add_argument(
        '--css',
        default=None,
        help='Path to filtered CSS file (optional, improves accuracy)'
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

    args = parser.parse_args()

    # Create output directory
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)

    # Analyze structure (dimensions loaded automatically from output_dir)
    structure = analyze_structure(
        screenshot_path=args.screenshot,
        output_dir=args.output,
        html_path=args.html,
        css_path=args.css,
        model=args.model,
        verbose=args.verbose
    )

    # Save structure.md
    md_path = output_path / "structure.md"
    with open(md_path, 'w') as f:
        f.write(structure)

    if args.verbose:
        print(f"Saved: {md_path}")

    # Output result as JSON
    result = {
        "success": True,
        "structure_file": str(md_path),
        "model": args.model
    }

    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
