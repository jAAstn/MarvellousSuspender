# Testen (Fork)

Der Upstream hat keine Test-Suite (`npm test` → `exit 1`). Wir kombinieren:
1. Lint für die berührten Dateien,
2. einen Node-Smoke-Test des Fork-Moduls (ohne Browser),
3. eine manuelle Checkliste im Browser.

## 1. Lint

```sh
npx eslint --quiet src/js/gsCustomSuspend.js src/js/tgs.js src/js/gsTabSuspendManager.js \
  src/js/gsUtils.js src/js/popup.js src/js/suspended.js src/js/historyUtils.js src/js/history.js
```
Erwartung: nur der bekannte Upstream-Altfehler `history.js … indent` (liegt nicht in Fork-Code).

## 2. Node-Smoke-Test (Parser / Matcher / Favicon-Roundtrip / ZeroRAM)

Das Modul lädt `gsStorage`/`gsUtils` per ES-Import; im Smoke-Test werden die Imports herausgeschnitten
und minimale Stubs bereitgestellt. Als `smoke.mjs` im Repo-Root ausführen (`node smoke.mjs`), danach löschen
oder nach `/tmp` legen – **nicht committen**.

```js
globalThis.chrome = { runtime: { getURL: (p) => 'chrome-extension://abc/' + p }, i18n: { getMessage: (k, s) => k + ':' + JSON.stringify(s) } };
const src = (await import('node:fs')).readFileSync('src/js/gsCustomSuspend.js', 'utf8').replace(/import[^;]+;/g, '');
const gsStorage = { CUSTOM_SUSPEND_TIMES: 'x', SUSPEND_TIME: 'st', SUSPEND_TIME_ON_BATTERY: 'sb',
  async getOption(k) { return ({ x: 'youtube.com : 120\n# c\nhttps://*id=* : 2,5\n/^https?:\\/\\/mail\\.google\\.com/ : 0\nbad\nhttps://example.com:8080/path : 7', st: '0', sb: '' })[k]; } };
const gsUtils = {
  testForMatch(item, word) { if (item.length > 2 && item.startsWith('/') && item.endsWith('/')) { try { return new RegExp(item.slice(1,-1)).test(word); } catch { return false; } } return word.indexOf(item) >= 0; },
  getMessage(k, s) { return k + ':' + JSON.stringify(s); }, decodeString: decodeURIComponent, encodeString: encodeURIComponent, warning() {},
  getHashVariable(key, u) { let h = u.replace(/^[^#]+#+(.*)/, '$1'); const v = {}; const i = h.indexOf('uri='); if (i >= 0) { v.uri = h.substr(i+4); h = h.substr(0,i);} h.split('&').forEach(kp => { const m = kp.match(/^(.+)=(.+)/); if (m) v[m[1]] = m[2]; }); return v[key] || false; },
  generateSuspendedUrl(url, title, pos, fav) { return chrome.runtime.getURL(`suspended.html#ttl=${encodeURIComponent(title)}&pos=${pos||'0'}${gsCustomSuspend.buildFaviconHashParam(fav)}&uri=${url}`); },
};
let gsCustomSuspend; eval(src.replace('export const gsCustomSuspend', 'gsCustomSuspend'));

const rules = gsCustomSuspend.parseCustomSuspendTimes(await gsStorage.getOption('x'));
const t = (u) => gsCustomSuspend.getCustomSuspendMinutesForUrl(rules, u);
console.assert(t('https://www.youtube.com/watch') === 120, 'substring');
console.assert(t('https://foo.bar/?id=5') === 2.5, 'wildcard + komma');
console.assert(t('https://mail.google.com/x') === 0, 'regex → 0');
console.assert(t('https://example.com:8080/path/x') === 7, 'port-url (letzter doppelpunkt)');
console.assert(t('https://nothing.org') === null, 'kein treffer');
console.assert((await gsCustomSuspend.resolveSuspendTime('https://youtube.com', '0')).isCustom === true, 'custom schlägt global 0');
const fav = 'data:image/png;base64,iVBORw0KGgo=&x=1';
const surl = gsUtils.generateSuspendedUrl('https://a.b/c?d=1&e=2', 'T & Co', '0', fav);
console.assert(gsCustomSuspend.getFaviconFromSuspendedUrl(surl) === fav, 'favicon roundtrip');
console.assert(gsUtils.getHashVariable('uri', surl) === 'https://a.b/c?d=1&e=2', 'uri bleibt letzter param');
console.assert(gsCustomSuspend.buildFaviconHashParam('https://x/f.ico') === '', 'http favicon nicht angehängt');
console.assert(gsCustomSuspend.buildFaviconHashParam('data:' + 'a'.repeat(20000)) === '', 'größenlimit');
const z = new URL('chrome-extension://pciejkjdekpfadcjaincgoamekjljcfc/suspended.html?uri=' + encodeURIComponent('https://z.org/p?q=1') + '&ttl=Zero');
console.assert(gsCustomSuspend.convertForeignSuspendedUrl(z).endsWith('&uri=https://z.org/p?q=1'), 'zeroram');
console.assert(gsCustomSuspend.convertForeignSuspendedUrl(new URL('chrome-extension://klbibkeccnjlkjkiokjodocebajanakg/suspended.html#uri=https://x')) === null, 'tgs-format → null');
console.log('smoke ok');
```

## 3. Manuelle Checkliste (Chrome, „Load unpacked“ auf `src/`)

### Custom Auto-Suspend Times
- [ ] Optionen → Auto-Suspend: Textarea „Eigene Auto-Suspend-Zeiten“ erscheint **unter** der Always-Suspend-Liste.
- [ ] Globales Timeout auf „Never“ stellen → Textarea bleibt sichtbar (nicht `.autoSuspendOption`).
- [ ] Regel `example.com : 1` eintragen, `https://example.com` in Hintergrund-Tab öffnen → nach ~1 min suspendiert,
      obwohl global „Never“.
- [ ] Regel `example.com : 0` bei globalem 5 min → Tab wird **nicht** suspendiert; Popup zeigt „Automatic tab suspension disabled“.
- [ ] Regel ändern und speichern → offene Tabs bekommen sofort neuen Timer (Debug-Seite: Alarm-Zeit prüft man in
      `chrome://extensions` → Service Worker → Console, Log `resetAutoSuspendTimerForTab`).
- [ ] Reihenfolge: `example.com : 0` über `example.com : 5` → 0 gewinnt; vertauscht → 5 gewinnt (kein Sortieren beim Speichern).
- [ ] Kommentarzeile `# test` und leere Zeilen stören nicht.
- [ ] Battery (Laptop): Battery-Timeout gesetzt, Stecker ziehen → Tabs ohne Regel nehmen Battery-Wert, Tabs mit Regel behalten Regel.

### Popup-Zeile
- [ ] Normaler Tab: zweite kleinere Zeile „Wird nach X Min. ausgesetzt“ (de) bzw. „Will suspend after X min“ (en).
- [ ] ≥ 60 min → „… X Std.“ / „… X h“ (90 → 1.5, 120 → 2).
- [ ] Tab mit Custom-Regel → Suffix „(eigene Regel)“ / „(custom)“.
- [ ] Suspended Tab, Whitelist-Tab, `chrome://`-Tab → keine zweite Zeile.
- [ ] Klick auf „Not now“-Link im Status funktioniert weiterhin (Zeile darf den Link-Handler nicht stören).

### Favicon-Durchreichung
- [ ] Seite mit per JS gesetztem `data:`-Favicon (z. B. DevTools-Konsole:
      `document.querySelector('link[rel*=icon]')?.remove(); const l=document.createElement('link'); l.rel='icon'; l.href='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="red"/></svg>'; document.head.appendChild(l);`)
      → Tab suspendieren → roter Kreis bleibt Favicon des Platzhalters.
- [ ] Suspended-URL in Adressleiste enthält `&favicon=data%3A…` **vor** `&uri=`.
- [ ] Unsuspend (Klick) → Original-URL korrekt (kein Favicon-Rest in der URL).
- [ ] Normale Seite (http-Favicon) → URL enthält **kein** `favicon=`.
- [ ] Session-Manager (history.html): Session mit suspended Tabs wiederherstellen → Favicons korrekt.

### History-Cleanup
- [ ] Tab suspendieren → `chrome://history` enthält **keinen** `chrome-extension://…/suspended.html`-Eintrag.
- [ ] Original-URL bleibt im Verlauf.
- [ ] Browser-Neustart mit vielen suspended Tabs → keine Fehler im SW-Log (`removeTabHistoryForSuspendedTab`).

### ZeroRAM-Migration
- [ ] Test-Tab von Hand öffnen: `chrome-extension://pciejkjdekpfadcjaincgoamekjljcfc/suspended.html?uri=https%3A%2F%2Fexample.com&ttl=Beispiel`
      (lädt als Fehlerseite, URL bleibt) → history.html → Migrate → ID `pciejkjdekpfadcjaincgoamekjljcfc` wird als
      „ZeroRAM Suspender: 1 tabs“ erkannt → Migrate → Tab zeigt TMS-Platzhalter mit Titel „Beispiel“, Unsuspend → example.com.
- [ ] Great-Suspender-Format (`#ttl=…&uri=…`) migriert weiterhin per Host-Swap.

### Regression (Upstream-Verhalten unverändert)
- [ ] Leere Custom-Liste: Suspend/Unsuspend, Whitelist, Always-Suspend, Tab-Gruppen, „Suspend all“ wie vorher.
- [ ] Options speichern/laden ohne Fehler in der Konsole; Sync (zweites Profil) überträgt `gsCustomSuspendTimes`.
- [ ] `npm run check-locales` → genau die 8 Fork-Keys in 16 Locales als `missing`, sonst nichts Neues.
