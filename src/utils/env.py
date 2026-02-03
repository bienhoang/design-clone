"""
Environment variable resolution for design-clone scripts.

Search order (first found wins, os.environ takes precedence):
1. os.environ (already set)
2. .env in current working directory
3. .env in skill directory (scripts/design-clone/)
4. .env in ~/.claude/skills/
5. .env in ~/.claude/

Usage:
    from lib.env import resolve_env, load_env, get_skill_dir

    # Load all .env files
    load_env()

    # Get specific variable with fallback
    api_key = resolve_env('GEMINI_API_KEY', default=None)
"""

import os
from pathlib import Path
from typing import Dict, List, Optional

# Skill directory - from src/utils/ go up 2 levels to reach design-clone/
SKILL_DIR = Path(__file__).parent.parent.parent.resolve()


def get_env_search_paths() -> List[Path]:
    """Get list of directories to search for .env files."""
    return [
        Path.cwd(),
        SKILL_DIR,
        Path.home() / '.claude' / 'skills',
        Path.home() / '.claude'
    ]


def parse_env_file(file_path: Path) -> Dict[str, str]:
    """
    Parse .env file into key-value dict.
    Handles: KEY=value, KEY="quoted value", comments (#), empty lines
    """
    result = {}

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()

                # Skip empty lines and comments
                if not line or line.startswith('#'):
                    continue

                # Parse KEY=value
                if '=' in line:
                    key, _, value = line.partition('=')
                    key = key.strip()
                    value = value.strip()

                    # Remove quotes if present
                    if (value.startswith('"') and value.endswith('"')) or \
                       (value.startswith("'") and value.endswith("'")):
                        value = value[1:-1]

                    result[key] = value
    except Exception as e:
        print(f"[env] Failed to read {file_path}: {e}")

    return result


def load_env() -> Optional[Path]:
    """
    Load environment variables from .env files.
    Only sets variables not already in os.environ.

    Returns:
        Path to loaded .env file, or None if none found.
    """
    for dir_path in get_env_search_paths():
        env_file = dir_path / '.env'

        if env_file.exists():
            parsed = parse_env_file(env_file)

            # Only set vars not already in environ
            for key, value in parsed.items():
                if key not in os.environ:
                    os.environ[key] = value

            return env_file

    return None


def resolve_env(key: str, default: Optional[str] = None) -> Optional[str]:
    """
    Get environment variable with optional default.

    Args:
        key: Environment variable name
        default: Default value if not found

    Returns:
        Variable value or default
    """
    return os.environ.get(key, default)


def require_env(key: str, hint: str = '') -> str:
    """
    Require environment variable, raise if not found.

    Args:
        key: Environment variable name
        hint: Hint message for how to set the variable

    Returns:
        Variable value

    Raises:
        OSError: If variable not set
    """
    value = os.environ.get(key)
    if not value:
        hint_msg = f'\nHint: {hint}' if hint else ''
        raise OSError(f'Required environment variable {key} not set.{hint_msg}')
    return value


def get_skill_dir() -> Path:
    """Get skill directory path."""
    return SKILL_DIR
