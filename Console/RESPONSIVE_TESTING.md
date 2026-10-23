# Responsive verification

Start the dev server, then open `/responsive-fixture.html`. This development-only
entry uses the real shell, sidebar, table, file preview, page editor, and schema
builder with synthetic data. All HTTP requests are intercepted locally; writes
are rejected. It is not included in the production Vite build.

Test compact (up to 640 CSS px), tablet (up to 900), intermediate (up to 1200),
and desktop layouts. The sidebar collapses below 900; feature grids stack below 1200. Wide tables scroll inside their named region, not the whole document.
Inputs, long IDs/names, images and dialogs must remain inside the viewport.

## Recorded M3 browser smoke test

Requested viewport sizes and measured CSS widths differed in the current browser
configuration, so both are recorded rather than assuming an unzoomed viewport.

| Requested width | Effective CSS width | Document width | Outcome                                             |
| --------------- | ------------------- | -------------- | --------------------------------------------------- |
| 375             | 288                 | 277            | No page overflow; table scrolls within 243px region |
| 768             | 591                 | 579            | No page overflow; compact form layout               |
| 1024            | 788                 | 776            | No page overflow; collapsed navigation              |
| 1440            | 1108                | 1096           | No page overflow; stacked feature panels            |
| 1920            | 1477                | 1465           | No page overflow; two-column database panels        |

At the narrowest size, the page editor measured about 239×498px inside a
288×625px CSS viewport. Escape closed it and focus returned to Edit. The large
image preview and long metadata filename remained contained. Restore browser
viewport overrides after testing. These browser checks do not constitute an
iOS-native app test or a complete VoiceOver audit.

## Recorded #458 browser smoke test

The current browser reports a 0.5 device scale factor, so the viewport tool's
requested canvas width is not the effective CSS width. The gallery was checked
at the following effective CSS widths after the intermediate breakpoint fix:

| Effective CSS width | Gallery layout         | Document overflow | Interaction result                                          |
| ------------------- | ---------------------- | ----------------- | ----------------------------------------------------------- |
| 480                 | 2 columns, 161px cards | None              | Card opens details dialog; Escape returns focus to the card |
| 768                 | 2 columns, 305px cards | None              | Long titles remain contained and readable                   |
| 1024                | 2 columns, 288px cards | None              | No one-column or four-narrow-card regression                |
| 1440                | 2 columns, 475px cards | None              | Toolbar and gallery remain within the content width         |

The wide table was also checked at the narrowest effective width: its region
measured 342px wide with a 576px table, while the document remained 450px wide.
The table therefore scrolls inside its named region instead of widening the
page. The ForgeKeeper editor's close control closed the dialog and returned
focus to the Edit button. These checks do not constitute an iOS-native app test
or a complete VoiceOver audit.

## Repeatable checks

Run `npm test` and `npm run build`. The Console checks Action runs both on PRs
changing the UI and on master. Interaction tests cover navigation disclosure,
dialog semantics, route focus and error states. Browser geometry checks remain
an explicit smoke-test step: jsdom does not perform real responsive layout.
Also inspect at 200% zoom, rotate the viewport, scroll long tables, open/cancel
dialogs, and navigate with Tab/Shift-Tab/Enter. Never use personal uploads or
database creation to test this fixture.
