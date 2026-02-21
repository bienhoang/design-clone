# Quality Checklist

Verify cloned designs meet quality standards.

## Visual Quality

### Icons

- [ ] No emojis used as icons
- [ ] All icons from Font Awesome 6
- [ ] Consistent icon sizing
- [ ] Proper icon alignment with text

```html
<!-- Correct -->
<i class="fa-solid fa-check"></i>

<!-- Incorrect -->
<span>✓</span>
```

### Images

- [ ] All images have `alt` text
- [ ] Images use appropriate format (WebP/AVIF for photos, SVG for graphics)
- [ ] No broken image links
- [ ] Proper aspect ratios maintained

### Colors

- [ ] Sufficient text contrast (4.5:1 minimum for normal text)
- [ ] Color not the only indicator for information
- [ ] Consistent color usage throughout

## Interaction

### Hover States

- [ ] All clickable elements have `cursor: pointer`
- [ ] Hover states provide clear visual feedback
- [ ] No layout shift on hover
- [ ] Transitions are smooth (150-300ms)

```css
/* Good hover state */
.button {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.button:hover {
  background-color: var(--primary-dark);
}
```

### Focus States

- [ ] Focus indicators visible
- [ ] Tab order logical
- [ ] No keyboard traps

### Touch Targets

- [ ] Minimum 44×44px touch targets
- [ ] Adequate spacing between interactive elements

## Layout

### Responsiveness

- [ ] Works at 320px width (minimum)
- [ ] Works at 768px (tablet)
- [ ] Works at 1024px (small desktop)
- [ ] Works at 1440px (large desktop)

### Spacing

- [ ] Consistent spacing scale used
- [ ] No content hidden behind fixed elements
- [ ] Proper margins and padding

### Alignment

- [ ] Text properly aligned
- [ ] Elements aligned to grid
- [ ] Visual balance maintained

## Accessibility

### Semantic HTML

- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] Landmarks used (nav, main, footer)
- [ ] Lists used for list content
- [ ] Tables used for tabular data

### Forms

- [ ] All inputs have associated labels
- [ ] Required fields indicated
- [ ] Error messages clear and accessible
- [ ] Autocomplete attributes where appropriate

### Screen Readers

- [ ] Skip link present
- [ ] Images have alt text
- [ ] Decorative images have `alt=""`
- [ ] Links have descriptive text

## Performance

### CSS

- [ ] Unused CSS removed
- [ ] No duplicate rules
- [ ] Properties in consistent order
- [ ] Efficient selectors used

### Images

- [ ] Appropriately sized for display
- [ ] Lazy loading for below-fold images
- [ ] Modern formats used where supported

### Fonts

- [ ] Font files optimized (WOFF2)
- [ ] Font-display strategy defined
- [ ] Subset fonts if possible

## Code Quality

### HTML

- [ ] Valid HTML5
- [ ] No deprecated elements
- [ ] Properly nested tags
- [ ] Quotes around attribute values

### CSS

- [ ] Valid CSS
- [ ] Consistent naming convention
- [ ] Logical property ordering
- [ ] No `!important` overuse

### Organization

- [ ] Clear file structure
- [ ] Consistent formatting
- [ ] Comments where needed

## Verification Commands

### Run Menu Verification

```bash
node src/verification/verify-menu.js \
  --html ./output/source.html
```

### Run Layout Verification

```bash
node src/verification/verify-layout.js \
  --html ./output/source.html \
  --css ./output/source.css
```

### Run Full Audit

```bash
node src/verification/generate-audit-report.js \
  --input ./output \
  --output ./output/audit-report.md
```

## Automated Checks

Design Clone performs these checks automatically:

| Check | Command | Auto |
|-------|---------|------|
| Menu structure | verify-menu.js | ✓ |
| Layout consistency | verify-layout.js | ✓ |
| Header verification | verify-header.js | ✓ |
| Footer verification | verify-footer.js | ✓ |
| Slider verification | verify-slider.js | ✓ |

## Manual Review

Some things require human review:

1. **Visual fidelity** - Compare screenshots to original
2. **Brand accuracy** - Correct colors, fonts, logos
3. **Content accuracy** - Text matches source
4. **Interaction quality** - Feels right when using

## Fixing Common Issues

### Layout Shift on Hover

```css
/* Problem */
.card:hover {
  border: 2px solid blue; /* Adds width */
}

/* Solution */
.card {
  border: 2px solid transparent;
}
.card:hover {
  border-color: blue;
}
```

### Poor Contrast

```css
/* Problem */
.muted {
  color: #ccc; /* Too light on white */
}

/* Solution */
.muted {
  color: #737373; /* 4.5:1 contrast */
}
```

### Missing Focus Styles

```css
/* Add visible focus */
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```
