# Changelog

## Unreleased

- Fixed team-zone labels overlapping the points column in the homepage standings table.
- Added Chrome Web Store listing copy, privacy answers, test instructions, screenshots, and promo assets under `store/`.

## 1.1.1 — 2026-11-08

- Reverted the multi-page expansion. Only the zhibo8.com homepage is themed again; channels, live match pages, schedules, and content details keep the original site.
- Links from the homepage to video, news, live, and other subpages now open untouched original pages.
- Added a default-on **simplified navigation**: hide every top-level nav entry except 首页.
- Added a popup switch for the simplified navigation, with all other homepage options unchanged.
- Kept the sticky header, schedule filter, matchday rail, light/dark themes, and popup enable switch from the homepage release.

## 1.1.0 — 2026-11-07

- Multi-page channel, live match, finish-schedule, and article-detail theme experiment.
- Reverted in 1.1.1; the release remains available in the repository history.

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
