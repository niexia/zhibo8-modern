/* Zhibo8 Modern — popup controller */
(() => {
  'use strict';

  const DEFAULTS = Object.freeze({
    enabled: true,
    theme: 'auto',
    showMatchBar: true,
  });
  const THEMES = new Set(['auto', 'light', 'dark']);
  const REPO_URL = 'https://github.com/niexia/zhibo8-modern';

  const els = {
    enabled: document.getElementById('enabled'),
    matchbar: document.getElementById('matchbar'),
    status: document.getElementById('status'),
    version: document.getElementById('version'),
    repo: document.getElementById('repo-link'),
    themeInputs: [...document.querySelectorAll('input[name="theme"]')],
  };

  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  let prefs = { ...DEFAULTS };

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

  function effectiveTheme() {
    if (prefs.theme === 'light' || prefs.theme === 'dark') return prefs.theme;
    return systemDark.matches ? 'dark' : 'light';
  }

  function applyPopupTheme() {
    document.documentElement.dataset.popupTheme = effectiveTheme();
  }

  function render() {
    els.enabled.checked = prefs.enabled;
    els.matchbar.checked = prefs.showMatchBar;
    for (const input of els.themeInputs) input.checked = input.value === prefs.theme;

    els.status.innerHTML = '<i aria-hidden="true"></i>';
    els.status.append(prefs.enabled ? '已启用' : '已停用');
    els.status.setAttribute('aria-live', 'polite');
    document.body.classList.toggle('is-off', !prefs.enabled);
    applyPopupTheme();
  }

  function readPrefs() {
    if (!globalThis.chrome?.storage?.sync) {
      render();
      return;
    }
    chrome.storage.sync.get(DEFAULTS, (stored) => {
      if (chrome.runtime.lastError) {
        render();
        return;
      }
      prefs = sanitize(stored);
      render();
    });
  }

  function writePrefs() {
    if (!globalThis.chrome?.storage?.sync) return;
    chrome.storage.sync.set(prefs, () => {
      // Read lastError to avoid an unchecked runtime error if the extension
      // context goes away while the popup is still open.
      void chrome.runtime.lastError;
    });
  }

  function update(partial) {
    prefs = sanitize({ ...prefs, ...partial });
    render();
    writePrefs();
  }

  els.enabled.addEventListener('change', () => update({ enabled: els.enabled.checked }));
  els.matchbar.addEventListener('change', () => update({ showMatchBar: els.matchbar.checked }));

  for (const input of els.themeInputs) {
    input.addEventListener('change', () => {
      if (input.checked) update({ theme: input.value });
    });
  }

  const onSystemThemeChange = () => {
    if (prefs.theme === 'auto') applyPopupTheme();
  };
  if (systemDark.addEventListener) systemDark.addEventListener('change', onSystemThemeChange);
  else systemDark.addListener(onSystemThemeChange);

  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      for (const key of Object.keys(DEFAULTS)) {
        if (changes[key]) prefs[key] = changes[key].newValue;
      }
      prefs = sanitize(prefs);
      render();
    });
  }

  if (globalThis.chrome?.runtime?.getManifest) {
    els.version.textContent = `v${chrome.runtime.getManifest().version}`;
  }

  els.repo.href = REPO_URL;

  readPrefs();
})();
