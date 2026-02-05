#!/usr/bin/env python3
"""
Generate HTML with BEM CSS from Figma nodes and design tokens.

Usage:
    python generate-css.py --nodes figma-nodes.json --tokens design-tokens.json --output ./output

Output:
    - index.html: Semantic HTML with BEM classes
    - styles.css: BEM CSS using design tokens
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


MAX_CLASS_NAME_LENGTH = 60
MAX_NODE_COUNT_WARNING = 500


def sanitize_class_name(name: str) -> str:
    """Convert node name to valid BEM class name."""
    # Remove special characters, convert spaces/underscores to hyphens
    clean = re.sub(r'[^a-zA-Z0-9\s_-]', '', name)
    clean = re.sub(r'[\s_]+', '-', clean).lower().strip('-')
    # Ensure doesn't start with number
    if clean and clean[0].isdigit():
        clean = 'n' + clean
    # Limit length to prevent invalid CSS selectors
    clean = clean[:MAX_CLASS_NAME_LENGTH]
    return clean or 'element'


def escape_text(text: str) -> str:
    """Escape HTML special characters."""
    return html.escape(text) if text else ''


def rgba_to_hex(rgba: Dict[str, float]) -> str:
    """Convert RGBA dict to hex color."""
    r = int(rgba.get('r', 0) * 255)
    g = int(rgba.get('g', 0) * 255)
    b = int(rgba.get('b', 0) * 255)
    return f"#{r:02x}{g:02x}{b:02x}"


def get_semantic_tag(node: Dict) -> str:
    """Determine semantic HTML tag from node type and name."""
    name = node.get('name', '').lower()
    node_type = node.get('type', '')

    # Text nodes
    if node_type == 'TEXT':
        # Check for heading patterns
        if any(h in name for h in ['heading', 'title', 'h1', 'h2', 'h3']):
            if 'h1' in name or 'main' in name:
                return 'h1'
            elif 'h2' in name or 'sub' in name:
                return 'h2'
            elif 'h3' in name:
                return 'h3'
            return 'h2'
        if 'paragraph' in name or 'body' in name or 'text' in name:
            return 'p'
        if 'label' in name:
            return 'label'
        if 'link' in name:
            return 'a'
        return 'span'

    # Container nodes
    if 'header' in name:
        return 'header'
    if 'footer' in name:
        return 'footer'
    if 'nav' in name or 'menu' in name:
        return 'nav'
    if 'section' in name:
        return 'section'
    if 'article' in name or 'post' in name:
        return 'article'
    if 'aside' in name or 'sidebar' in name:
        return 'aside'
    if 'main' in name and 'content' in name:
        return 'main'
    if 'button' in name or 'btn' in name or 'cta' in name:
        return 'button'
    if 'input' in name or 'field' in name:
        return 'input'
    if 'image' in name or 'img' in name or 'photo' in name:
        return 'figure'
    if 'list' in name:
        return 'ul'
    if 'item' in name:
        return 'li'
    if 'card' in name:
        return 'article'
    if 'form' in name:
        return 'form'

    return 'div'


def node_to_css(node: Dict, class_name: str, tokens: Dict) -> List[str]:
    """Generate CSS rules for a node."""
    rules = []

    # Layout (Auto Layout / Flexbox)
    layout_mode = node.get('layoutMode')
    if layout_mode == 'HORIZONTAL':
        rules.append('display: flex')
        rules.append('flex-direction: row')
    elif layout_mode == 'VERTICAL':
        rules.append('display: flex')
        rules.append('flex-direction: column')

    # Alignment
    primary_align = node.get('primaryAxisAlignItems')
    counter_align = node.get('counterAxisAlignItems')

    if primary_align:
        align_map = {
            'MIN': 'flex-start', 'CENTER': 'center',
            'MAX': 'flex-end', 'SPACE_BETWEEN': 'space-between'
        }
        rules.append(f"justify-content: {align_map.get(primary_align, 'flex-start')}")

    if counter_align:
        align_map = {'MIN': 'flex-start', 'CENTER': 'center', 'MAX': 'flex-end'}
        rules.append(f"align-items: {align_map.get(counter_align, 'stretch')}")

    # Gap / Item Spacing
    if 'itemSpacing' in node:
        rules.append(f"gap: {node['itemSpacing']}px")

    # Padding
    padding_parts = []
    for side in ['Top', 'Right', 'Bottom', 'Left']:
        key = f'padding{side}'
        if key in node:
            padding_parts.append(f"{node[key]}px")
    if padding_parts:
        if len(set(padding_parts)) == 1:
            rules.append(f"padding: {padding_parts[0]}")
        else:
            rules.append(f"padding: {' '.join(padding_parts)}")

    # Size constraints
    abs_box = node.get('absoluteBoundingBox', {})
    if abs_box.get('width'):
        rules.append(f"width: {abs_box['width']}px")
    if abs_box.get('height'):
        rules.append(f"height: {abs_box['height']}px")

    # Background (skip for TEXT nodes - fills represent text color)
    node_type = node.get('type', '')
    fills = node.get('fills', [])
    if node_type != 'TEXT':
        for fill in fills:
            if fill.get('visible', True) and fill.get('type') == 'SOLID':
                color = rgba_to_hex(fill.get('color', {}))
                opacity = fill.get('opacity', 1)
                if opacity < 1:
                    rules.append(f"background-color: {color}")
                    rules.append(f"opacity: {opacity:.2f}")
                else:
                    rules.append(f"background-color: {color}")
                break

    # Border radius
    if 'cornerRadius' in node:
        rules.append(f"border-radius: {node['cornerRadius']}px")
    elif any(f'cornerRadius{c}' in node for c in ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft']):
        corners = [
            node.get('cornerRadiusTopLeft', 0),
            node.get('cornerRadiusTopRight', 0),
            node.get('cornerRadiusBottomRight', 0),
            node.get('cornerRadiusBottomLeft', 0)
        ]
        rules.append(f"border-radius: {corners[0]}px {corners[1]}px {corners[2]}px {corners[3]}px")

    # Strokes (borders)
    strokes = node.get('strokes', [])
    stroke_weight = node.get('strokeWeight', 0)
    if strokes and stroke_weight:
        for stroke in strokes:
            if stroke.get('visible', True) and stroke.get('type') == 'SOLID':
                color = rgba_to_hex(stroke.get('color', {}))
                rules.append(f"border: {stroke_weight}px solid {color}")
                break

    # Effects (shadows)
    effects = node.get('effects', [])
    shadows = []
    for effect in effects:
        if effect.get('visible', True) and effect.get('type') in ('DROP_SHADOW', 'INNER_SHADOW'):
            color = effect.get('color', {})
            hex_color = rgba_to_hex(color)
            alpha = color.get('a', 0.1)
            offset = effect.get('offset', {})
            x = offset.get('x', 0)
            y = offset.get('y', 0)
            blur = effect.get('radius', 0)
            spread = effect.get('spread', 0)

            # Convert to rgba
            r = int(color.get('r', 0) * 255)
            g = int(color.get('g', 0) * 255)
            b = int(color.get('b', 0) * 255)

            inset = 'inset ' if effect['type'] == 'INNER_SHADOW' else ''
            shadows.append(f"{inset}{x}px {y}px {blur}px {spread}px rgba({r},{g},{b},{alpha:.2f})")

    if shadows:
        rules.append(f"box-shadow: {', '.join(shadows)}")

    # Typography (for text nodes)
    style = node.get('style', {})
    if style:
        if style.get('fontFamily'):
            rules.append(f"font-family: '{style['fontFamily']}', sans-serif")
        if style.get('fontSize'):
            rules.append(f"font-size: {style['fontSize']}px")
        if style.get('fontWeight'):
            rules.append(f"font-weight: {style['fontWeight']}")
        if style.get('lineHeightPx'):
            rules.append(f"line-height: {style['lineHeightPx']}px")
        if style.get('letterSpacing'):
            rules.append(f"letter-spacing: {style['letterSpacing']}px")
        if style.get('textAlignHorizontal'):
            align_map = {'LEFT': 'left', 'CENTER': 'center', 'RIGHT': 'right', 'JUSTIFIED': 'justify'}
            rules.append(f"text-align: {align_map.get(style['textAlignHorizontal'], 'left')}")

    # Text color
    if node.get('type') == 'TEXT' and fills:
        for fill in fills:
            if fill.get('visible', True) and fill.get('type') == 'SOLID':
                color = rgba_to_hex(fill.get('color', {}))
                rules.append(f"color: {color}")
                break

    if not rules:
        return []

    return [f".{class_name} {{", *[f"  {rule};" for rule in rules], "}"]


def traverse_nodes(
    node: Dict,
    parent_class: Optional[str] = None,
    depth: int = 0,
    max_depth: int = 20
) -> Tuple[List[str], List[str]]:
    """
    Traverse Figma node tree and generate HTML + CSS.

    Returns:
        Tuple of (html_lines, css_lines)
    """
    if depth > max_depth:
        return [], []

    html_lines = []
    css_lines = []

    node_name = node.get('name', 'element')
    node_type = node.get('type', '')

    # Skip invisible nodes
    if not node.get('visible', True):
        return [], []

    # Generate class name (BEM)
    base_class = sanitize_class_name(node_name)
    if parent_class and depth > 1:
        class_name = f"{parent_class}__{base_class}"
    else:
        class_name = base_class

    # Get semantic tag
    tag = get_semantic_tag(node)

    # Generate CSS for this node
    css_rules = node_to_css(node, class_name, {})
    if css_rules:
        css_lines.extend(css_rules)
        css_lines.append('')

    # Get children
    children = node.get('children', [])

    # Build HTML
    indent = '  ' * depth

    if node_type == 'TEXT':
        # Text node - extract characters
        text = escape_text(node.get('characters', ''))
        html_lines.append(f'{indent}<{tag} class="{class_name}">{text}</{tag}>')
    elif children:
        # Container with children
        html_lines.append(f'{indent}<{tag} class="{class_name}">')

        # Use base class for BEM parent
        bem_parent = base_class if depth <= 1 else (parent_class or base_class)

        for child in children:
            child_html, child_css = traverse_nodes(
                child,
                parent_class=bem_parent,
                depth=depth + 1,
                max_depth=max_depth
            )
            html_lines.extend(child_html)
            css_lines.extend(child_css)

        html_lines.append(f'{indent}</{tag}>')
    else:
        # Empty container or leaf node
        if tag in ('img', 'input', 'br', 'hr'):
            html_lines.append(f'{indent}<{tag} class="{class_name}" />')
        else:
            html_lines.append(f'{indent}<{tag} class="{class_name}"></{tag}>')

    return html_lines, css_lines


def generate_html_document(body_html: str, tokens_path: str) -> str:
    """Generate complete HTML document."""
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Figma Design</title>
  <link rel="stylesheet" href="tokens.css">
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
</head>
<body>
{body_html}
</body>
</html>
'''


def generate_css_document(css_rules: List[str]) -> str:
    """Generate complete CSS document."""
    header = '''/* Styles - Generated from Figma */
/* Uses design tokens from tokens.css */

/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body, 'Inter', sans-serif);
  line-height: 1.5;
  color: var(--color-text-primary, #333);
  background-color: var(--color-background, #fff);
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

/* Components */
'''
    return header + '\n'.join(css_rules)


def main():
    parser = argparse.ArgumentParser(description='Generate HTML/CSS from Figma nodes')
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

    # Load tokens
    tokens_path = Path(args.tokens)
    tokens = {}
    if tokens_path.exists():
        with open(tokens_path, 'r', encoding='utf-8') as f:
            tokens = json.load(f)

    # Find root node(s)
    root_nodes = []
    if isinstance(nodes_data, dict):
        if 'document' in nodes_data:
            # Full file response
            doc = nodes_data['document']
            if 'children' in doc:
                root_nodes = doc['children']
        elif 'nodes' in nodes_data:
            # Nodes endpoint response
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

    # Generate HTML and CSS
    all_html = []
    all_css = []

    for root in root_nodes:
        html_lines, css_lines = traverse_nodes(root, depth=0)
        all_html.extend(html_lines)
        all_css.extend(css_lines)

    # Create output directory
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Write HTML
    body_html = '\n'.join(all_html)
    html_doc = generate_html_document(body_html, 'tokens.css')
    html_path = output_dir / 'index.html'
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_doc)

    # Write CSS
    css_doc = generate_css_document(all_css)
    css_path = output_dir / 'styles.css'
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css_doc)

    # Copy tokens.css if in analysis subfolder
    tokens_css_src = output_dir / 'analysis' / 'tokens.css'
    if not tokens_css_src.exists():
        tokens_css_src = tokens_path.parent / 'tokens.css'

    if tokens_css_src.exists():
        import shutil
        shutil.copy(tokens_css_src, output_dir / 'tokens.css')

    # Output result
    result = {
        'success': True,
        'mode': 'css',
        'output': {
            'html': str(html_path),
            'css': str(css_path),
            'tokens': str(output_dir / 'tokens.css')
        },
        'stats': {
            'html_lines': len(all_html),
            'css_rules': len([l for l in all_css if l.startswith('.')])
        }
    }

    if args.verbose:
        print(f"Generated {result['stats']['html_lines']} HTML lines", file=sys.stderr)
        print(f"Generated {result['stats']['css_rules']} CSS rules", file=sys.stderr)

    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
