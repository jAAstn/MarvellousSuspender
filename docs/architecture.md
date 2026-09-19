# Architektur – The Marvellous Suspender (Fork)

> Stand: v9.0.3 (Upstream) + Fork-Modul. Manifest V3, `minimum_chrome_version: 110`.
> Keine Build-Pipeline für den Code selbst – `src/` ist direkt als „Load unpacked“ ladbar.
> `grunt` erzeugt nur ZIP/CRX (`build/`), schaltet Debug-Flags um und ersetzt OAuth-Secrets.

## Kontexte (wo läuft was)

| Kontext | Einstieg | Module | Zweck |
|---|---|---|---|
| **Service Worker** | `js/background.js` | `tgs`, `gsTabSuspendManager`, `gsTabDiscardManager`, `gsTabCheckManager`, `gsSession`, `gsBackup`, `gsNewsFeed`, … | Event-Hub: alle `chrome.tabs/windows/alarms/commands/contextMenus`-Listener, Timer, Queues |
| **Offscreen Document** | `offscreen.html` / `js/offscreen.js` | – | Nur `navigator.getBattery()` (existiert nicht im SW) → meldet `charging` per Message an den SW |
| **Suspended-Platzhalter** | `suspended.html` / `js/suspended.js` | `gsFavicon`, `gsCustomSuspend` | Die Seite, die ein suspendierter Tab anzeigt; liest Titel/URL/Favicon aus dem URL-Hash |
| **Content Script** | `js/contentscript.js` (136 Zeilen) | – | Meldet Formular-Eingaben, Scroll-Position, temporäre Pause; empfängt Init/Update |
| **UI-Seiten** | `popup.html`, `options.html`, `history.html`, `recovery.html`, `debug.html`, `health.html`, `backup.html`, `shortcuts.html`, `about.html`, `news.html`, `permissions.html`, `update(d).html`, `restoring-window.html`, `broken.html` | jeweils `js/<name>.js` | Klassische Extension-Pages; importieren die gleichen ES-Module wie der SW (eigene Instanzen!) |

**Wichtig:** ES-Module werden pro Kontext neu instanziiert. `tgs.isCharging()` im Popup kennt den
Battery-Status des SW **nicht** (→ `undefined` = „unbekannt“). Zustand, der kontextübergreifend gebraucht
wird, geht über `chrome.storage` (local/session/sync) oder `chrome.runtime.sendMessage`.

## Kern-Module (`src/js/`)

```
background.js ──► tgs.js (Controller, 2300 Zeilen)
                    ├─ gsTabSuspendManager.js   Suspend-Queue (3 parallel, 60 s Timeout), Screenshot via html2canvas
                    ├─ gsTabDiscardManager.js   Discard-Queue (chrome.tabs.discard)
                    ├─ gsTabCheckManager.js     Startup-/Health-Checks suspendierter Tabs, Re-Init
                    ├─ gsTabQueue.js            generische Queue (Concurrency, Requeue, Deadline)
                    ├─ gsSession.js             Session-Snapshot (1 s debounce), Recovery, Restore (15 Tabs/s)
                    ├─ gsStorage.js             Settings (chrome.storage.local 'gsSettings' + sync), Tab-State (session)
                    ├─ gsIndexedDb.js (+idb.js) IndexedDB 'tgs' v5: Previews, SuspendedTabInfo, FaviconMeta, Sessions, Logs
                    ├─ gsFavicon.js             Favicon-Auflösung: Cache → chrome://favicon → tab.favIconUrl → Root-URL
                    ├─ gsMessages.js            sendMessage-Wrapper Richtung Content Script
                    ├─ gsChrome.js              Promise-Wrapper um chrome.* APIs mit Fehlerbehandlung
                    ├─ gsUtils.js               Helfer: URL-Hash, Whitelist-Matching, Logging-Puffer, i18n, Status-Konstanten
                    ├─ gsBackup.js              Auto-Backup lokal (downloads) / Google Drive (PKCE + refresh_token)
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
                                          │  checkTabEligibilityForSuspension (Whitelist, pinned, audio, Gruppe, offline, charging, Never)
                                          │  getContentScriptTabInfo (Formular? Scroll-Pos?)
                                          │  optional: Screenshot (html2canvas via Content Script)
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
- 3 = + offline, charging, Timeout „Never“ (automatischer Pfad)

## Speicher-Layer

| Speicher | Inhalt | Zugriff |
|---|---|---|
| `chrome.storage.local['gsSettings']` | **alle** Optionen als ein Objekt | `gsStorage.getOption()` → liest jedes Mal das ganze Objekt (kein Cache!) |
| `chrome.storage.sync` | Kopie der Settings (wenn `gsSyncSettings`) | Listener spiegelt zurück, Write-Lock gegen Races |
| `chrome.storage.session['gsTab<id>']` | transienter Tab-State (Scroll-Pos, Whitelist-on-reload, …) | `tgs.get/setTabStatePropForTabId` |
| IndexedDB `tgs` | Previews (Screenshots), SuspendedTabInfo, FaviconMeta, Current/Saved Sessions, Log-Einträge | `gsIndexedDb` (idb-Wrapper) |
| URL-Hash der Suspended-Seite | `ttl`, `pos`, `uri`, `[FORK] favicon` | `gsUtils.getHashVariable()` – **`uri=` muss letzter Parameter sein** |

## Status-Modell (`gsUtils.STATUS_*`)

`normal, active, suspended, discarded, special, whitelisted, tempWhitelist, formInput, pinned, audible,
appWindow, groupedTab, tabGroup, noConnectivity, charging, blockedFile, never, loading, unknown`.
Berechnet in `tgs.calculateTabStatus()`; treibt Popup-Text, Action-Icon (`setIconStatus`) und Debug-Seite.

## Build / Tooling

- `npm run lint` – ESLint 9 flat config (`eslint.config.mjs`), typescript-eslint strictTypeChecked via JSDoc
  (`// @ts-check` in einigen Dateien). Upstream hat ein paar bekannte Altfehler (`options.js` no-undef, `history.js` indent).
- `npm run check-locales` – vergleicht alle Locales mit `en`; Fork-Keys nur in `en`+`de` → 16 „missing“ erwartet.
- `npm run build` – grunt: copy → string-replace (debug off, OAuth-Secret) → crx/zip. Braucht `key.pem` + `gsOauthSecrets.local.js`.
- Kein Test-Runner. `package.json test` = `exit 1`.
- Crowdin (`crowdin.yml`) für Übersetzungen; `l10n_master`-Branch im Upstream.
