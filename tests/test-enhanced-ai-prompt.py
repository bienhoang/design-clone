#!/usr/bin/env python3
"""
Unit tests for Enhanced AI Prompt (Phase 3)

Tests:
- TC1: Prompt includes hierarchy when available
- TC2: Typography is section-specific in prompt
- TC3: Backward compatible when hierarchy not available
- TC4: Prompt format includes DOM nesting
- TC5: Helper functions format correctly

Usage:
  python tests/test-enhanced-ai-prompt.py
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from ai.prompts.structure_analysis import (
    build_structure_prompt,
    build_hierarchy_prompt,
    format_heading_hierarchy,
    format_section_structure,
    format_dom_nesting
)

passed = 0
failed = 0


def assert_test(condition, message):
    global passed, failed
    if condition:
        print(f"  ✓ {message}")
        passed += 1
    else:
        print(f"  ✗ {message}")
        failed += 1


# Sample test data
SAMPLE_DIMENSIONS = {
    "EXACT_DIMENSIONS": {
        "container_max_width": "1200px",
        "section_padding": "64px 0",
        "gap": "24px",
        "card_dimensions": {
            "width": "380px",
            "height": "auto",
            "padding": "24px"
        }
    },
    "EXACT_TYPOGRAPHY": {
        "h1": "48px",
        "h2": "36px",
        "h3": "24px",
        "body": "16px"
    },
    "TYPOGRAPHY_BY_SECTION": {
        "hero": {"h1": "64px", "h2": "48px", "p": "18px"},
        "content": {"h2": "32px", "h3": "24px", "p": "16px"},
        "footer": {"p": "14px"}
    },
    "SECTIONS": {
        "hero": {"found": True, "containerWidth": 1200},
        "content": {"found": True, "containerWidth": 1000},
        "footer": {"found": True, "containerWidth": None}
    },
    "RESPONSIVE": {
        "desktop_breakpoint": "1440px",
        "tablet_breakpoint": "768px",
        "mobile_breakpoint": "375px",
        "typography_scaling": {
            "h1": {"desktop": "48px", "tablet": "36px", "mobile": "28px"},
            "h2": {"desktop": "36px", "tablet": "28px", "mobile": "24px"}
        }
    }
}

SAMPLE_HIERARCHY = {
    "root": {
        "tagName": "body",
        "role": None,
        "children": [
            {
                "tagName": "header",
                "role": "header-landmark",
                "section": "header",
                "children": [
                    {"tagName": "nav", "role": "nav", "children": []}
                ]
            },
            {
                "tagName": "main",
                "role": "main",
                "section": "content",
                "children": [
                    {"tagName": "section", "role": "section", "children": []}
                ]
            },
            {
                "tagName": "footer",
                "role": "footer-landmark",
                "section": "footer",
                "children": []
            }
        ]
    },
    "landmarks": {
        "header": {"tagName": "header", "role": "header-landmark"},
        "main": {"tagName": "main", "role": "main"},
        "footer": {"tagName": "footer", "role": "footer-landmark"},
        "nav": [{"tagName": "nav", "role": "nav"}],
        "aside": []
    },
    "headingTree": [
        {"level": 1, "section": "hero", "text": "Welcome to Our Site", "fontSize": 64},
        {"level": 2, "section": "content", "text": "Features Section", "fontSize": 32},
        {"level": 3, "section": "content", "text": "Feature One", "fontSize": 24},
        {"level": 2, "section": "footer", "text": "Contact Us", "fontSize": 20}
    ],
    "stats": {
        "totalNodes": 26,
        "maxDepth": 4,
        "landmarkCount": 4
    }
}


def test_tc1_hierarchy_included():
    """TC1: Prompt includes hierarchy when available"""
    print("\nTC1: Prompt includes hierarchy when available")

    prompt = build_structure_prompt(
        dimensions=SAMPLE_DIMENSIONS,
        hierarchy=SAMPLE_HIERARCHY
    )

    # Check hierarchy-specific content
    assert_test("Landmarks Found" in prompt, "Prompt includes Landmarks section")
    assert_test("Header: Yes" in prompt, "Header landmark detected")
    assert_test("Main content: Yes" in prompt, "Main landmark detected")
    assert_test("Footer: Yes" in prompt, "Footer landmark detected")
    assert_test("Heading Hierarchy" in prompt, "Heading hierarchy section present")
    assert_test("DOM Nesting Structure" in prompt, "DOM nesting section present")


def test_tc2_section_specific_typography():
    """TC2: Typography is section-specific in prompt"""
    print("\nTC2: Typography is section-specific in prompt")

    prompt = build_structure_prompt(
        dimensions=SAMPLE_DIMENSIONS,
        hierarchy=SAMPLE_HIERARCHY
    )

    # Check section-specific typography values
    assert_test("Hero H1: 64px" in prompt, "Hero H1 has correct section value")
    assert_test("Hero H2: 48px" in prompt, "Hero H2 has correct section value")
    assert_test("Content H2: 32px" in prompt, "Content H2 has correct section value")
    assert_test("Content H3: 24px" in prompt, "Content H3 has correct section value")
    assert_test("Footer Body: 14px" in prompt, "Footer body has correct section value")


def test_tc3_backward_compatible():
    """TC3: Backward compatible when hierarchy not available"""
    print("\nTC3: Backward compatible when hierarchy not available")

    # Without hierarchy - should use dimension-only prompt
    prompt_no_hierarchy = build_structure_prompt(dimensions=SAMPLE_DIMENSIONS)

    assert_test("EXACT EXTRACTED DIMENSIONS" in prompt_no_hierarchy, "Uses dimension prompt without hierarchy")
    assert_test("Landmarks Found" not in prompt_no_hierarchy, "No hierarchy section without hierarchy data")

    # Without both - should use basic prompt
    prompt_basic = build_structure_prompt()

    assert_test("Page Structure Analysis" in prompt_basic, "Basic prompt returned")
    assert_test("Header Section" in prompt_basic, "Basic prompt has structure sections")


def test_tc4_dom_nesting_format():
    """TC4: Prompt format includes DOM nesting"""
    print("\nTC4: Prompt format includes DOM nesting")

    prompt = build_structure_prompt(
        dimensions=SAMPLE_DIMENSIONS,
        hierarchy=SAMPLE_HIERARCHY
    )

    # Check DOM nesting format
    assert_test("<header>" in prompt, "DOM nesting shows header tag")
    assert_test("<main>" in prompt, "DOM nesting shows main tag")
    assert_test("<footer>" in prompt, "DOM nesting shows footer tag")
    assert_test("<!-- header-landmark -->" in prompt, "DOM nesting shows role comments")


def test_tc5_helper_functions():
    """TC5: Helper functions format correctly"""
    print("\nTC5: Helper functions format correctly")

    # Test heading hierarchy formatter
    heading_output = format_heading_hierarchy(SAMPLE_HIERARCHY['headingTree'])
    assert_test("H1 (hero)" in heading_output, "Heading shows level and section")
    assert_test("Welcome" in heading_output, "Heading shows text preview")

    # Test section structure formatter
    section_output = format_section_structure(
        SAMPLE_HIERARCHY['landmarks'],
        SAMPLE_DIMENSIONS['SECTIONS']
    )
    assert_test("Header: Present" in section_output, "Section shows header")
    assert_test("Hero: Present" in section_output, "Section shows hero")
    assert_test("1200px" in section_output, "Section shows container width")

    # Test DOM nesting formatter
    dom_output = format_dom_nesting(SAMPLE_HIERARCHY['root'])
    assert_test("<header>" in dom_output, "DOM nesting includes header")
    assert_test("header-landmark" in dom_output, "DOM nesting includes role")

    # Test empty/None handling
    empty_heading = format_heading_hierarchy([])
    assert_test("No headings" in empty_heading, "Empty headings handled")

    empty_dom = format_dom_nesting(None)
    assert_test("No DOM structure" in empty_dom, "None root handled")


def test_tc6_token_budget():
    """TC6: Prompt stays within token budget"""
    print("\nTC6: Prompt stays within token budget")

    prompt = build_structure_prompt(
        dimensions=SAMPLE_DIMENSIONS,
        hierarchy=SAMPLE_HIERARCHY
    )

    # Rough token estimate (chars / 4)
    estimated_tokens = len(prompt) / 4
    max_tokens = 8000  # 8KB budget

    assert_test(estimated_tokens < max_tokens, f"Token estimate ~{int(estimated_tokens)} < {max_tokens}")
    assert_test(len(prompt) < 32000, f"Prompt length {len(prompt)} chars < 32KB")


def run_all_tests():
    print("=" * 60)
    print("Phase 3: Enhanced AI Prompt Unit Tests")
    print("=" * 60)

    test_tc1_hierarchy_included()
    test_tc2_section_specific_typography()
    test_tc3_backward_compatible()
    test_tc4_dom_nesting_format()
    test_tc5_helper_functions()
    test_tc6_token_budget()

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed / {passed + failed} total")
    print("=" * 60)

    return failed == 0


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
