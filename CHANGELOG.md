# Changelog

## 1.1.0 — 2026-11-07

- Added the modern shell to the NBA, football, esports, and multi-sport channel pages.
- Added redesigns for the news channels on `news.zhibo8.com`.
- Added full live-match page styling for football, basketball, and other sports, including scoreboards, event feeds, lineups, stats tables, and the comment area.
- Added a redesigned finished-schedule archive.
- Added a modern reading layout for news articles and video detail pages.
- Added channel mastheads, automatic active-navigation state, and a responsive channel/date/media grid.
- The header theme switch and popup enable/disable controls now work on every supported page.
- Improved dark-theme coverage for legacy subpage modules, tables, sidebar rows, and comment widgets.
- Kept external services (`比分`, `数据`, `资料`, `个人`) and legacy pages outside the content-script scope.

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
