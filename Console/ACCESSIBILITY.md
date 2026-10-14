# Accessibility standards

Use native links for navigation and buttons for actions. All controls need a
visible label or a specific accessible name. Do not use color as the only
status signal. Shared fields generate stable IDs when one is not supplied.

Keyboard: the skip link targets Current screen; route changes move focus there.
Keep a visible 3px focus outline. Controls have a minimum 44px height. Scrollable
tables are named, keyboard-focusable regions with captions and column headers.
Use native dialog focus trapping/restoration, a named heading, Escape dismissal,
and an explicit Close button. Saving errors stay in the editor and are announced.
Never close a dialog just because a save failed.

Announcements: initial loading and success use polite status; errors use alerts.
Do not announce every background refresh. Respect reduced-motion preferences.
Normal text should meet WCAG AA 4.5:1 contrast (large text/non-text UI 3:1).
Token tests cover primary text, muted panel text, actions and notices; they are
not a full accessibility certification. Error notices use dark text on the
danger background rather than low-contrast light text.

Verification: run npm test and npm run build. Also smoke-test Tab/Shift-Tab,
Enter/Space actions, Escape and dialog focus return, 200% zoom, and VoiceOver
on macOS. Test real layouts at narrow widths; jsdom cannot validate visual
focus rings, screen-reader pronunciation, or clipping. Do not claim a complete
VoiceOver audit from unit tests alone.
