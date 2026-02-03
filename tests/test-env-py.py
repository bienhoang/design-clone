#!/usr/bin/env python3
"""
Test suite for lib/env.py
Tests env resolution logic, .env file parsing, and search path ordering
"""

import os
import sys
from pathlib import Path

# Add src directory to path for local imports
SCRIPT_DIR = Path(__file__).parent.resolve()
SRC_DIR = SCRIPT_DIR.parent / 'src'
sys.path.insert(0, str(SRC_DIR))

from utils.env import resolve_env, load_env, require_env, get_skill_dir, get_env_search_paths

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

def assert_not_none(value, message):
    if value is None:
        raise AssertionError(f"{message}: Value is None")

def assert_true(value, message):
    if not value:
        raise AssertionError(f"{message}: Expected True, got {value}")

def assert_false(value, message):
    if value:
        raise AssertionError(f"{message}: Expected False, got {value}")

def assert_exists(path_obj, message):
    if not path_obj.exists():
        raise AssertionError(f"{message}: Path does not exist: {path_obj}")

# Test suite
@test('load_env() returns Path or None')
def test_load_env_return_type():
    result = load_env()
    if result is not None and not isinstance(result, Path):
        raise AssertionError('load_env() should return Path or None')

@test('resolve_env() returns value when exists')
def test_resolve_env_exists():
    os.environ['TEST_ENV_VAR'] = 'test_value'
    result = resolve_env('TEST_ENV_VAR')
    assert_equals(result, 'test_value', 'resolve_env() should return existing var')

@test('resolve_env() returns default when not exists')
def test_resolve_env_default():
    if 'NONEXISTENT_VAR_XYZ' in os.environ:
        del os.environ['NONEXISTENT_VAR_XYZ']
    result = resolve_env('NONEXISTENT_VAR_XYZ', 'default_val')
    assert_equals(result, 'default_val', 'resolve_env() should return default for missing var')

@test('resolve_env() returns None when no default and not exists')
def test_resolve_env_none():
    if 'NONEXISTENT_VAR_ABC' in os.environ:
        del os.environ['NONEXISTENT_VAR_ABC']
    result = resolve_env('NONEXISTENT_VAR_ABC')
    assert_equals(result, None, 'resolve_env() should return None for missing var without default')

@test('require_env() returns value when exists')
def test_require_env_exists():
    os.environ['REQUIRED_TEST'] = 'required_value'
    result = require_env('REQUIRED_TEST')
    assert_equals(result, 'required_value', 'require_env() should return existing var')

@test('require_env() raises when not exists')
def test_require_env_raises():
    if 'NONEXISTENT_REQUIRED' in os.environ:
        del os.environ['NONEXISTENT_REQUIRED']
    try:
        require_env('NONEXISTENT_REQUIRED')
        raise AssertionError('require_env() should raise for missing var')
    except EnvironmentError as e:
        if 'Required environment variable' not in str(e):
            raise AssertionError('Error message should mention required variable')

@test('require_env() includes hint in error message')
def test_require_env_hint():
    if 'ANOTHER_MISSING_VAR' in os.environ:
        del os.environ['ANOTHER_MISSING_VAR']
    try:
        require_env('ANOTHER_MISSING_VAR', 'Set ANOTHER_MISSING_VAR=value')
        raise AssertionError('require_env() should raise')
    except EnvironmentError as e:
        if 'Set ANOTHER_MISSING_VAR=value' not in str(e):
            raise AssertionError('Error message should include hint')

@test('get_skill_dir() returns valid directory')
def test_get_skill_dir():
    skill_dir = get_skill_dir()
    assert_not_none(skill_dir, 'get_skill_dir() should return non-None')
    assert_true(str(skill_dir).endswith('design-clone'), 'get_skill_dir() should point to design-clone')
    assert_exists(skill_dir, 'get_skill_dir() should point to existing directory')

@test('get_skill_dir() returns absolute path')
def test_get_skill_dir_absolute():
    skill_dir = get_skill_dir()
    assert_true(skill_dir.is_absolute(), 'get_skill_dir() should return absolute path')

@test('get_env_search_paths() returns list of Paths')
def test_get_env_search_paths():
    paths = get_env_search_paths()
    assert_true(isinstance(paths, list), 'get_env_search_paths() should return list')
    assert_true(len(paths) > 0, 'get_env_search_paths() should return non-empty list')
    for p in paths:
        assert_true(isinstance(p, Path), f'Each path should be Path object, got {type(p)}')

@test('get_env_search_paths() includes current directory first')
def test_get_env_search_paths_order():
    paths = get_env_search_paths()
    assert_equals(str(paths[0]), str(Path.cwd()), 'First search path should be cwd()')

@test('get_env_search_paths() includes skill directory')
def test_get_env_search_paths_skill_dir():
    paths = get_env_search_paths()
    skill_dir = get_skill_dir()
    path_strs = [str(p) for p in paths]
    assert_true(str(skill_dir) in path_strs, 'Search paths should include skill directory')

# Run all tests
def run_tests():
    global passed, failed

    print('Running lib/env.py tests...\n')

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
