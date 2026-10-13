# Design Guide: Nephrology Nurses Week 2026 Awards

## Thesis

The page reads as calm white clinical glass, with one blue voice and a rare gold accent.

## Palette

Every value is defined in `css/tokens.css`.

| Token | Hex | Role |
|---|---|---|
| --brand-200 | #c2dbf5 | Light aurora layer |
| --brand-400 | #5a9fe0 | Decorative aurora and chart fill |
| --brand-600 | #1d64b4 | Primary action, links, focus ring |
| --brand-800 | #123d70 | Headings on paper and pressed state |
| --gold-400 | #e3b54a | Award rim highlight |
| --gold-600 | #b8861e | Gold icon stroke only |
| --ink | #0c1f38 | Body text |
| --ink-soft | #3a5270 | Secondary text |
| --ink-faint | #47607e | Captions and meta text |
| --paper | #fafcff | Page base |
| --danger | #b42318 | Validation errors |
| --success-bg | #e2eefb | Saved confirmation |

Blue is the dominant colour.
Gold covers less than ten percent of any screen.
Body text uses --ink on glass, which passes WCAG AA at 4.5 to 1.

## Type

The display face is Fraunces, a variable serif with an optical size axis.
It suits award titles and nominee names.
The body face is Instrument Sans, a neutral grotesk with clear numerals.

Load both faces with this link:

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Instrument+Sans:wght@400..700&display=swap" rel="stylesheet">
```

Body copy uses --text-base, and titles use --font-display at --text-3xl or --text-4xl.

## Glass recipe

The panel itself never carries a filter, an opacity below 1, or a backdrop filter.
The panel stays flat, so 3D child layers keep their depth.
The visual glass lives on the ::before pseudo-element.

```css
.glass {
  position: relative;
  z-index: 0;
  border-radius: var(--radius-lg);
}

.glass::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), inset 0 1px 0 var(--glass-highlight);
  backdrop-filter: blur(var(--glass-blur)) saturate(140%);
}
```

Set the text colour of every glass child to var(--ink).
Swap var(--glass-bg) for var(--glass-bg-strong) on forms and dense text.

## Background

A fixed layer named .aurora sits behind all content at z-index -2.
The layer uses three radial gradients in blue-200, blue-400, and blue-600 at low alpha over a paper base.
A keyframe named aurora-drift moves the layer over 28 seconds with alternate direction and --ease-in-out.
The animation uses transform only, and the layer sets will-change: transform.

## Motion doctrine

- Page enter: opacity 0 to 1 and translate Y 12px to 0.
  Use --dur-page and --ease-out.
- Staggered card reveal: opacity 0 to 1 and translate Y 16px to 0.
  Use --dur-base and --ease-out, with a 60ms stagger that stops after eight cards.
- Hover lift: translate Y minus 2px and a stronger --glass-shadow.
  Use --dur-fast and --ease-out, and apply it only under a hover-capable pointer.
- Press scale: scale 0.97 while the element is active.
  Use --dur-fast and --ease-out.
- Award page hero entrance: reveal each word of the award name.
  Each word moves from translate Y 0.4em to 0 with opacity 0 to 1.
  Use --dur-slow and --ease-out with a 40ms stagger.
- Winner reveal sequence: run four steps in order.
  Step one brightens the aurora over --dur-slow.
  Step two fades in the --gold-400 rim highlight over --dur-slow.
  Step three rises the nominee name with --dur-slow and --ease-out.
  Step four counts the score up over --dur-page, then settles the badge once with --ease-spring.
- Score slider feedback: the value bubble follows the thumb with transform only.
  Use --dur-fast and --ease-out.
  The numeric value scales from 1 to 1.04 for --dur-fast on each change.
  Do not apply a spring while the user drags.
- Reduced motion: the motion tokens drop to 1ms through the media query in tokens.css.
  The aurora stops, reveals change opacity only, and the score shows its final value at once.

## Anti-slop list

The build must not do the following.

- Use purple, violet, or blue-violet gradients.
- Use bounce or spring easing without a purpose.
- Centre every element in the hero.
- Use emoji as icons.
- Show fake statistics or placeholder counts.
- Use lorem ipsum text.
- Use Inter, Poppins, or Roboto.
- Animate layout properties such as top, left, width, or height.
- Place gold on more than one large element per screen.
- Place a backdrop filter on a parent of 3D child layers.
- Show more than three blurred glass panels in one phone viewport.
