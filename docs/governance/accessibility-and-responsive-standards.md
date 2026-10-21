# Accessibility and responsive standards

This shared guide supplements each repository's UI, architecture, and testing
documents. Apply the checklist to React, SwiftUI, and hybrid native/web work.

## Semantic and assistive technology

- Use semantic landmarks, headings in order, lists, buttons, links, labels, and field descriptions rather than generic containers.
- Every form control has a visible or programmatically associated label. Errors identify the field and explain recovery.
- Images have meaningful alternative text; decorative images are hidden from assistive technology.
- Dynamic loading, success, failure, empty, and validation changes are announced appropriately without stealing focus.
- Dialogs have an accessible name, trapped focus while open, escape behavior, and focus restoration.
- Tables have captions, correct headers, and a usable small-screen alternative.
- Do not communicate status by color alone. Preserve contrast and visible focus indicators.

## Keyboard, touch, and motion

- Every interactive action works with keyboard navigation and has a logical tab order.
- Focus remains visible and does not move unexpectedly.
- Touch targets have adequate size and spacing; hover is never the only signal.
- Keyboard users can skip repeated navigation and reach main content.
- Respect reduced-motion preferences and avoid animation that blocks operation or causes disorientation.
- Never disable zoom or rely on precise pointer movement.

## Responsive behavior

Review compact/mobile, tablet, desktop, zoomed text, long labels, empty data,
validation errors, loading states, and narrow dialogs. Content must reflow without
horizontal scrolling except for inherently tabular or visual data.

- Use established breakpoints and design tokens.
- Prefer fluid layout, wrapping, intrinsic sizing, and content-based constraints.
- Keep primary actions reachable and preserve reading order.
- Make tables, cards, navigation, uploads, previews, and dialogs usable at the smallest supported width.
- Test portrait and landscape where supported.
- Verify keyboard focus and screen-reader order after responsive rearrangement.

## React implementation

Use semantic JSX, stable labels and IDs, accessible primitives, and real
links/buttons. Keep loading and error feedback in the owning component or query
layer. Do not hide required content only at a breakpoint. Test important flows
with keyboard interaction, accessible names/roles, validation, and narrow
viewport dimensions.

## SwiftUI implementation

Use platform accessibility labels, hints, values, traits, and sort priority
only when a native control does not already provide correct semantics. Support
Dynamic Type, VoiceOver, reduced motion, color scheme, and orientation. Prefer a
native control over a custom gesture when it provides the needed semantics.

## Review evidence

Record applicable automated tests and a manual pass covering keyboard/focus,
labels/errors, VoiceOver or screen-reader behavior, contrast, reduced motion,
compact/tablet/desktop layouts, zoom or Dynamic Type, and loading/empty/error
states. Record exact blockers instead of claiming full verification. QA repeats
the relevant checks after merge against the story acceptance criteria.

