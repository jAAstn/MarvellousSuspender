# Architektur – The Marvellous Suspender (Fork)

> **Stand:** 28.10.2026 · Manifest **9.1.0.1** · Branch `testing-bevor-merging-zu-eigen-+-mast`
> Upstream-Basis: 9.1.0-Release-Linie (`upstream/release/9.1.0`), nicht `upstream/master`
> (dort steht noch 9.0.3). Manifest V3, `minimum_chrome_version: 110`.
> Keine Build-Pipeline für den Code selbst – `src/` ist direkt als „Load unpacked“ ladbar.
> `grunt` erzeugt nur ZIP/CRX (`build/`), schaltet Debug-Flags um und ersetzt OAuth-Secrets.

## Kontexte (wo läuft was)

| Kontext | Einstieg | Module | Zweck |
|---|---|---|---|
| **Service Worker** | `js/background.js` | `tgs`, `gsTabSuspendManager`, `gsTabDiscardManager`, `gsTabCheckManager`, `gsSession`, `gsBackup`, `gsNewsFeed`, `gsPrecapture`, … | Event-Hub: alle `chrome.tabs/windows/alarms/commands/contextMenus`-Listener, Timer, Queues |
| **Offscreen Document** | `offscreen.html` / `js/offscreen.js` | – | Nur `navigator.getBattery()` (existiert nicht im SW) → meldet `charging` per Message an den SW |
| **Suspended-Platzhalter** | `suspended.html` / `js/suspended.js` | `gsFavicon`, `gsCustomSuspend`, `gsMascot` | Die Seite, die ein suspendierter Tab anzeigt; liest Titel/URL/Favicon aus dem URL-Hash |
| **Content Script** | `js/contentscript.js` | – | Meldet Formular-Eingaben, Scroll-Position, temporäre Pause; empfängt Init/Update |
| **UI-Seiten** | `popup.html`, `options.html`, `history.html`, `recovery.html`, `debug.html`, `health.html`, `backup.html`, `shortcuts.html`, `about.html`, `news.html`, `permissions.html`, `update(d).html`, `restoring-window.html`, `broken.html` | jeweils `js/<name>.js` | Klassische Extension-Pages; importieren die gleichen ES-Module wie der SW (eigene Instanzen!) |

**Wichtig:** ES-Module werden pro Kontext neu instanziiert. `tgs.isCharging()` im Popup kennt den
Battery-Status des SW **nicht** (→ `undefined` = „unbekannt“). Zustand, der kontextübergreifend gebraucht
wird, geht über `chrome.storage` (local/session/sync) oder `chrome.runtime.sendMessage`.

## Kern-Module (`src/js/`)

```
background.js ──► tgs.js (Controller, ~2.450 Zeilen)
                    ├─ gsTabSuspendManager.js   Suspend-Queue (3 parallel, 60 s Timeout), Screenshot via SnapDOM
                    ├─ gsTabDiscardManager.js   Discard-Queue (chrome.tabs.discard)
                    ├─ gsTabCheckManager.js     Startup-/Health-Checks suspendierter Tabs, Re-Init
                    ├─ gsTabQueue.js            generische Queue (Concurrency, Requeue, Deadline)
                    ├─ gsSession.js             Session-Snapshot (1 s debounce), Recovery, Restore
                    ├─ gsStorage.js             Settings (chrome.storage.local 'gsSettings' + sync), Tab-State (session)
                    ├─ gsAsyncLock.js           promise-chain mutex (Settings-Writes, Tab-Group-Seeding)
                    ├─ gsIndexedDb.js (+idb.js) IndexedDB 'tgs' v5: Previews, TabInfo, FaviconMeta, Sessions, Logs
                    ├─ gsFavicon.js             Favicon-Auflösung: Cache → chrome://favicon → tab.favIconUrl → Root-URL
                    ├─ gsPrecapture.js          nativer Screenshot pro sichtbarem Tab, bevor er suspendiert wird
                    ├─ gsMessages.js            sendMessage-Wrapper Richtung Content Script
                    ├─ gsChrome.js              Promise-Wrapper um chrome.* APIs mit Fehlerbehandlung
                    ├─ gsUtils.js               Helfer: URL-Hash, Whitelist-Matching, Logging-Puffer, i18n, Status
                    ├─ gsBackup.js              Auto-Backup lokal (downloads) / Google Drive (PKCE + refresh_token)
                    ├─ gsChangelog.js           liest src/CHANGELOG_USER.md fürs „What’s new“-Modal
                    ├─ gsNavBadge.js            ungelesen-Badge für den News-Feed in der Navigation
                    ├─ gsMascot.js              Default- vs. Legacy-Maskottchen-Pfade
                    └─ gsCustomSuspend.js       [FORK] siehe PERSOENLICHE_AENDERUNGEN.md
```

Zyklische Imports (`gsUtils ↔ tgs`, `gsUtils ↔ gsTabSuspendManager`, …) sind im Upstream normal und
funktionieren, weil alle Module IIFE-Objekte exportieren und sich erst zur Laufzeit gegenseitig aufrufen.

## Lebenszyklus eines Tabs

```
Tab aktiv ──(onActivated/onUpdated)──► tgs.resetAutoSuspendTimerForTab(tab)
                                          │  liest SUSPEND_TIME (+ Battery), [FORK] Custom-Regel
                                          ▼
                                    chrome.alarms.create(String(tab.id), { when })
                                          │
                     (Alarm feuert) background.alarmListener → parseInt(alarm.name)
                                          ▼
                     gsTabSuspendManager.queueTabForSuspension(tab, forceLevel=3)
                                          │  checkTabEligibilityForSuspension (Whitelist, pinned, audio,
                                          │  Gruppe, offline, charging, Never, Custom-Regel 0)
                                          │  getContentScriptTabInfo (Formular? Scroll-Pos?)
                                          │  optional: Screenshot (SnapDOM, per scripting.executeScript)
                                          ▼
                     gsUtils.generateSuspendedUrl(url, title, scrollPos, [FORK] favIconUrl)
                       = chrome-extension://<id>/suspended.html#ttl=…&pos=…[&favicon=…]&uri=<original>
                                          ▼
                     gsChrome.tabsUpdate(tab.id, { url })      [FORK] history.deleteUrl(suspendedUrl)
                                          ▼
                     onUpdated(status=complete) → tgs.handleSuspendedTabStateChanged
                                          │  [FORK] history.deleteUrl (Retry)
                                          ▼
                     tgs.initialiseSuspendedTab → sendMessage('initTab') → suspended.js initTab()
                                                     Titel, Favicon ([FORK] Passthrough → gsFavicon), Preview, Theme
```

**forceLevel** (in `checkTabEligibilityForSuspension`):
- 1 = erzwingen (nur Special-Tabs ausgenommen)
- 2 = + Whitelist, temporäre Pause, Formular, pinned, audible, App-Window, Gruppe, aktiver Tab
- 3 = + offline, charging, Timeout „Never“ / Custom-Regel 0 (automatischer Pfad)

## Speicher-Layer

| Speicher | Inhalt | Zugriff |
|---|---|---|
| `chrome.storage.local['gsSettings']` | **alle** Optionen als ein Objekt | `gsStorage.getOption()` liest aus einem pro Kontext geteilten Promise-Cache; `chrome.storage.onChanged` invalidiert ihn. `getSettings()` klont weiterhin für Aufrufer, die mutieren |
| `chrome.storage.sync` | Kopie der Settings (wenn `gsSyncSettings`) | Listener spiegelt zurück, `createAsyncLock()` gegen Write-Races |
| `chrome.storage.session['gsTab<id>']` | transienter Tab-State (Scroll-Pos, Whitelist-on-reload, …) | `tgs.get/setTabStatePropForTabId` |
| IndexedDB `tgs` **v5** | `gsPreviews`, `gsSuspendedTabInfo`, `gsFaviconMeta`, `gsCurrentSessions`, `gsSavedSessions`, `gsLogEntries` | `gsIndexedDb` (idb-Wrapper); Log-Einträge bewusst pro Record statt als ein Blob |
| IndexedDB `tmsPrecapture` | native Screenshots sichtbarer Tabs | `gsPrecapture` |
| URL-Hash der Suspended-Seite | `ttl`, `pos`, `uri`, `[FORK] favicon` | `gsUtils.getHashVariable()` – **`uri=` muss letzter Parameter sein** |

## Sicherheit der Suspended-Seite

`suspended.html` ist web-accessible (`<all_urls>`). Jeder Hash-Wert ist damit
angreiferkontrolliert. Zwei Schichten schützen:

1. **CSP** (`extension_pages`): `script-src 'self'`, `style-src 'self'`, `img-src 'self' data:
   chrome:`, `child-src 'self'`, `default-src 'self'` – kein injizierbares Skript, keine
   Inline-Styles, keine externen Bilder/Iframes.
2. **Schema-Filter**: `gsUtils.getOriginalUrl()` gibt nur `http:`, `https:` und `file:` zurück,
   alles andere wird verworfen, bevor es `chrome.tabs.update()`/`create()` erreicht.

Die Datenpfade in `suspended.js` (`setUrl`, `setTitle`, `setReason`) und in `historyItems.js`
(`sessionTitle`, `createEl`) schreiben Text; Bewertung und verbleibende reine Markup-Stellen:
[ISSUE-innerhtml.md](ISSUE-innerhtml.md).

## Status-Modell (`gsUtils.STATUS_*`)

`normal, active, suspended, discarded, special, whitelisted, tempWhitelist, formInput, pinned, audible,
appWindow, groupedTab, tabGroup, noConnectivity, charging, blockedFile, never, loading, unknown`.
Berechnet in `tgs.calculateTabStatus()`; treibt Popup-Text, Action-Icon (`setIconStatus`) und Debug-Seite.
Seit dem Performance-Pass laufen die unabhängigen Schutz-Prüfungen parallel; die Auswertungsreihenfolge
und damit der gemeldete Status bleiben unverändert.

## Build / Tooling

- `npm test` – Vitest 5 (`vitest.config.mjs`, `environment: 'node'`), Setup
  `tests/setup/chrome-stub.js`. **31 Dateien, 514 Tests; 513 grün, 1 bekannte Altlast**
  (`gsTabSuspendManager.eligibility.test.js`: numerische `0` als `SUSPEND_TIME`).
- `npm run test:e2e` – separater Lauf (`vitest.e2e.config.mjs`, `tests/e2e/`), nicht Teil von `npm test`.
- `npm run lint` – ESLint 9 flat config (`eslint.config.mjs`), Baseline mit **1.061** Einträgen.
  Aktueller Stand: **129 Errors, 760 Warnungen** (Altlasten; `npm run lint:ci` ist derzeit rot,
  weil einige neuere Testzeilen noch nicht in der Baseline stehen).
- `npm run check-locales` – vergleicht alle Locales mit `en`; Fork-Keys nur in `en`+`de` → 17 Locales mit „11 missing“ erwartet (Exit 1, informativ).
- `npx grunt zip` – kopiert `src/` nach `build/`, ersetzt Debug-Flags/OAuth-Secret, packt
  `build/zip/tms-9.1.0.1.zip`.
- Crowdin (`crowdin.yml`) für Übersetzungen; `l10n_master`-Branch im Upstream.
