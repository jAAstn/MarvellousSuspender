// @ts-check
// ─────────────────────────────────────────────────────────────────────────────
// [FORK] gsCustomSuspend — persönliche Erweiterungen dieses Forks.
//
// Alles, was nicht aus dem Upstream (gioxx/MarvellousSuspender) stammt, lebt
// hier in einem eigenen Modul. Die Upstream-Dateien enthalten nur minimale
// Ein-Zeilen-Hooks, die mit "[FORK]" markiert sind — `grep -rn "\[FORK\]" src`
// listet nach einem Upstream-Merge alle Stellen, die geprüft werden müssen.
// Siehe docs/PERSOENLICHE_AENDERUNGEN.md und docs/UPSTREAM_UPDATE.md.
//
// Enthalten:
//   1. Custom Auto-Suspend Times  — Pro-URL-Override des globalen Timeouts
//   2. Favicon-Durchreichung       — data:-Favicons überleben den Suspend
//   3. History-Cleanup             — suspended.html-Platzhalter aus dem Verlauf
//   4. ZeroRAM-Migration           — Query-String-Format → TMS-Hash-Format
// ─────────────────────────────────────────────────────────────────────────────
import  { gsStorage }             from './gsStorage.js';
import  { gsUtils }               from './gsUtils.js';

export const gsCustomSuspend = (() => {
  'use strict';

  // ── 1. Custom Auto-Suspend Times ──────────────────────────────────────────

  /**
   * @typedef  {Object} CustomSuspendRule
   * @property {string} pattern   Regex (/…/), Wildcard (*), oder Substring
   * @property {number} minutes   0 = nie suspendieren
   */

  /**
   * @typedef  {Object} SuspendTimeInfo
   * @property {number}  minutes   Effektive Minuten (0 = nie)
   * @property {boolean} isCustom  true, wenn eine Custom-Regel gegriffen hat
   */

  /**
   * Parst die Textliste aus den Optionen. Eine Regel pro Zeile im Format
   * `PATTERN : MINUTES`. Komma als Dezimaltrenner erlaubt. Zeilen, die mit
   * `#` oder `//` beginnen, sind Kommentare. Ungültige Zeilen werden ignoriert.
   * Die Reihenfolge bleibt erhalten (erster Treffer gewinnt).
   *
   * @param   {string | undefined | null} raw
   * @returns {CustomSuspendRule[]}
   */
  function parseCustomSuspendTimes(raw) {
    /** @type {CustomSuspendRule[]} */
    const rules = [];
    if (!raw || typeof raw !== 'string') {
      return rules;
    }
    for (const rawLine of raw.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) {
        continue;
      }
      // Am *letzten* Doppelpunkt trennen, damit `https://…:30` funktioniert.
      const sep = line.lastIndexOf(':');
      if (sep <= 0) {
        continue;
      }
      const pattern    = line.substring(0, sep).trim();
      const minutesRaw = line.substring(sep + 1).trim().replace(',', '.');
      const minutes    = parseFloat(minutesRaw);
      if (!pattern || minutesRaw === '' || isNaN(minutes) || minutes < 0) {
        continue;
      }
      rules.push({ pattern, minutes });
    }
    return rules;
  }

  /**
   * Prüft ein einzelnes Pattern gegen eine URL.
   * Reihenfolge: Regex (/…/) → Wildcard (*) → Substring.
   * Regex und Substring laufen über gsUtils.testForMatch (gleiche Semantik wie
   * Whitelist / Always-Suspend-Liste), Wildcard ist eine Fork-Ergänzung.
   *
   * @param   {string} pattern
   * @param   {string} url
   * @returns {boolean}
   */
  function testPattern(pattern, url) {
    if (!pattern || !url) {
      return false;
    }
    const isRegex = pattern.length > 2 && pattern.startsWith('/') && pattern.endsWith('/');
    if (!isRegex && pattern.includes('*')) {
      const escaped = pattern
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*');
      try {
        return new RegExp(escaped).test(url);
      }
      catch {
        return false;
      }
    }
    return gsUtils.testForMatch(pattern, url);
  }

  /**
   * @param   {CustomSuspendRule[]} rules
   * @param   {string | undefined}  url
   * @returns {number | null}  Minuten der ersten passenden Regel oder null
   */
  function getCustomSuspendMinutesForUrl(rules, url) {
    if (!url || !rules.length) {
      return null;
    }
    for (const rule of rules) {
      if (testPattern(rule.pattern, url)) {
        return rule.minutes;
      }
    }
    return null;
  }

  // Memo: gsStorage.getOption() liest bei jedem Aufruf aus chrome.storage.local
  // (kein Cache im Upstream), das Parsen sparen wir uns aber, solange sich der
  // Rohtext nicht ändert.
  /** @type {string | null} */
  let _memoRaw   = null;
  /** @type {CustomSuspendRule[]} */
  let _memoRules = [];

  /**
   * @param   {string | undefined | null} raw
   * @returns {CustomSuspendRule[]}
   */
  function rulesFromRaw(raw) {
    const key = raw || '';
    if (key !== _memoRaw) {
      _memoRaw   = key;
      _memoRules = parseCustomSuspendTimes(key);
    }
    return _memoRules;
  }

  /**
   * @returns {Promise<CustomSuspendRule[]>}
   */
  async function getCustomSuspendRules() {
    return rulesFromRaw(await gsStorage.getOption(gsStorage.CUSTOM_SUSPEND_TIMES));
  }

  /**
   * Zentrale Auflösung: nimmt das bereits vom Upstream berechnete globale
   * Timeout (inkl. Battery-Override) und ersetzt es durch eine Custom-Regel,
   * falls eine greift.
   *
   * @param   {string | undefined}  url
   * @param   {string | number}     globalSuspendTime  Wert aus SUSPEND_TIME(_ON_BATTERY)
   * @returns {Promise<SuspendTimeInfo>}
   */
  async function resolveSuspendTime(url, globalSuspendTime) {
    const global = parseFloat(String(globalSuspendTime));
    const fallback = { minutes: isNaN(global) ? 0 : global, isCustom: false };
    // Hot path (calculateTabStatus, timer resets): ohne Regeln nichts parsen.
    const raw = await gsStorage.getOption(gsStorage.CUSTOM_SUSPEND_TIMES);
    if (!raw) {
      return fallback;
    }
    const custom = getCustomSuspendMinutesForUrl(rulesFromRaw(raw), url);
    return custom !== null ? { minutes: custom, isCustom: true } : fallback;
  }

  /**
   * Spiegelt die Upstream-Logik aus tgs.resetAutoSuspendTimerForTab(), damit
   * Kontexte ohne eigene Berechnung (z. B. das Popup) den effektiven globalen
   * Wert bekommen. `isCharging === false` ist der einzige Zustand, in dem der
   * Battery-Wert gilt (undefined = unbekannt → kein Override).
   *
   * @param   {boolean | undefined} isCharging
   * @returns {Promise<string>}
   */
  async function getEffectiveGlobalSuspendTime(isCharging) {
    let suspendTime = await gsStorage.getOption(gsStorage.SUSPEND_TIME);
    if (isCharging === false) {
      const onBattery = await gsStorage.getOption(gsStorage.SUSPEND_TIME_ON_BATTERY);
      if (onBattery !== '') {
        suspendTime = onBattery;
      }
    }
    return String(suspendTime ?? '');
  }

  /**
   * Formatiert die Popup-Zeile „Will suspend after …“. Leer, wenn 0/ungültig.
   *
   * @param   {SuspendTimeInfo | null} info
   * @returns {string}  reiner Text (kein HTML)
   */
  function formatSuspendTimeDetail(info) {
    if (!info || !(info.minutes > 0)) {
      return '';
    }
    let text;
    if (info.minutes < 60) {
      const mins = Number.isInteger(info.minutes) ? String(info.minutes) : info.minutes.toFixed(1);
      text = gsUtils.getMessage('js_popup_suspend_time_minutes', [mins]);
    }
    else {
      const hours = info.minutes / 60;
      const h = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, '');
      text = gsUtils.getMessage('js_popup_suspend_time_hours', [h]);
    }
    if (info.isCustom) {
      text += gsUtils.getMessage('js_popup_suspend_time_custom');
    }
    return text;
  }

  // ── 2. Favicon-Durchreichung ──────────────────────────────────────────────

  const FAVICON_HASH_KEY   = 'favicon';
  // Obergrenze, damit die Suspended-URL nicht unbegrenzt wächst (Session-
  // Speicher, Backups, chrome.tabs.update). http(s)-Favicons werden ohnehin
  // von gsFavicon über den Chrome-Cache neu aufgelöst — nur data:-URLs gehen
  // sonst verloren.
  const FAVICON_MAX_LENGTH = 16384;

  /**
   * @param   {string | undefined} favIconUrl
   * @returns {boolean}
   */
  function isPassthroughFavicon(favIconUrl) {
    return typeof favIconUrl === 'string'
      && favIconUrl.startsWith('data:')
      && favIconUrl.length < FAVICON_MAX_LENGTH;
  }

  /**
   * Liefert den Hash-Parameter (inkl. führendem `&`) oder '' — muss VOR `uri=`
   * eingefügt werden, da gsUtils.getHashVariable alles nach `uri=` als URI liest.
   *
   * @param   {string | undefined} favIconUrl
   * @returns {string}
   */
  function buildFaviconHashParam(favIconUrl) {
    if (!isPassthroughFavicon(favIconUrl)) {
      return '';
    }
    return `&${FAVICON_HASH_KEY}=${encodeURIComponent(/** @type {string} */ (favIconUrl))}`;
  }

  /**
   * @param   {string} suspendedUrl
   * @returns {string | undefined}  decodierte data:-URL oder undefined
   */
  function getFaviconFromSuspendedUrl(suspendedUrl) {
    const raw = gsUtils.getHashVariable(FAVICON_HASH_KEY, suspendedUrl);
    if (!raw) {
      return undefined;
    }
    const decoded = gsUtils.decodeString(raw);
    return isPassthroughFavicon(decoded) ? decoded : undefined;
  }

  // ── 3. History-Cleanup für Suspended-Platzhalter ──────────────────────────

  /**
   * chrome.tabs.update auf suspended.html erzeugt pro Suspend einen Verlaufs-
   * eintrag. Upstream räumt erst beim Unsuspend auf; wir löschen sofort nach
   * dem Suspend und erneut bei status==='complete' (Retry, falls der Eintrag
   * beim ersten Versuch noch nicht existierte). deleteUrl auf eine nicht
   * vorhandene URL ist ein No-op.
   *
   * @param {string | undefined} suspendedUrl
   */
  function removeTabHistoryForSuspendedTab(suspendedUrl) {
    if (!suspendedUrl) {
      return;
    }
    chrome.history.deleteUrl({ url: suspendedUrl }).catch((error) => {
      gsUtils.warning('gsCustomSuspend', 'removeTabHistoryForSuspendedTab', error);
    });
  }

  // ── 4. ZeroRAM-Migration ──────────────────────────────────────────────────

  const ZERORAM_EXTENSION_ID   = 'pciejkjdekpfadcjaincgoamekjljcfc';
  const ZERORAM_EXTENSION_NAME = 'ZeroRAM Suspender';

  /**
   * ZeroRAM (yhchiu/ZeroRAM-Suspender) speichert den Zustand im Query-String
   * statt im Hash: `suspended.html?uri=<enc>&ttl=<enc>[&favicon=<enc>]`.
   * Gibt eine fertige TMS-Suspended-URL zurück oder null, wenn das Format
   * nicht passt (dann greift der normale Host-Swap des Upstreams).
   *
   * @param   {URL} url
   * @returns {string | null}
   */
  function convertForeignSuspendedUrl(url) {
    if (!url.searchParams.has('uri')) {
      return null;
    }
    const originalUrl = url.searchParams.get('uri') || '';
    if (!/^(https?|file|ftp):/i.test(originalUrl)) {
      return null;
    }
    const title   = url.searchParams.get('ttl') || originalUrl;
    const favicon = url.searchParams.get('favicon') || undefined;
    return gsUtils.generateSuspendedUrl(originalUrl, title, '0', favicon);
  }

  return {
    // 1
    parseCustomSuspendTimes,
    testPattern,
    getCustomSuspendMinutesForUrl,
    getCustomSuspendRules,
    resolveSuspendTime,
    getEffectiveGlobalSuspendTime,
    formatSuspendTimeDetail,
    // 2
    buildFaviconHashParam,
    getFaviconFromSuspendedUrl,
    // 3
    removeTabHistoryForSuspendedTab,
    // 4
    ZERORAM_EXTENSION_ID,
    ZERORAM_EXTENSION_NAME,
    convertForeignSuspendedUrl,
  };
})();
