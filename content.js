/**
 * Zhibo8 Modern — content script
 *
 * The content script only runs on the zhibo8.com homepage. It adds a modern
 * motion/layout layer on top of the original page: a theme switch in the
 * header and an optional matchday rail sourced from the page's own schedule.
 *
 * All remote content is rendered with textContent / DOM APIs. No vendor HTML
 * is injected as markup.
 */
(() => {
  'use strict';

  const HOME_PATHS = new Set(['/', '/index.htm', '/index.html']);
  if (!HOME_PATHS.has(window.location.pathname)) return;
  if (!/(^|\.)zhibo8\.com$/i.test(window.location.hostname)) return;

  const DEFAULTS = Object.freeze({
    enabled: true,
    theme: 'auto',
    showMatchBar: true,
  });
  const THEMES = new Set(['auto', 'light', 'dark']);
  const CACHE_KEY = 'zb8-modern:prefs:v1';
  const root = document.documentElement;
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  let prefs = { ...DEFAULTS, ...readCache() };
  let navButton = null;
  let hero = null;
  let observer = null;
  let scanTimer = 0;
  let popoverRaf = 0;
  let interactionsBound = false;
  let lastSignature = '';
  let booted = false;

  const icons = {
    sun: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2"></circle>
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"></path>
      </svg>`,
    moon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20.4 14.2A8.4 8.4 0 0 1 9.8 3.6 8.5 8.5 0 1 0 20.4 14.2Z"></path>
      </svg>`,
    arrow: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6"></path>
      </svg>`,
    chevron: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m9 6 6 6-6 6"></path>
      </svg>`,
  };

  /* ------------------------------------------------------------------ */
  /* Preferences                                                         */
  /* ------------------------------------------------------------------ */

  function sanitize(input) {
    const merged = { ...DEFAULTS, ...input };
    return {
      enabled: typeof merged.enabled === 'boolean' ? merged.enabled : DEFAULTS.enabled,
      theme: THEMES.has(merged.theme) ? merged.theme : DEFAULTS.theme,
      showMatchBar: typeof merged.showMatchBar === 'boolean'
        ? merged.showMatchBar
        : DEFAULTS.showMatchBar,
    };
  }

  function readCache() {
    try {
      const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
      return cached && typeof cached === 'object' ? sanitize(cached) : {};
    } catch {
      return {};
    }
  }

  function writeCache() {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(prefs));
    } catch {
      /* Storage can be unavailable in private contexts. Preferences still
         persist through chrome.storage. */
    }
  }

  function loadPrefs() {
    if (!globalThis.chrome?.storage?.sync) return;
    try {
      chrome.storage.sync.get(DEFAULTS, (stored) => {
        if (chrome.runtime.lastError) return;
        prefs = sanitize(stored);
        writeCache();
        applyPrefs();
      });
    } catch {
      /* The extension context may have been invalidated after an update. */
    }
  }

  function savePrefs() {
    writeCache();
    if (!globalThis.chrome?.storage?.sync) return;
    try {
      chrome.storage.sync.set(prefs, () => {
        // Reading lastError prevents "Unchecked runtime.lastError" noise.
        void chrome.runtime.lastError;
      });
    } catch {
      /* Ignore invalidated extension contexts. */
    }
  }

  function effectiveTheme() {
    if (prefs.theme === 'light' || prefs.theme === 'dark') return prefs.theme;
    return darkQuery.matches ? 'dark' : 'light';
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  // Paint before the body renders. CSS is loaded through the manifest but all
  // of its selectors are scoped to .zb8-on, so this is also the kill switch.
  if (prefs.enabled) {
    root.classList.add('zb8-on');
    root.dataset.zb8Theme = prefs.theme;
  }

  function boot() {
    if (booted) return;
    booted = true;
    bindScheduleInteractions();
    applyPrefs();
    loadPrefs();

    if (globalThis.chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        const next = { ...prefs };
        for (const key of Object.keys(DEFAULTS)) {
          if (changes[key]) next[key] = changes[key].newValue;
        }
        prefs = sanitize(next);
        writeCache();
        applyPrefs();
      });
    }

    const onSchemeChange = () => {
      if (prefs.theme === 'auto' && prefs.enabled) updateNavButton();
    };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSchemeChange);
    else darkQuery.addListener(onSchemeChange);

    window.addEventListener('resize', () => {
      if (hero) updateRailButtons(hero);
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  function applyPrefs() {
    if (prefs.enabled) {
      root.classList.add('zb8-on');
      root.dataset.zb8Theme = prefs.theme;
      ensureNavButton();
      startObserving();
      scheduleScan();
    } else {
      teardownUi();
      root.classList.remove('zb8-on');
      root.removeAttribute('data-zb8-theme');
    }
    updateNavButton();
  }

  /* ------------------------------------------------------------------ */
  /* Header switch                                                       */
  /* ------------------------------------------------------------------ */

  function ensureNavButton() {
    if (!prefs.enabled) return;
    const container = document.querySelector('.menu .container');
    if (!container) return;

    if (navButton?.isConnected) {
      updateNavButton();
      return;
    }

    navButton = document.createElement('div');
    navButton.className = 'zb8-nav-tools';
    navButton.dataset.zb8Ui = 'theme-switch';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'zb8-theme-btn';
    button.innerHTML = `<span class="zb8-theme-icon">${icons.sun}${icons.moon}</span>`;
    button.addEventListener('click', () => {
      const nextTheme = effectiveTheme() === 'dark' ? 'light' : 'dark';
      prefs = sanitize({ ...prefs, theme: nextTheme });
      savePrefs();
      applyPrefs();
    });

    navButton.appendChild(button);
    const user = container.querySelector('.user');
    container.insertBefore(navButton, user || null);
    updateNavButton();
  }

  function updateNavButton() {
    if (!navButton?.isConnected) return;
    const mode = effectiveTheme();
    navButton.dataset.mode = mode;
    const button = navButton.querySelector('button');
    if (!button) return;

    const nextLabel = mode === 'dark' ? '浅色' : '深色';
    const autoHint = prefs.theme === 'auto' ? '（当前跟随系统）' : '';
    button.setAttribute('aria-label', `切换到${nextLabel}主题${autoHint}`);
    button.title = `切换到${nextLabel}主题${autoHint}`;
  }

  /* ------------------------------------------------------------------ */
  /* Schedule scanning                                                   */
  /* ------------------------------------------------------------------ */

  function bindScheduleInteractions() {
    if (interactionsBound) return;
    interactionsBound = true;

    window.addEventListener('scroll', schedulePopoverSync, { passive: true });
    window.addEventListener('resize', schedulePopoverSync, { passive: true });

    // The host opens its filter panel through a jQuery click handler. Sync
    // after the panel becomes visible (and once more after its fade-in).
    document.addEventListener('click', (event) => {
      if (!prefs.enabled || !event.target.closest?.('#shaixuan')) return;
      window.setTimeout(syncSchedulePopover, 0);
      window.setTimeout(syncSchedulePopover, 80);
      window.setTimeout(syncSchedulePopover, 300);
    }, true);
  }

  function schedulePopoverSync() {
    if (popoverRaf) return;
    popoverRaf = window.requestAnimationFrame(() => {
      popoverRaf = 0;
      syncSchedulePopover();
    });
  }

  // The schedule filter bar is sticky. Keep the host's absolutely-positioned
  // filter panel attached to it instead of leaving the panel stranded at the
  // top of the schedule when the page is scrolled.
  function syncSchedulePopover() {
    if (!prefs.enabled || !document.body) return;
    const panel = document.querySelector('.schedule > .more-stype');
    if (!panel) return;

    if (getComputedStyle(panel).display === 'none') {
      undockSchedulePopover(panel);
      return;
    }

    const schedule = panel.parentElement;
    const bar = schedule.querySelector(':scope > .stype');
    const menu = document.querySelector('.menu');
    if (!bar || !menu) {
      undockSchedulePopover(panel);
      return;
    }

    const headerBottom = menu.getBoundingClientRect().bottom;
    const barRect = bar.getBoundingClientRect();
    const stuck = barRect.top <= headerBottom + 1;

    if (!stuck) {
      undockSchedulePopover(panel);
      return;
    }

    const scheduleRight = schedule.getBoundingClientRect().right;
    const top = Math.round(barRect.bottom + 8);
    const right = Math.max(20, Math.round(window.innerWidth - scheduleRight + 20));
    const maxHeight = Math.max(320, Math.round(window.innerHeight - top - 16));

    panel.classList.add('zb8-popover-docked');
    panel.style.position = 'fixed';
    panel.style.top = `${top}px`;
    panel.style.right = `${right}px`;
    panel.style.maxHeight = `${maxHeight}px`;
    panel.style.overflowY = 'auto';
  }

  function undockSchedulePopover(panel) {
    if (!panel) return;
    panel.classList.remove('zb8-popover-docked');
    panel.style.removeProperty('position');
    panel.style.removeProperty('top');
    panel.style.removeProperty('right');
    panel.style.removeProperty('max-height');
    panel.style.removeProperty('overflow-y');
  }

  function startObserving() {
    if (observer || !document.body) return;
    observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserving() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  }

  function scheduleScan() {
    if (!prefs.enabled) return;
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      if (!prefs.enabled) return;
      try {
        ensureNavButton();

        if (!prefs.showMatchBar) {
          removeHero();
          return;
        }

        const model = readSchedule();
        if (!model) return;
        renderHero(model);
        syncSchedulePopover();
      } catch (error) {
        // A host markup change should never take the original page down. The
        // stylesheet can keep working even if the optional match rail cannot.
        console.warn('[Zhibo8 Modern] Could not refresh the matchday rail.', error);
      }
    }, 180);
  }

  function setScheduleAnchor() {
    const schedule = document.querySelector('.schedule');
    if (!schedule) return null;
    if (!schedule.id) schedule.id = 'zb8-schedule';
    return schedule;
  }

  function readSchedule() {
    const schedule = setScheduleAnchor();
    if (!schedule) return null;

    markEmptyDays(schedule);

    const dayBoxes = [...schedule.querySelectorAll('.vct-box')]
      .filter((box) => box.querySelector('._content li'));
    if (!dayBoxes.length) return null;

    const activeDay = dayBoxes[0];
    const rows = [...activeDay.querySelectorAll('._content > ul > li')];
    if (!rows.length) return null;

    const title = activeDay.querySelector('._header ._title');
    const dayLabel = (title?.textContent || '').trim();
    const dayIso = title?.getAttribute('title') || '';

    const counts = { football: 0, basketball: 0, other: 0 };
    for (const row of rows) {
      const type = row.dataset.type;
      if (type === 'football') counts.football += 1;
      else if (type === 'basketball') counts.basketball += 1;
      else counts.other += 1;
    }

    const cards = [];
    for (const row of rows) {
      const teams = row.querySelector('._teams');
      if (!teams || !teams.querySelector('img')) continue;

      const clone = teams.cloneNode(true);
      const names = wrapTeamText(clone);
      if (!names.length) continue;

      const time = (row.querySelector('time')?.textContent || '').trim();
      const league = (row.querySelector('._league')?.textContent || '').trim();
      const anchor = row.querySelector('a[href]');
      const href = safeAnchorHref(anchor);

      cards.push({ time, league, clone, href, type: row.dataset.type || 'other' });
      if (cards.length === 10) break;
    }

    if (!cards.length) return null;

    return {
      dayLabel,
      dayIso,
      counts,
      total: rows.length,
      cards,
    };
  }

  // Wrap team-name text nodes so the new rail can typeset each side without
  // changing the original page.
  function safeAnchorHref(anchor) {
    if (!anchor) return '';
    const raw = anchor.getAttribute('href') || '';
    if (/^\s*(?:javascript|data|vbscript):/i.test(raw)) return '';
    return anchor.href;
  }

  // Empty future dates take up a lot of vertical room on the host page. Keep
  // the dates visible but render them as slim dividers until the host fills
  // them with matches.
  function markEmptyDays(schedule) {
    for (const box of schedule.querySelectorAll(':scope > .vct-box')) {
      const empty = !box.querySelector('._content li');
      box.classList.toggle('zb8-empty-day', empty);
    }
  }

  function wrapTeamText(node) {
    const names = [];

    const walk = (parent) => {
      for (const child of [...parent.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent.replace(/\s+/g, ' ').trim();
          if (!text) {
            child.remove();
            continue;
          }
          const span = document.createElement('span');
          span.textContent = text;
          if (isDivider(text)) {
            span.className = 'zb8-score-divider';
          } else {
            span.className = 'zb8-team-name';
            names.push(text);
          }
          child.replaceWith(span);
          continue;
        }

        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        if (child.tagName === 'IMG') {
          child.classList.add('zb8-rail-logo');
          child.setAttribute('loading', 'lazy');
          child.setAttribute('decoding', 'async');
          continue;
        }
        if (child.tagName === 'A') {
          // Defensive: never carry links into the generated anchor card.
          const text = document.createElement('span');
          text.className = 'zb8-team-name';
          text.textContent = child.textContent.trim();
          if (text.textContent) names.push(text.textContent);
          child.replaceWith(text);
          continue;
        }
        walk(child);
      }
    };

    walk(node);
    return names;
  }

  function isDivider(text) {
    return /^[-–—−vsVS·:：]+$/.test(text);
  }

  /* ------------------------------------------------------------------ */
  /* Matchday hero                                                       */
  /* ------------------------------------------------------------------ */

  function ensureHero() {
    if (hero?.isConnected) return hero;
    const main = document.querySelector('.vct-main');
    if (!main) return null;

    hero = document.createElement('section');
    hero.id = 'zb8-hero';
    hero.className = 'zb8-hero';
    hero.dataset.zb8Ui = 'matchday';
    hero.setAttribute('aria-label', '今日赛程速览');

    hero.addEventListener('click', (event) => {
      const button = event.target.closest('.zb8-rail-btn');
      if (!button) return;
      const rail = hero.querySelector('.zb8-rail');
      if (!rail) return;
      const direction = button.dataset.direction === 'prev' ? -1 : 1;
      rail.scrollBy({ left: direction * rail.clientWidth * 0.82, behavior: 'smooth' });
    });

    hero.addEventListener('scroll', () => updateRailButtons(hero), true);

    main.parentNode.insertBefore(hero, main);
    return hero;
  }

  function removeHero() {
    if (hero) {
      hero.remove();
      hero = null;
      lastSignature = '';
    }
    document.getElementById('zb8-hero')?.remove();
  }

  function renderHero(model) {
    if (!prefs.enabled || !prefs.showMatchBar) return;
    if (!document.querySelector('.vct-main')) return;

    const signature = JSON.stringify({
      day: model.dayLabel,
      total: model.total,
      counts: model.counts,
      cards: model.cards.map((card) => [
        card.href,
        card.time,
        card.league,
        card.clone.textContent,
      ]),
    });
    if (signature === lastSignature && hero?.isConnected) return;

    const section = ensureHero();
    if (!section) return;
    lastSignature = signature;

    const displayDate = model.dayLabel || model.dayIso;

    section.innerHTML = `
      <div class="zb8-hero-copy">
        <span class="zb8-eyebrow"><i aria-hidden="true"></i>MATCH CENTER</span>
        <h2>比赛日<span class="zb8-hero-dot" aria-hidden="true">·</span><span class="zb8-hero-date"></span></h2>
        <p class="zb8-hero-sub"><span class="zb8-hero-day"></span><span class="zb8-sep" aria-hidden="true"></span>今日 <strong class="zb8-hero-count"></strong> 场赛事</p>
        <div class="zb8-hero-stats" aria-label="赛事分类统计"></div>
        <a class="zb8-hero-cta" href="#zb8-schedule">查看完整赛程 ${icons.arrow}</a>
      </div>
      <div class="zb8-hero-main">
        <div class="zb8-rail-controls">
          <button type="button" class="zb8-rail-btn" data-direction="prev" aria-label="上一组比赛">
            <span class="zb8-chevron-prev">${icons.chevron}</span>
          </button>
          <button type="button" class="zb8-rail-btn" data-direction="next" aria-label="下一组比赛">
            ${icons.chevron}
          </button>
        </div>
        <div class="zb8-rail" role="list" aria-label="今日对阵"></div>
      </div>`;

    const dateNode = section.querySelector('.zb8-hero-date');
    if (dateNode) dateNode.textContent = shortDate(model.dayIso, displayDate);
    const dayNode = section.querySelector('.zb8-hero-day');
    if (dayNode) dayNode.textContent = weekdayLabel(displayDate);
    const countNode = section.querySelector('.zb8-hero-count');
    if (countNode) countNode.textContent = String(model.total);

    const stats = section.querySelector('.zb8-hero-stats');
    if (stats) {
      stats.append(
        statChip('足球', model.counts.football, 'football'),
        statChip('篮球', model.counts.basketball, 'basketball'),
        statChip('其他', model.counts.other, 'other'),
      );
    }

    const rail = section.querySelector('.zb8-rail');
    if (rail) {
      const fragment = document.createDocumentFragment();
      for (const card of model.cards) fragment.appendChild(createMatchCard(card));
      rail.replaceChildren(fragment);
    }

    requestAnimationFrame(() => updateRailButtons(section));
  }

  function statChip(label, value, type) {
    const el = document.createElement('span');
    el.className = 'zb8-stat';
    el.dataset.type = type;

    const dot = document.createElement('i');
    dot.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.textContent = label;
    const count = document.createElement('b');
    count.textContent = String(value);

    el.append(dot, name, count);
    return el;
  }

  function createMatchCard(card) {
    const link = document.createElement(card.href ? 'a' : 'div');
    link.className = 'zb8-match';
    link.dataset.type = card.type;
    link.setAttribute('role', 'listitem');

    if (card.href) {
      link.href = card.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }

    const meta = document.createElement('span');
    meta.className = 'zb8-match-meta';

    const time = document.createElement('time');
    time.className = 'zb8-match-time';
    time.textContent = card.time || '--:--';

    const league = document.createElement('span');
    league.className = 'zb8-match-league';
    league.textContent = card.league || '赛事';

    meta.append(time, league);

    const teams = document.createElement('span');
    teams.className = 'zb8-match-teams';
    teams.append(...card.clone.childNodes);

    const hint = document.createElement('span');
    hint.className = 'zb8-match-hint';
    hint.innerHTML = `<span>查看比赛</span>${icons.arrow}`;

    link.append(meta, teams, hint);

    const names = [...teams.querySelectorAll('.zb8-team-name')]
      .map((el) => el.textContent.trim())
      .filter(Boolean);
    link.setAttribute(
      'aria-label',
      `${card.time || ''} ${card.league || ''} ${names.join(' 对 ')}`.trim(),
    );

    return link;
  }

  function updateRailButtons(section) {
    const rail = section?.querySelector?.('.zb8-rail');
    if (!rail) return;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    const prev = section.querySelector('.zb8-rail-btn[data-direction="prev"]');
    const next = section.querySelector('.zb8-rail-btn[data-direction="next"]');
    if (prev) prev.disabled = rail.scrollLeft <= 2;
    if (next) next.disabled = rail.scrollLeft >= maxScroll - 2;
    section.classList.toggle('is-static', maxScroll <= 2);
  }

  function shortDate(iso, fallback) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (match) return `${match[2]}.${match[3]}`;
    return fallback.replace(/星期[一二三四五六日天]$/, '').trim();
  }

  function weekdayLabel(label) {
    const match = /(星期[一二三四五六日天])/.exec(label || '');
    return match ? match[1] : label || '';
  }

  /* ------------------------------------------------------------------ */
  /* Teardown                                                            */
  /* ------------------------------------------------------------------ */

  function teardownUi() {
    stopObserving();
    window.clearTimeout(scanTimer);
    scanTimer = 0;
    lastSignature = '';
    undockSchedulePopover(document.querySelector('.schedule > .more-stype'));
    removeHero();
    navButton?.remove();
    navButton = null;
    document.querySelector('.schedule#zb8-schedule')?.removeAttribute('id');
  }
})();
