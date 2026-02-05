#!/usr/bin/env python3
"""
Generate HTML with Tailwind CSS classes from Figma nodes and design tokens.

Usage:
    python generate-tailwind.py --nodes figma-nodes.json --tokens design-tokens.json --output ./output

Output:
    - index.html: HTML with Tailwind utility classes
"""

import argparse
import html
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Add parent to path for imports
SCRIPT_DIR = Path(__file__).parent.resolve()
SRC_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(SRC_DIR))

MAX_NODE_COUNT_WARNING = 500

# =============================================================================
# Tailwind Mapping Tables
# =============================================================================

# Spacing scale (Tailwind default)
SPACING_SCALE = {
    0: '0', 1: 'px', 2: '0.5', 4: '1', 6: '1.5', 8: '2', 10: '2.5',
    12: '3', 14: '3.5', 16: '4', 20: '5', 24: '6', 28: '7', 32: '8',
    36: '9', 40: '10', 44: '11', 48: '12', 52: '13', 56: '14', 60: '15',
    64: '16', 72: '18', 80: '20', 96: '24', 112: '28', 128: '32',
    144: '36', 160: '40', 176: '44', 192: '48', 208: '52', 224: '56',
    240: '60', 256: '64', 288: '72', 320: '80', 384: '96'
}

# Font size scale
FONT_SIZE_SCALE = {
    12: 'xs', 14: 'sm', 16: 'base', 18: 'lg', 20: 'xl',
    24: '2xl', 30: '3xl', 36: '4xl', 48: '5xl', 60: '6xl',
    72: '7xl', 96: '8xl', 128: '9xl'
}

# Font weight scale
FONT_WEIGHT_SCALE = {
    100: 'thin', 200: 'extralight', 300: 'light', 400: 'normal',
    500: 'medium', 600: 'semibold', 700: 'bold', 800: 'extrabold', 900: 'black'
}

# Border radius scale
BORDER_RADIUS_SCALE = {
    0: 'none', 2: 'sm', 4: 'DEFAULT', 6: 'md', 8: 'lg',
    12: 'xl', 16: '2xl', 24: '3xl', 9999: 'full'
}

# Common Tailwind colors (for matching)
TAILWIND_COLORS = {
    '#000000': 'black', '#ffffff': 'white',
    '#f8fafc': 'slate-50', '#f1f5f9': 'slate-100', '#e2e8f0': 'slate-200',
    '#cbd5e1': 'slate-300', '#94a3b8': 'slate-400', '#64748b': 'slate-500',
    '#475569': 'slate-600', '#334155': 'slate-700', '#1e293b': 'slate-800',
    '#0f172a': 'slate-900',
    '#f9fafb': 'gray-50', '#f3f4f6': 'gray-100', '#e5e7eb': 'gray-200',
    '#d1d5db': 'gray-300', '#9ca3af': 'gray-400', '#6b7280': 'gray-500',
    '#4b5563': 'gray-600', '#374151': 'gray-700', '#1f2937': 'gray-800',
    '#111827': 'gray-900',
    '#fef2f2': 'red-50', '#fee2e2': 'red-100', '#fecaca': 'red-200',
    '#fca5a5': 'red-300', '#f87171': 'red-400', '#ef4444': 'red-500',
    '#dc2626': 'red-600', '#b91c1c': 'red-700', '#991b1b': 'red-800',
    '#eff6ff': 'blue-50', '#dbeafe': 'blue-100', '#bfdbfe': 'blue-200',
    '#93c5fd': 'blue-300', '#60a5fa': 'blue-400', '#3b82f6': 'blue-500',
    '#2563eb': 'blue-600', '#1d4ed8': 'blue-700', '#1e40af': 'blue-800',
    '#ecfdf5': 'green-50', '#d1fae5': 'green-100', '#a7f3d0': 'green-200',
    '#6ee7b7': 'green-300', '#34d399': 'green-400', '#10b981': 'green-500',
    '#059669': 'green-600', '#047857': 'green-700', '#065f46': 'green-800',
}


def rgba_to_hex(rgba: Dict[str, float]) -> str:
    """Convert RGBA dict to hex color."""
    r = int(rgba.get('r', 0) * 255)
    g = int(rgba.get('g', 0) * 255)
    b = int(rgba.get('b', 0) * 255)
    return f"#{r:02x}{g:02x}{b:02x}"


def escape_text(text: str) -> str:
    """Escape HTML special characters."""
    return html.escape(text) if text else ''


def map_spacing(value: float, prefix: str = '') -> str:
    """Map pixel value to Tailwind spacing class."""
    rounded = round(value)
    if rounded in SPACING_SCALE:
        return f"{prefix}{SPACING_SCALE[rounded]}"
    # Use arbitrary value
    return f"{prefix}[{rounded}px]"


def map_font_size(size: float) -> str:
    """Map font size to Tailwind class."""
    rounded = round(size)
    if rounded in FONT_SIZE_SCALE:
        return f"text-{FONT_SIZE_SCALE[rounded]}"
    # Find closest
    closest = min(FONT_SIZE_SCALE.keys(), key=lambda x: abs(x - rounded))
    if abs(closest - rounded) <= 2:
        return f"text-{FONT_SIZE_SCALE[closest]}"
    return f"text-[{rounded}px]"


def map_font_weight(weight: int) -> str:
    """Map font weight to Tailwind class."""
    if weight in FONT_WEIGHT_SCALE:
        return f"font-{FONT_WEIGHT_SCALE[weight]}"
    closest = min(FONT_WEIGHT_SCALE.keys(), key=lambda x: abs(x - weight))
    return f"font-{FONT_WEIGHT_SCALE[closest]}"


def map_border_radius(value: float) -> str:
    """Map border radius to Tailwind class."""
    rounded = round(value)
    if rounded == 0:
        return 'rounded-none'
    if rounded >= 9999:
        return 'rounded-full'
    if rounded in BORDER_RADIUS_SCALE:
        suffix = BORDER_RADIUS_SCALE[rounded]
        return f"rounded-{suffix}" if suffix != 'DEFAULT' else 'rounded'
    # Find closest
    closest = min(BORDER_RADIUS_SCALE.keys(), key=lambda x: abs(x - rounded))
    if abs(closest - rounded) <= 2:
        suffix = BORDER_RADIUS_SCALE[closest]
        return f"rounded-{suffix}" if suffix != 'DEFAULT' else 'rounded'
    return f"rounded-[{rounded}px]"


def map_color(hex_color: str, prefix: str = 'bg') -> str:
    """Map hex color to Tailwind color class."""
    hex_lower = hex_color.lower()
    if hex_lower in TAILWIND_COLORS:
        return f"{prefix}-{TAILWIND_COLORS[hex_lower]}"
    return f"{prefix}-[{hex_color}]"


def get_semantic_tag(node: Dict) -> str:
    """Determine semantic HTML tag from node type and name."""
    name = node.get('name', '').lower()
    node_type = node.get('type', '')

    if node_type == 'TEXT':
        if any(h in name for h in ['heading', 'title', 'h1', 'h2', 'h3']):
            if 'h1' in name or 'main' in name:
                return 'h1'
            elif 'h2' in name or 'sub' in name:
                return 'h2'
            return 'h2'
        if 'paragraph' in name or 'body' in name:
            return 'p'
        if 'link' in name:
            return 'a'
        return 'span'

    if 'header' in name:
        return 'header'
    if 'footer' in name:
        return 'footer'
    if 'nav' in name or 'menu' in name:
        return 'nav'
    if 'section' in name:
        return 'section'
    if 'article' in name or 'card' in name:
        return 'article'
    if 'aside' in name or 'sidebar' in name:
        return 'aside'
    if 'button' in name or 'btn' in name or 'cta' in name:
        return 'button'
    if 'input' in name or 'field' in name:
        return 'input'
    if 'image' in name or 'img' in name:
        return 'figure'
    if 'list' in name:
        return 'ul'
    if 'item' in name:
        return 'li'
    if 'form' in name:
        return 'form'

    return 'div'


def node_to_tailwind_classes(node: Dict) -> List[str]:
    """Convert Figma node properties to Tailwind classes."""
    classes = []

    # Layout (Auto Layout / Flexbox)
    layout_mode = node.get('layoutMode')
    if layout_mode == 'HORIZONTAL':
        classes.append('flex')
        classes.append('flex-row')
    elif layout_mode == 'VERTICAL':
        classes.append('flex')
        classes.append('flex-col')

    # Alignment
    primary_align = node.get('primaryAxisAlignItems')
    counter_align = node.get('counterAxisAlignItems')

    if primary_align:
        align_map = {
            'MIN': 'justify-start', 'CENTER': 'justify-center',
            'MAX': 'justify-end', 'SPACE_BETWEEN': 'justify-between'
        }
        if primary_align in align_map:
            classes.append(align_map[primary_align])

    if counter_align:
        align_map = {'MIN': 'items-start', 'CENTER': 'items-center', 'MAX': 'items-end'}
        if counter_align in align_map:
            classes.append(align_map[counter_align])

    # Gap
    if 'itemSpacing' in node:
        classes.append(map_spacing(node['itemSpacing'], 'gap-'))

    # Padding
    pt = node.get('paddingTop', 0)
    pr = node.get('paddingRight', 0)
    pb = node.get('paddingBottom', 0)
    pl = node.get('paddingLeft', 0)

    if pt == pr == pb == pl and pt > 0:
        classes.append(map_spacing(pt, 'p-'))
    else:
        if pt == pb and pt > 0:
            classes.append(map_spacing(pt, 'py-'))
        else:
            if pt > 0:
                classes.append(map_spacing(pt, 'pt-'))
            if pb > 0:
                classes.append(map_spacing(pb, 'pb-'))
        if pl == pr and pl > 0:
            classes.append(map_spacing(pl, 'px-'))
        else:
            if pl > 0:
                classes.append(map_spacing(pl, 'pl-'))
            if pr > 0:
                classes.append(map_spacing(pr, 'pr-'))

    # Size (use w-full for responsive, or specific width)
    abs_box = node.get('absoluteBoundingBox', {})
    constraints = node.get('constraints', {})

    # Only set explicit dimensions for fixed layouts
    if constraints.get('horizontal') == 'FIXED' and abs_box.get('width'):
        classes.append(f"w-[{round(abs_box['width'])}px]")
    if constraints.get('vertical') == 'FIXED' and abs_box.get('height'):
        classes.append(f"h-[{round(abs_box['height'])}px]")

    # Background (skip for TEXT nodes - fills represent text color)
    node_type = node.get('type', '')
    fills = node.get('fills', [])
    if node_type != 'TEXT':
        for fill in fills:
            if fill.get('visible', True) and fill.get('type') == 'SOLID':
                color = rgba_to_hex(fill.get('color', {}))
                classes.append(map_color(color, 'bg'))
                opacity = fill.get('opacity', 1)
                if opacity < 1:
                    opacity_pct = round(opacity * 100)
                    classes.append(f"bg-opacity-{opacity_pct}")
                break

    # Border radius
    if 'cornerRadius' in node:
        classes.append(map_border_radius(node['cornerRadius']))

    # Strokes (borders)
    strokes = node.get('strokes', [])
    stroke_weight = node.get('strokeWeight', 0)
    if strokes and stroke_weight:
        for stroke in strokes:
            if stroke.get('visible', True) and stroke.get('type') == 'SOLID':
                color = rgba_to_hex(stroke.get('color', {}))
                # Border width
                if stroke_weight == 1:
                    classes.append('border')
                else:
                    classes.append(f"border-{round(stroke_weight)}")
                classes.append(map_color(color, 'border'))
                break

    # Effects (shadows)
    effects = node.get('effects', [])
    for effect in effects:
        if effect.get('visible', True) and effect.get('type') == 'DROP_SHADOW':
            blur = effect.get('radius', 0)
            if blur <= 3:
                classes.append('shadow-sm')
            elif blur <= 6:
                classes.append('shadow')
            elif blur <= 15:
                classes.append('shadow-md')
            elif blur <= 25:
                classes.append('shadow-lg')
            else:
                classes.append('shadow-xl')
            break

    # Typography
    style = node.get('style', {})
    if style:
        if style.get('fontSize'):
            classes.append(map_font_size(style['fontSize']))
        if style.get('fontWeight'):
            classes.append(map_font_weight(style['fontWeight']))
        if style.get('textAlignHorizontal'):
            align_map = {'LEFT': 'text-left', 'CENTER': 'text-center', 'RIGHT': 'text-right'}
            if style['textAlignHorizontal'] in align_map:
                classes.append(align_map[style['textAlignHorizontal']])
        if style.get('lineHeightPx') and style.get('fontSize'):
            ratio = style['lineHeightPx'] / style['fontSize']
            if ratio <= 1:
                classes.append('leading-none')
            elif ratio <= 1.25:
                classes.append('leading-tight')
            elif ratio <= 1.5:
                classes.append('leading-snug')
            elif ratio <= 1.625:
                classes.append('leading-normal')
            elif ratio <= 1.75:
                classes.append('leading-relaxed')
            else:
                classes.append('leading-loose')

    # Text color
    if node.get('type') == 'TEXT' and fills:
        for fill in fills:
            if fill.get('visible', True) and fill.get('type') == 'SOLID':
                color = rgba_to_hex(fill.get('color', {}))
                classes.append(map_color(color, 'text'))
                break

    return classes


def traverse_nodes(
    node: Dict,
    depth: int = 0,
    max_depth: int = 20
) -> List[str]:
    """
    Traverse Figma node tree and generate HTML with Tailwind classes.

    Returns:
        List of HTML lines
    """
    if depth > max_depth:
        return []

    html_lines = []
    node_type = node.get('type', '')

    # Skip invisible nodes
    if not node.get('visible', True):
        return []

    # Get semantic tag
    tag = get_semantic_tag(node)

    # Generate Tailwind classes
    classes = node_to_tailwind_classes(node)
    class_str = ' '.join(classes) if classes else ''

    # Get children
    children = node.get('children', [])

    # Build HTML
    indent = '  ' * depth

    if node_type == 'TEXT':
        text = escape_text(node.get('characters', ''))
        if class_str:
            html_lines.append(f'{indent}<{tag} class="{class_str}">{text}</{tag}>')
        else:
            html_lines.append(f'{indent}<{tag}>{text}</{tag}>')
    elif children:
        if class_str:
            html_lines.append(f'{indent}<{tag} class="{class_str}">')
        else:
            html_lines.append(f'{indent}<{tag}>')

        for child in children:
            child_html = traverse_nodes(child, depth=depth + 1, max_depth=max_depth)
            html_lines.extend(child_html)

        html_lines.append(f'{indent}</{tag}>')
    else:
        if tag in ('img', 'input', 'br', 'hr'):
            if class_str:
                html_lines.append(f'{indent}<{tag} class="{class_str}" />')
            else:
                html_lines.append(f'{indent}<{tag} />')
        else:
            if class_str:
                html_lines.append(f'{indent}<{tag} class="{class_str}"></{tag}>')
            else:
                html_lines.append(f'{indent}<{tag}></{tag}>')

    return html_lines


def generate_html_document(body_html: str) -> str:
    """Generate complete HTML document with Tailwind CDN."""
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Figma Design</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="stylesheet" href="tokens.css">
</head>
<body>
{body_html}
</body>
</html>
'''


def main():
    parser = argparse.ArgumentParser(description='Generate HTML with Tailwind from Figma nodes')
    parser.add_argument('--nodes', '-n', required=True, help='Path to figma-nodes.json')
    parser.add_argument('--tokens', '-t', required=True, help='Path to design-tokens.json')
    parser.add_argument('--output', '-o', required=True, help='Output directory')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose output')

    args = parser.parse_args()

    # Load nodes
    nodes_path = Path(args.nodes)
    if not nodes_path.exists():
        print(json.dumps({'success': False, 'error': f'Nodes file not found: {args.nodes}'}))
        sys.exit(1)

    with open(nodes_path, 'r', encoding='utf-8') as f:
        nodes_data = json.load(f)

    # Find root node(s)
    root_nodes = []
    if isinstance(nodes_data, dict):
        if 'document' in nodes_data:
            doc = nodes_data['document']
            if 'children' in doc:
                root_nodes = doc['children']
        elif 'nodes' in nodes_data:
            for node_id, node_data in nodes_data['nodes'].items():
                if node_data and 'document' in node_data:
                    root_nodes.append(node_data['document'])
        elif 'children' in nodes_data:
            root_nodes = nodes_data['children']
        else:
            root_nodes = [nodes_data]

    if not root_nodes:
        print(json.dumps({'success': False, 'error': 'No valid nodes found in input'}))
        sys.exit(1)

    # Count nodes and warn if large
    def count_nodes(node):
        count = 1
        for child in node.get('children', []):
            count += count_nodes(child)
        return count

    total_nodes = sum(count_nodes(r) for r in root_nodes)
    if total_nodes > MAX_NODE_COUNT_WARNING:
        print(f"Warning: {total_nodes} nodes found. Large files may be slow.", file=sys.stderr)

    # Generate HTML
    all_html = []
    for root in root_nodes:
        html_lines = traverse_nodes(root, depth=0)
        all_html.extend(html_lines)

    # Create output directory
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Write HTML
    body_html = '\n'.join(all_html)
    html_doc = generate_html_document(body_html)
    html_path = output_dir / 'index.html'
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_doc)

    # Copy tokens.css if exists
    tokens_css_src = output_dir / 'analysis' / 'tokens.css'
    if not tokens_css_src.exists():
        tokens_path = Path(args.tokens)
        tokens_css_src = tokens_path.parent / 'tokens.css'

    if tokens_css_src.exists():
        import shutil
        shutil.copy(tokens_css_src, output_dir / 'tokens.css')

    # Count Tailwind classes used
    class_count = body_html.count('class="')

    # Output result
    result = {
        'success': True,
        'mode': 'tailwind',
        'output': {
            'html': str(html_path),
            'tokens': str(output_dir / 'tokens.css')
        },
        'stats': {
            'html_lines': len(all_html),
            'elements_with_classes': class_count
        }
    }

    if args.verbose:
        print(f"Generated {result['stats']['html_lines']} HTML lines", file=sys.stderr)
        print(f"Elements with Tailwind classes: {result['stats']['elements_with_classes']}", file=sys.stderr)

    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
