/**
 * Zhibo8 Modern — content script
 *
 * Supports the main zhibo8.com homepage, the video/news channel pages, and
 * the live match detail pages. The theme switch and modern header are shared
 * everywhere; the matchday rail is a homepage-only enhancement.
 *
 * All remote content is rendered with textContent / DOM APIs. No vendor HTML
 * is injected as markup.
 */
(() => {
  'use strict';

  const HOME_PATHS = new Set(['/', '/index.htm', '/index.html']);
  const PAGE_INFO = detectPage();

  if (!PAGE_INFO) return;

  const IS_HOME = PAGE_INFO.type === 'home';

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
  let channelHead = null;
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
  /* Page detection                                                      */
  /* ------------------------------------------------------------------ */

  function detectPage() {
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname;

    if (host === 'zhibo8.com' || host === 'www.zhibo8.com') {
      if (HOME_PATHS.has(path)) return { type: 'home', channel: 'home' };
      if (path.startsWith('/zhibo/')) {
        const sport = path.split('/')[2] || '';
        const channel = sport === 'nba' ? 'nba'
          : sport === 'zuqiu' ? 'zuqiu'
            : sport === 'game' ? 'dianjing'
              : 'other';
        return { type: 'live', channel };
      }
      if (path === '/schedule/finish_more.htm') {
        return { type: 'schedule', channel: 'schedule' };
      }
      if (/^\/nba\/?$/i.test(path)) return { type: 'zixun', channel: 'nba' };
      if (/^\/zuqiu\/?$/i.test(path)) return { type: 'zixun', channel: 'zuqiu' };
      if (path === '/dianjing/' || path === '/dianjing' || path === '/dianjing/video_list.htm') {
        return { type: 'media', channel: 'dianjing' };
      }
      if (path === '/other/' || path === '/other') {
        return { type: 'media', channel: 'other' };
      }
      if (/^\/(nba|zuqiu|other|game)\/\d{4}\//i.test(path)) {
        const segment = path.split('/')[1].toLowerCase();
        const channel = segment === 'game' ? 'dianjing' : segment;
        return { type: 'detail', channel };
      }
      return null;
    }

    if (host === 'news.zhibo8.com') {
      if (/^\/nba\/?$/i.test(path)) return { type: 'zixun', channel: 'nba' };
      if (/^\/zuqiu\/?$/i.test(path)) return { type: 'zixun', channel: 'zuqiu' };
      if (path === '/dianjing/' || path === '/dianjing') {
        return { type: 'media', channel: 'dianjing' };
      }
      if (path === '/other/' || path === '/other' || path === '/game/') {
        return { type: 'media', channel: 'other' };
      }
      if (/^\/(nba|zuqiu|other|game)\/\d{4}-\d{2}-\d{2}\//i.test(path)) {
        const segment = path.split('/')[1].toLowerCase();
        const channel = segment === 'game' ? 'dianjing' : segment;
        return { type: 'detail', channel };
      }
      return null;
    }

    return null;
  }

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
    root.dataset.zb8Page = PAGE_INFO.type;
    root.dataset.zb8Channel = PAGE_INFO.channel;
  }

  function boot() {
    if (booted) return;
    booted = true;
    if (IS_HOME) bindScheduleInteractions();
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
      root.dataset.zb8Page = PAGE_INFO.type;
      root.dataset.zb8Channel = PAGE_INFO.channel;
      ensureNavButton();
      markActiveNav();
      ensureChannelHeader();
      if (IS_HOME) {
        startObserving();
        scheduleScan();
      }
    } else {
      teardownUi();
      root.classList.remove('zb8-on');
      root.removeAttribute('data-zb8-theme');
      root.removeAttribute('data-zb8-page');
      root.removeAttribute('data-zb8-channel');
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
    markActiveNav();
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

  function markActiveNav() {
    const nav = document.querySelector('.menu .nav');
    if (!nav || !prefs.enabled) return;

    nav.querySelectorAll('.zb8-nav-active').forEach((node) => {
      node.classList.remove('zb8-nav-active');
      node.removeAttribute('aria-current');
    });

    if (PAGE_INFO.type === 'schedule') return;

    const targetPath = targetNavPath();
    if (!targetPath) return;

    const currentHost = normalizeHost(window.location.hostname);
    let directMatch = null;
    let childMatch = null;

    for (const anchor of nav.querySelectorAll('a[href]')) {
      let url;
      try {
        url = new URL(anchor.getAttribute('href') || '', window.location.href);
      } catch {
        continue;
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      if (normalizeHost(url.hostname) !== currentHost) continue;

      const hrefPath = normalizePath(url.pathname);
      const target = normalizePath(targetPath);
      const matches = target === '/'
        ? hrefPath === '/'
        : hrefPath === target || hrefPath.startsWith(`${target}/`);
      if (!matches) continue;

      if (anchor.closest('.child_navs')) {
        childMatch ||= anchor;
      } else {
        directMatch = anchor;
        break;
      }
    }

    let active = directMatch;
    if (!active && childMatch) {
      const parentList = childMatch.closest('.child_navs');
      const parentItem = parentList?.closest('li');
      active = parentItem?.querySelector(':scope > a') || null;
    }

    if (active) {
      active.classList.add('zb8-nav-active');
      active.setAttribute('aria-current', 'page');
    }
  }

  function targetNavPath() {
    if (PAGE_INFO.type === 'home') return '/';
    if (PAGE_INFO.type === 'live') {
      if (PAGE_INFO.channel === 'nba') return '/nba/';
      if (PAGE_INFO.channel === 'zuqiu') return '/zuqiu/';
      if (PAGE_INFO.channel === 'dianjing') return '/dianjing/';
      return '/other/';
    }
    if (PAGE_INFO.type === 'zixun') return `/${PAGE_INFO.channel}/`;
    if (PAGE_INFO.type === 'media') return `/${PAGE_INFO.channel}/`;
    if (PAGE_INFO.type === 'detail') {
      if (PAGE_INFO.channel === 'dianjing') return '/dianjing/';
      return `/${PAGE_INFO.channel}/`;
    }
    return '';
  }

  function normalizeHost(hostname) {
    return hostname.toLowerCase().replace(/^www\./, '');
  }

  function normalizePath(pathname) {
    if (!pathname || pathname === '/') return '/';
    return pathname.replace(/\/+$/, '') || '/';
  }

  /* ------------------------------------------------------------------ */
  /* Channel masthead                                                    */
  /* ------------------------------------------------------------------ */

  function ensureChannelHeader() {
    if (!prefs.enabled || IS_HOME || PAGE_INFO.type === 'live' || PAGE_INFO.type === 'detail') return;
    if (channelHead?.isConnected) return;

    const anchor = document.querySelector('#middle')
      || document.querySelector('.container.top_20')
      || document.querySelector('#record.vct-main');
    if (!anchor) return;

    const copy = channelHeadCopy();
    const count = channelContentCount();

    channelHead = document.createElement('section');
    channelHead.className = 'zb8-channel-head';
    channelHead.dataset.zb8Ui = 'channel-head';
    channelHead.dataset.channelLabel = copy.mark;

    const intro = document.createElement('div');
    intro.className = 'zb8-channel-copy';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'zb8-channel-eyebrow';
    const dot = document.createElement('i');
    dot.setAttribute('aria-hidden', 'true');
    eyebrow.append(dot, document.createTextNode(copy.eyebrow));

    const title = document.createElement('h1');
    title.textContent = copy.title;

    const sub = document.createElement('p');
    sub.textContent = copy.subtitle;

    intro.append(eyebrow, title, sub);

    const meta = document.createElement('div');
    meta.className = 'zb8-channel-meta';
    const countEl = document.createElement('span');
    countEl.className = 'zb8-channel-count';
    countEl.textContent = count;
    const badge = document.createElement('span');
    badge.className = 'zb8-channel-badge';
    badge.textContent = 'LIVEB8 · MODERN';
    meta.append(countEl, badge);

    channelHead.append(intro, meta);
    anchor.parentNode.insertBefore(channelHead, anchor);
  }

  function channelHeadCopy() {
    const news = window.location.hostname === 'news.zhibo8.com';
    if (PAGE_INFO.type === 'zixun') {
      const sport = PAGE_INFO.channel === 'nba' ? 'NBA' : '足球';
      return {
        eyebrow: `${PAGE_INFO.channel === 'nba' ? 'NBA' : 'FOOTBALL'} · ${news ? 'NEWSROOM' : 'HIGHLIGHTS'}`,
        title: `${sport} ${news ? '资讯' : '视频'}`,
        subtitle: news ? '最新消息、赛后采访与深度观察' : '最新集锦、采访与赛场瞬间',
        mark: PAGE_INFO.channel === 'nba' ? 'NBA' : 'FOOTBALL',
      };
    }

    if (PAGE_INFO.type === 'media') {
      const label = document.querySelector('.list-news .tlt')?.textContent.trim();
      const fallback = PAGE_INFO.channel === 'dianjing' ? '电竞' : '综合';
      const isVideo = label?.includes('视频');
      return {
        eyebrow: PAGE_INFO.channel === 'dianjing' ? 'ESPORTS · CHANNEL' : 'MULTI-SPORT · CHANNEL',
        title: label || fallback,
        subtitle: isVideo ? '赛场高光与热门片段' : '最新动态与赛场资讯',
        mark: PAGE_INFO.channel === 'dianjing' ? 'ESPORTS' : 'SPORTS',
      };
    }

    return {
      eyebrow: 'RESULTS · ARCHIVE',
      title: '完赛赛程',
      subtitle: '近期已结束比赛的比分与赛程回顾',
      mark: 'RESULTS',
    };
  }

  function channelContentCount() {
    if (PAGE_INFO.type === 'zixun') {
      const count = document.querySelectorAll('#middle .m_left .video').length;
      return `${count} 个话题`;
    }
    if (PAGE_INFO.type === 'media') {
      const count = document.querySelectorAll('.boxnew').length;
      return `${count} 条内容`;
    }
    const count = document.querySelectorAll('#record .vct-box ._content li').length;
    return count ? `${count} 场记录` : '赛程归档';
  }

  function removeChannelHeader() {
    channelHead?.remove();
    channelHead = null;
    document.querySelector('.zb8-channel-head')?.remove();
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
    if (!prefs.enabled || !IS_HOME) return;
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
    removeChannelHeader();
    navButton?.remove();
    navButton = null;
    document.querySelector('.schedule#zb8-schedule')?.removeAttribute('id');
    document.querySelectorAll('.menu .zb8-nav-active').forEach((node) => {
      node.classList.remove('zb8-nav-active');
      node.removeAttribute('aria-current');
    });
  }
})();
