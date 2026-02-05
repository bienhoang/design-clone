#!/usr/bin/env python3
"""
Figma REST API client for design extraction.

Usage:
    python figma-client.py --file-key abc123
    python figma-client.py --file-key abc123 --node-ids 1:2,3:4
    python figma-client.py --file-key abc123 --action images --node-ids 1:2

Actions:
    file    - Get full file data (default)
    nodes   - Get specific nodes
    images  - Export node images
    styles  - Get file styles

Environment:
    FIGMA_ACCESS_TOKEN - Figma Personal Access Token (required)

Output:
    JSON to stdout
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.env import load_env, resolve_env

# Load environment on import
load_env()


class FigmaClient:
    """Figma REST API client."""

    BASE_URL = "https://api.figma.com/v1"
    DEFAULT_TIMEOUT = 10  # seconds (reduced from 30 for faster feedback)

    def __init__(self, token: Optional[str] = None):
        """
        Initialize Figma client.

        Args:
            token: Figma Personal Access Token. Uses FIGMA_ACCESS_TOKEN env if not provided.

        Raises:
            ValueError: If no token available
        """
        self.token = token or resolve_env('FIGMA_ACCESS_TOKEN')
        if not self.token:
            raise ValueError(
                "FIGMA_ACCESS_TOKEN required. "
                "Get one from: https://www.figma.com/developers/api#access-tokens"
            )
        self.headers = {"X-Figma-Token": self.token}

    def get_file(self, file_key: str, geometry: str = "paths") -> Dict[str, Any]:
        """
        Get full file data.

        Args:
            file_key: Figma file key
            geometry: Geometry type (paths, bounds)

        Returns:
            File data including document tree
        """
        url = f"{self.BASE_URL}/files/{file_key}?geometry={geometry}"
        return self._request(url)

    def get_nodes(self, file_key: str, node_ids: List[str]) -> Dict[str, Any]:
        """
        Get specific nodes from file.

        Args:
            file_key: Figma file key
            node_ids: List of node IDs to fetch

        Returns:
            Nodes data
        """
        ids = ",".join(node_ids)
        url = f"{self.BASE_URL}/files/{file_key}/nodes?ids={ids}"
        return self._request(url)

    def get_images(
        self,
        file_key: str,
        node_ids: List[str],
        format: str = "png",
        scale: float = 2.0
    ) -> Dict[str, Any]:
        """
        Export node images.

        Args:
            file_key: Figma file key
            node_ids: List of node IDs to export
            format: Image format (png, jpg, svg, pdf)
            scale: Image scale (0.01 to 4)

        Returns:
            Dict with image URLs keyed by node ID
        """
        ids = ",".join(node_ids)
        url = f"{self.BASE_URL}/images/{file_key}?ids={ids}&format={format}&scale={scale}"
        return self._request(url)

    def get_styles(self, file_key: str) -> Dict[str, Any]:
        """
        Get file styles (colors, text, effects, grids).

        Args:
            file_key: Figma file key

        Returns:
            Styles metadata
        """
        url = f"{self.BASE_URL}/files/{file_key}/styles"
        return self._request(url)

    def _request(self, url: str) -> Dict[str, Any]:
        """
        Make authenticated request to Figma API.

        Args:
            url: Full API URL

        Returns:
            Parsed JSON response

        Raises:
            HTTPError: On API error
        """
        req = Request(url, headers=self.headers)
        try:
            with urlopen(req, timeout=self.DEFAULT_TIMEOUT) as response:
                return json.loads(response.read().decode('utf-8'))
        except HTTPError as e:
            error_body = e.read().decode('utf-8') if e.fp else ''
            raise HTTPError(
                e.url, e.code,
                f"{e.reason}: {error_body}",
                e.headers, None
            )


def output_json(data: Dict[str, Any]) -> None:
    """Output data as formatted JSON."""
    print(json.dumps(data, indent=2))


def output_error(error: Exception) -> None:
    """Output error as JSON and exit."""
    print(json.dumps({
        "success": False,
        "error": str(error)
    }, indent=2), file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Figma REST API client")
    parser.add_argument(
        '--file-key', '-f',
        required=True,
        help='Figma file key'
    )
    parser.add_argument(
        '--action', '-a',
        choices=['file', 'nodes', 'images', 'styles'],
        default='file',
        help='API action (default: file)'
    )
    parser.add_argument(
        '--node-ids', '-n',
        help='Comma-separated node IDs (required for nodes/images actions)'
    )
    parser.add_argument(
        '--format',
        choices=['png', 'jpg', 'svg', 'pdf'],
        default='png',
        help='Image format (default: png)'
    )
    parser.add_argument(
        '--scale', '-s',
        type=float,
        default=2.0,
        help='Image scale 0.01-4 (default: 2.0)'
    )
    parser.add_argument(
        '--token', '-t',
        help='Figma access token (uses FIGMA_ACCESS_TOKEN env if not provided)'
    )

    args = parser.parse_args()

    try:
        client = FigmaClient(token=args.token)

        if args.action == 'file':
            result = client.get_file(args.file_key)

        elif args.action == 'nodes':
            if not args.node_ids:
                output_error(ValueError("--node-ids required for nodes action"))
                return
            # Sanitize node_ids: trim whitespace, filter empty
            node_ids = [nid.strip() for nid in args.node_ids.split(',') if nid.strip()]
            if not node_ids:
                output_error(ValueError("No valid node IDs provided"))
                return
            result = client.get_nodes(args.file_key, node_ids)

        elif args.action == 'images':
            if not args.node_ids:
                output_error(ValueError("--node-ids required for images action"))
                return
            # Sanitize node_ids: trim whitespace, filter empty
            node_ids = [nid.strip() for nid in args.node_ids.split(',') if nid.strip()]
            if not node_ids:
                output_error(ValueError("No valid node IDs provided"))
                return
            result = client.get_images(
                args.file_key,
                node_ids,
                format=args.format,
                scale=args.scale
            )

        elif args.action == 'styles':
            result = client.get_styles(args.file_key)

        output_json({"success": True, "data": result})

    except Exception as e:
        output_error(e)


if __name__ == '__main__':
    main()
