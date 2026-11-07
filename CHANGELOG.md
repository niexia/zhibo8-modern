# Changelog

## 1.0.1 — 2026-11-07

- Fixed the site header not staying attached to the top of the viewport while scrolling.
- Fixed the schedule filter bar floating without its parent header and letting rows show through.
- Added scroll-position-aware docking for the schedule filter panel, so it stays attached to the visible filter bar.
- Kept the schedule filter bar opaque while pinned, and made the sticky header/backdrop work with the page body height.
- Added regression coverage for sticky header, sticky filter bar, and the docked filter panel.

## 1.0.0 — 2026-11-07

- Initial public release.
- Modern content grid for the zhibo8.com homepage.
- Light, dark, and system themes with an in-page theme switch.
- Matchday rail sourced from the page's existing schedule, with horizontal navigation.
- Redesigned schedule, finished-match scoreboard, news lists, rankings, and footer.
- Responsive layout for 1440px, 1280px, 1024px, and 768px viewports.
- Extension popup to enable/disable the theme, choose appearance, and toggle the matchday rail.
- Scoped CSS and a clean teardown path: disabling the extension restores the original site immediately.
- No analytics, no tracking, no external requests.
- MIT licensed.
