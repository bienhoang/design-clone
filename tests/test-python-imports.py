#!/usr/bin/env python3
"""
Test Python scripts for:
1. Local utils.env imports work correctly
2. Scripts can load env variables
3. Scripts handle missing dependencies gracefully
"""

import os
import sys
import json
import subprocess
from pathlib import Path

# Add src directory to path for local imports
SCRIPT_DIR = Path(__file__).parent.resolve()
SRC_DIR = SCRIPT_DIR.parent / 'src'
sys.path.insert(0, str(SRC_DIR))

# Test utilities
tests = []
passed = 0
failed = 0

def test(name):
    """Decorator for test functions"""
    def decorator(fn):
        tests.append((name, fn))
        return fn
    return decorator

def assert_equals(actual, expected, message):
    if actual != expected:
        raise AssertionError(f"{message}\n  Expected: {expected}\n  Actual: {actual}")

def assert_true(value, message):
    if not value:
        raise AssertionError(f"{message}: Expected True, got {value}")

def assert_contains(haystack, needle, message):
    if needle not in haystack:
        raise AssertionError(f"{message}\n  Looking for: {needle}\n  In: {haystack}")

def assert_not_contains(haystack, needle, message):
    if needle in haystack:
        raise AssertionError(f"{message}\n  Should not contain: {needle}")

# Test suite
@test('utils.env module can be imported from analyze-structure.py')
def test_analyze_structure_import():
    """Verify analyze-structure.py can import utils.env"""
    # Read the file and check for import statement
    script_path = SRC_DIR / 'ai' / 'analyze-structure.py'
    with open(script_path, 'r') as f:
        content = f.read()
    assert_contains(content, 'from utils.env import', 'analyze-structure.py should import utils.env')
    assert_contains(content, 'load_env()', 'analyze-structure.py should call load_env()')

@test('utils.env module can be imported from extract-design-tokens.py')
def test_extract_tokens_import():
    """Verify extract-design-tokens.py can import utils.env"""
    script_path = SRC_DIR / 'ai' / 'extract-design-tokens.py'
    with open(script_path, 'r') as f:
        content = f.read()
    assert_contains(content, 'from utils.env import', 'extract-design-tokens.py should import utils.env')
    assert_contains(content, 'load_env()', 'extract-design-tokens.py should call load_env()')

@test('Python scripts have fallback for missing utils.env')
def test_fallback_env():
    """Verify scripts have fallback when utils.env import fails"""
    script_path = SRC_DIR / 'ai' / 'analyze-structure.py'
    with open(script_path, 'r') as f:
        content = f.read()
    assert_contains(content, 'except ImportError:', 'Script should have except ImportError')
    assert_contains(content, 'def resolve_env', 'Script should define resolve_env fallback')

@test('utils.__init__.py exports correct functions')
def test_utils_init_exports():
    """Verify utils.__init__.py exports the right functions"""
    init_path = SRC_DIR / 'utils' / '__init__.py'
    with open(init_path, 'r') as f:
        content = f.read()
    assert_contains(content, 'resolve_env', '__init__.py should export resolve_env')
    assert_contains(content, 'load_env', '__init__.py should export load_env')
    assert_contains(content, 'require_env', '__init__.py should export require_env')
    assert_contains(content, 'get_skill_dir', '__init__.py should export get_skill_dir')

@test('utils.env module can be imported directly')
def test_direct_import():
    """Verify utils.env can be imported as module"""
    try:
        from utils.env import resolve_env, load_env, require_env, get_skill_dir
        assert_true(callable(resolve_env), 'resolve_env should be callable')
        assert_true(callable(load_env), 'load_env should be callable')
        assert_true(callable(require_env), 'require_env should be callable')
        assert_true(callable(get_skill_dir), 'get_skill_dir should be callable')
    except ImportError as e:
        raise AssertionError(f'Failed to import utils.env functions: {e}')

@test('utils.env parse_env_file handles quoted values')
def test_parse_env_quoted():
    """Verify .env file parser handles quoted values"""
    from utils.env import parse_env_file

    # Create a test .env file
    test_env = SCRIPT_DIR / 'test-env-quoted.env'
    test_env.write_text('KEY1="value with spaces"\nKEY2=\'single quoted\'\nKEY3=unquoted')

    try:
        result = parse_env_file(test_env)
        assert_equals(result.get('KEY1'), 'value with spaces', 'Should parse double-quoted value')
        assert_equals(result.get('KEY2'), 'single quoted', 'Should parse single-quoted value')
        assert_equals(result.get('KEY3'), 'unquoted', 'Should parse unquoted value')
    finally:
        test_env.unlink(missing_ok=True)

@test('utils.env parse_env_file handles comments')
def test_parse_env_comments():
    """Verify .env file parser handles comments"""
    from utils.env import parse_env_file

    # Create a test .env file
    test_env = SCRIPT_DIR / 'test-env-comments.env'
    test_env.write_text('# This is a comment\nKEY1=value1\n# Another comment\nKEY2=value2')

    try:
        result = parse_env_file(test_env)
        assert_equals(len(result), 2, 'Should parse 2 variables')
        assert_true('KEY1' in result, 'Should have KEY1')
        assert_true('KEY2' in result, 'Should have KEY2')
        assert_not_contains(str(result.keys()), 'This is a comment', 'Comments should not be in keys')
    finally:
        test_env.unlink(missing_ok=True)

@test('Python sys.path includes src directory')
def test_sys_path_includes_src_dir():
    """Verify scripts add their src directory to sys.path"""
    script_path = SRC_DIR / 'ai' / 'analyze-structure.py'
    with open(script_path, 'r') as f:
        content = f.read()
    assert_contains(content, 'SCRIPT_DIR = Path(__file__).parent.resolve()',
                   'Script should define SCRIPT_DIR')
    assert_contains(content, 'SRC_DIR = SCRIPT_DIR.parent',
                   'Script should define SRC_DIR')
    assert_contains(content, 'sys.path.insert(0, str(SRC_DIR))',
                   'Script should add SRC_DIR to sys.path')

@test('analyze-structure.py imports google-genai with error handling')
def test_analyze_structure_genai():
    """Verify analyze-structure.py handles missing google-genai gracefully"""
    script_path = SRC_DIR / 'ai' / 'analyze-structure.py'
    with open(script_path, 'r') as f:
        content = f.read()
    assert_contains(content, 'from google import genai', 'Should try to import genai')
    assert_contains(content, 'except ImportError:', 'Should handle import error')
    assert_contains(content, 'google-genai not installed', 'Should have helpful error message')

@test('extract-design-tokens.py imports google-genai with error handling')
def test_extract_tokens_genai():
    """Verify extract-design-tokens.py handles missing google-genai gracefully"""
    script_path = SRC_DIR / 'ai' / 'extract-design-tokens.py'
    with open(script_path, 'r') as f:
        content = f.read()
    assert_contains(content, 'from google import genai', 'Should try to import genai')
    assert_contains(content, 'except ImportError:', 'Should handle import error')
    assert_contains(content, 'google-genai not installed', 'Should have helpful error message')

# Run all tests
def run_tests():
    global passed, failed

    print('Running Python import tests...\n')

    for name, fn in tests:
        try:
            fn()
            print(f'✓ {name}')
            passed += 1
        except AssertionError as e:
            print(f'✗ {name}')
            print(f'  {e}')
            failed += 1
        except Exception as e:
            print(f'✗ {name}')
            print(f'  Unexpected error: {e}')
            failed += 1

    print(f'\n{passed}/{len(tests)} tests passed')

    if failed > 0:
        print(f'{failed} tests failed')
        sys.exit(1)
    else:
        print('All tests passed!')
        sys.exit(0)

if __name__ == '__main__':
    run_tests()
