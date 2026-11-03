# Performance-Audit & Optimierungspotenzial

> **Stand:** 28.10.2026 · Manifest 9.1.0.1 · Branch `testing-bevor-merging-zu-eigen-+-mast`
> Grundlage: Code-Analyse plus lokale Mikrobenchmarks der Cache-Pfade. **Kein** Browser-Profiling –
> auf dem Dev-Rechner läuft kein automatisierter Chrome. Zahlen sind deshalb als Struktur-Aussagen
> dokumentiert, nicht als Laufzeitversprechen.

Legende: **Wo umsetzen?** · 🅵 im Fork (konfliktarm) · 🅄 upstream als PR vorschlagen · ⛔ nicht anfassen

---

## A. Settings-Zugriff ohne Cache — **erledigt (28.10.2026)**

**Befund (alt):** `gsStorage.getOption(key)` → `getSettings()` → `readSettings()` →
`chrome.storage.local.get('gsSettings')`. Jeder Options-Zugriff war ein voller asynchroner
Storage-Read plus Default-Backfill **und** ein `structuredClone` des ganzen Objekts. In
`calculateTabStatus()`, `resetAutoSuspendTimerForTab()` und `checkTabEligibilityForSuspension()`
summierte sich das auf zweistellig viele Reads pro Tab-Wechsel.

**Umgesetzt:**
- `settingsPromise` in `gsStorage.js` teilt den geladenen Zustand pro Kontext.
  `chrome.storage.onChanged` (Key `gsSettings`) setzt ihn auf `null`.
- `getOption()` liest direkt aus dem Cache; nur echte Objektwerte werden geklont, damit kein
  Aufrufer den Cache mutiert. `getSettings()` behält seinen Klon für mutierende Aufrufer.
- Unabhängige Options-/Schutz-Prüfungen laufen per `Promise.all` parallel, ohne die
  Auswertungsreihenfolge (und damit den gemeldeten Status) zu ändern.
- `isCharging()` wird pro Prüfung einmal gelesen statt zweimal.
- `gsUtils` cacht Listen-Splits, kompilierte Regexe, den zuletzt geparsten URL-Hash und die
  Chrome-Version.

**Was bleibt:** Der Cache ist pro Kontext; Popup und Service Worker lesen weiterhin getrennt.
Das ist Absicht (Chrome bleibt Quelle der Wahrheit, ADR-012). Ein kontextübergreifender Cache
wäre ein Konsistenzrisiko ohne klaren Gewinn.

---

## B. Startup mit vielen suspendierten Tabs

**Befund:** Beim Browserstart feuert `onUpdated(status='complete')` für jeden suspendierten Tab →
`handleSuspendedTabStateChanged` → `initialiseSuspendedTab` (Concurrency-Limit 5) →
`suspended.js initTab()` mit IndexedDB-Reads (Favicon-Cache, Preview) pro Tab.

- 🅵 Der Fork löscht zusätzlich `chrome.history.deleteUrl(tab.url)` pro Tab. Ein einzelner,
  nicht blockierender API-Call; bei 200 Tabs 200 History-Deletes beim Start. Unkritisch, aber
  im SW-Log sichtbar. **Option:** Retry nur für Tabs, die in dieser Session frisch suspendiert
  wurden (Marker in `chrome.storage.session`). Kostet eine Session-Read pro Tab – erst messen.
- ✅ `initTab()` holt `getSettings()` **einmal** und liest `APPEND_URL_TO_TITLE` und
  `RELOAD_UNSUSPEND_BACKGROUND` daraus, statt zwei weitere `getOption()`-Reads zu machen.
- ✅ Unabhängige Reads (Settings, Favicon, Preview, Suspend-Grund) laufen parallel, wo die
  Reihenfolge es erlaubt.

---

## C. Favicon-Passthrough vergrößert Suspended-URLs (🅵, Trade-off bewusst)

**Befund:** Bis 16 KB `data:`-URL im Hash → größere Einträge in `gsCurrentSessions`/
`gsSavedSessions` (IndexedDB) und in Backups, plus `chrome.tabs.update` mit langer URL.

**Einordnung:** Betrifft nur Tabs mit JS-injizierten `data:`-Favicons (selten). Ein typisches
16×16-PNG-Favicon als data-URL liegt bei 0,5–2 KB. Bei 1 000 gespeicherten Tabs wäre der
Worst Case ~16 MB, realistisch < 1 MB.

**Optionen, falls es stört:**
1. Limit auf 4 KB senken (`FAVICON_MAX_LENGTH`) – deckt fast alle echten Favicons ab.
2. Favicon in `gsIndexedDb.DB_FAVICON_META` unter der Original-URL ablegen statt in der URL.
   Nachteil: ein IndexedDB-Write pro Suspend im SW und ein Hook mehr. **Erst sinnvoll, wenn
   Upstream `getHashVariable`/`generateSuspendedUrl` ohnehin umbaut.**

---

## D. Session-Snapshot-Frequenz (🅄)

**Befund:** `tgs.queueSessionTimer()` (1 s Debounce) wird aus sechs `background.js`-Listenern
getriggert. `updateCurrentSession()` → `buildCurrentSession()` fragt alle Fenster/Tabs ab und
schreibt die komplette Session in IndexedDB. Bei aktiver Nutzung also ca. 1 Write/s mit
O(n Tabs) Payload.

**Vorschlag:** Debounce auf 3–5 s erhöhen **oder** einen Änderungs-Hash vergleichen und den
Write überspringen, wenn identisch. Crash-Recovery verliert dadurch höchstens wenige Sekunden.
Unverändert offen.

---

## E. Bundle-/Asset-Größe (niedrige Priorität)

| Asset | Größe | Bewertung |
|---|---|---|
| `js/snapdom.js` | ~250 KB | Ersetzt `html2canvas.min.js` (199 KB) für Screenshots. Wird nur bei Bedarf per `scripting.executeScript` in den Tab injiziert; im SW nur als Dateireferenz gebunden. Höhere Größe, dafür moderner und ohne Fremd-Canvas-Abhängigkeit. |
| `img/suspendy-guy-*.webp` (5×) | 16–88 KB | Nur auf Info-Seiten geladen. OK. |
| `font/*.woff2` | 48 + 40 KB | Variable Fonts, nur in Extension-Pages. OK. |
| `css/style.css` | ~48 KB | Eine Datei für alle Pages; Suspended-Seite hat `critical.css` + `suspended.css`. OK. |
| `js/tgs.js` | ~108 KB / ~2 450 Zeilen | Wartbarkeit, nicht Laufzeit. ⛔ (Upstream-Struktur) |

---

## F. Kleine Upstream-Beobachtungen (🅄, nur melden)

1. `removeTabHistoryForUnsuspendedTab()` (tgs.js) löscht per `getVisits().pop()`-Heuristik den
   vorletzten Besuch der Original-URL – der Kommentar im Code gibt selbst zu, dass das bei
   Mehrfachbesuchen falsch löscht. Sicherer: `visitTime` beim Suspend im Tab-State merken und
   exakt diesen Range löschen.
2. `options.js` referenzierte früher `setAutoBackupOptionsVisibility`,
   `setDriveDestinationVisibility`, `updateDriveAuthUI` ohne Definition (ESLint `no-undef`).
   **Status unklar/nicht erneut geprüft** – bei der nächsten Runde gegen den aktuellen Code
   verifizieren, bevor es als Finding gemeldet wird.
3. `popup.js setStatus()` ist `async` und wird bei jedem Retry von `getTabStatus()` komplett neu
   ausgeführt (innerHTML-Write). Für den Fork bedeutet das: `getSuspendTimeDetail()` läuft bei
   jedem Retry mit. Vernachlässigbar (Popup), aber ein Grund, dort nichts Schwereres einzuhängen.

---

## G. Was der Fork bewusst **nicht** optimiert

- Keine eigenen Caches über Kontexte hinweg (Popup ↔ SW) – der Zustand liegt korrekt in
  `chrome.storage`.
- Keine Änderung an Queue-Parametern (`concurrentExecutors`, `jobTimeout`) – Upstream hat diese
  in mehreren Review-Runden justiert.
- Keine Umstellung auf Bundler/Minifier – zerstört „Load unpacked“ und den Upstream-Workflow.

---

## Priorisierte Liste

| # | Maßnahme | Wo | Aufwand | Nutzen | Status |
|---|---|---|---|---|---|
| 1 | Settings-Cache + parallele Reads | 🅄/🅵 | mittel | hoch | **erledigt** |
| 2 | `suspended.js initTab()` auf einen `getSettings()`-Read | 🅄 | klein | mittel | **erledigt** |
| 3 | Session-Snapshot: Change-Hash oder längerer Debounce | 🅄 | klein | mittel | offen |
| 4 | `FAVICON_MAX_LENGTH` auf 4 KB oder Cache statt URL | 🅵 | klein | klein | offen |
| 5 | History-Retry nur für frisch suspendierte Tabs | 🅵 | klein | klein | offen, erst messen |
| 6 | `no-undef` in `options.js` gegen aktuellen Code prüfen | 🅄 Issue | – | Korrektheit | offen |
