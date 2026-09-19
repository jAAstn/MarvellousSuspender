# Performance-Audit & Optimierungspotenzial

> Stand: 19.09.2026, Upstream v9.0.3 + Fork. Grundlage: Code-Analyse (kein Profiling im Browser – auf dem
> Dev-Rechner ist kein Chrome verfügbar). Zahlen sind aus dem Quellcode abgeleitet, keine Messwerte.

Legende: **Wo umsetzen?** · 🅵 im Fork (konfliktarm) · 🅄 upstream als PR vorschlagen (im Fork nur, wenn der
Nutzen den Merge-Aufwand rechtfertigt) · ⛔ nicht anfassen

---

## A. Settings-Zugriff ohne Cache (größter Hebel)

**Befund:** `gsStorage.getOption(key)` → `getSettings()` → `readSettings()` → `chrome.storage.local.get('gsSettings')`.
**Jeder** Options-Zugriff ist ein voller asynchroner Storage-Read des gesamten Settings-Objekts plus Default-Backfill-Schleife.

- `tgs.js`: 21 Aufrufstellen, `gsUtils.js`: 19, `gsTabSuspendManager.js`: 12.
- `tgs.calculateTabStatus()` (läuft bei **jedem** Tab-Wechsel für das Action-Icon und bei jedem Popup-Öffnen)
  macht ~11 sequenzielle `getOption`/`isProtected*`-Aufrufe → ~11 Storage-Round-Trips pro Tab-Wechsel.
- Der Fork-Hook `resolveSuspendTime()` fügt in `calculateTabStatus`, `resetAutoSuspendTimerForTab` und
  `checkTabEligibilityForSuspension` je **einen** weiteren Read hinzu (~+10 %).

**Vorschlag 🅄 (Upstream-PR):** In-Memory-Cache in `gsStorage` – `_settingsCache` wird bei `saveSettings()` und im
`chrome.storage.onChanged`-Listener invalidiert/aktualisiert. Der Write-Lock (`withSettingsLock`) existiert bereits,
der Cache ist damit einfach konsistent zu halten. Erwartung: `calculateTabStatus` von ~11 auf 1 Storage-Read.

**Vorschlag 🅵 (Fork-Mitigation, bereits umgesetzt):** `gsCustomSuspend.rulesFromRaw()` memoisiert das Parsen auf den
Rohtext; bei leerer Liste kein Parsen. Der Storage-Read selbst bleibt (Upstream-Grenze).

**Weiterer 🅵-Schritt (optional):** `resolveSuspendTime()` könnte `gsStorage.getSettings()` einmal holen statt
`getOption`, falls Upstream irgendwann ein Objekt zurückgibt – aktuell kein Gewinn, da beide denselben Read machen.

---

## B. Startup mit vielen suspendierten Tabs

**Befund:** Beim Browserstart feuert `onUpdated(status='complete')` für jeden suspendierten Tab →
`handleSuspendedTabStateChanged` → `initialiseSuspendedTab` (Concurrency-Limit 5, gut) → `suspended.js initTab()`
mit IndexedDB-Reads (Favicon-Cache, Preview) pro Tab.

- 🅵 Fork fügt hier `chrome.history.deleteUrl(tab.url)` **pro Tab** hinzu. Ist ein einzelner, nicht blockierender
  API-Call, bei 200 Tabs also 200 History-Deletes beim Start. Unkritisch, aber messbar in der SW-Console.
  **Option:** Retry nur dann ausführen, wenn der Tab in dieser Session tatsächlich frisch suspendiert wurde
  (Marker in `chrome.storage.session` via `tgs.setTabStatePropForTabId`). Kostet eine Session-Read pro Tab – kein
  klarer Netto-Gewinn → **erst messen**.
- 🅄 `suspended.js initTab()` liest `gsStorage.getSettings()` **und** zusätzlich `getOption(APPEND_URL_TO_TITLE)`,
  `getOption(RELOAD_UNSUSPEND_BACKGROUND)` – drei Reads desselben Objekts. Ein `getSettings()` am Anfang reicht.

---

## C. Favicon-Passthrough vergrößert Suspended-URLs (🅵, Trade-off bewusst)

**Befund:** Bis 16 KB `data:`-URL im Hash → pro betroffenem Tab größere Einträge in
`gsCurrentSessions`/`gsSavedSessions` (IndexedDB) und in Backups (lokal/Drive), plus `chrome.tabs.update` mit langer URL.

**Einordnung:** Betrifft nur Tabs mit JS-injizierten `data:`-Favicons (selten). Ein typisches 16×16-PNG-Favicon
als data-URL liegt bei 0,5–2 KB. Bei 1 000 gespeicherten Tabs wäre der Worst Case ~16 MB, realistisch < 1 MB.

**Optionen, falls es doch stört:**
1. Limit auf 4 KB senken (`FAVICON_MAX_LENGTH`) – deckt fast alle echten Favicons ab.
2. Favicon statt in die URL in `gsIndexedDb.DB_FAVICON_META` unter der Original-URL schreiben (Upstream-Cache) –
   dann bräuchte es keinen URL-Parameter mehr; Nachteil: ein IndexedDB-Write pro Suspend im SW und ein Hook mehr
   in `gsTabSuspendManager` (der Cache-Key ist die Original-URL, also robust). **Empfehlung für später**, falls
   Upstream `getHashVariable`/`generateSuspendedUrl` umbaut.

---

## D. Session-Snapshot-Frequenz (🅄)

**Befund:** `tgs.queueSessionTimer()` (1 s Debounce) wird aus **sechs** `background.js`-Listenern getriggert
(onCreated/onRemoved/onUpdated/onReplaced/windows onCreated/onRemoved). `updateCurrentSession()` → `buildCurrentSession()`
fragt alle Fenster+Tabs ab und schreibt die komplette Session in IndexedDB. Bei aktiver Nutzung (Tab-Wechsel, Laden)
also ca. 1 Write/s mit O(n Tabs) Payload.

**Vorschlag:** Debounce auf 3–5 s erhöhen **oder** Änderungs-Hash (z. B. Join aller `tab.id|url`) vergleichen und
Write überspringen, wenn identisch. Crash-Recovery verliert dadurch höchstens wenige Sekunden.

---

## E. Bundle-/Asset-Größe (niedrige Priorität)

| Asset | Größe | Bewertung |
|---|---|---|
| `js/html2canvas.min.js` | 199 KB | Wird statisch in `gsTabSuspendManager.js` importiert (SW) **und** per `scripting.executeScript` in Tabs injiziert. Nur nötig, wenn Screenshot-Modus ≠ '0'. MV3-SW erlaubt kein dynamisches `import()` (siehe Upstream-CHANGELOG 9.0.3), daher ⛔ im Fork – die statische Bindung dient nur der Datei-Referenz. |
| `img/suspendy-guy-*.webp` (5×) | 64–90 KB je | Nur auf Info-Seiten geladen. OK. |
| `font/*.woff2` | 48 + 40 KB | Variable Fonts, nur in Extension-Pages. OK. |
| `css/style.css` | 45 KB | Eine Datei für alle Pages. Für die Suspended-Seite gibt es bereits `critical.css` + `suspended.css`. OK. |
| `js/tgs.js` | 98 KB / 2 300 Zeilen | Wartbarkeit, nicht Laufzeit. ⛔ (Upstream-Struktur) |

---

## F. Kleine Upstream-Beobachtungen (🅄, nur melden)

1. `removeTabHistoryForUnsuspendedTab()` (tgs.js) löscht per `getVisits().pop()`-Heuristik den vorletzten Besuch der
   Original-URL – der Kommentar im Code gibt selbst zu, dass das bei Mehrfachbesuchen falsch löscht. Sicherer:
   `visitTime` beim Suspend im Tab-State merken und exakt diesen Range löschen.
2. `options.js` referenziert `setAutoBackupOptionsVisibility`, `setDriveDestinationVisibility`, `updateDriveAuthUI`
   ohne Definition (ESLint `no-undef`) – vermutlich toter Code aus einer Backup-UI-Auslagerung; im Runtime-Pfad
   würde das einen `ReferenceError` werfen, wenn die Zweige erreicht werden (`pref === AUTO_BACKUP_*`).
3. `popup.js setStatus()` ist `async` und wird bei jedem Retry von `getTabStatus()` komplett neu ausgeführt
   (innerHTML-Write). Für den Fork bedeutet das: `getSuspendTimeDetail()` läuft bei jedem Retry mit → zwei Storage-Reads.
   Vernachlässigbar (Popup), aber ein Grund, dort nichts Schwereres einzuhängen.

---

## G. Was der Fork bewusst **nicht** optimiert

- Keine eigenen Caches über Kontexte hinweg (Popup ↔ SW) – der Zustand liegt korrekt in `chrome.storage`.
- Keine Änderung an Queue-Parametern (`concurrentExecutors`, `jobTimeout`) – Upstream hat diese in mehreren
  Review-Runden justiert (siehe CHANGELOG 9.0.3 „Frozen suspended tabs“).
- Keine Umstellung auf Bundler/Minifier – zerstört „Load unpacked“ und den Upstream-Workflow.

---

## Priorisierte Liste

| # | Maßnahme | Wo | Aufwand | Nutzen |
|---|---|---|---|---|
| 1 | Settings-Cache in `gsStorage` | 🅄 PR | mittel | hoch (jeder Tab-Wechsel) |
| 2 | `suspended.js initTab()` auf einen `getSettings()`-Read | 🅄 PR | klein | mittel (Startup × n Tabs) |
| 3 | Session-Snapshot: Change-Hash oder längerer Debounce | 🅄 PR | klein | mittel (Dauerlast) |
| 4 | `FAVICON_MAX_LENGTH` auf 4 KB oder Cache statt URL | 🅵 | klein | klein (nur data:-Favicons) |
| 5 | History-Retry nur für frisch suspendierte Tabs | 🅵 | klein | klein – erst messen |
| 6 | `no-undef` in `options.js` melden | 🅄 Issue | – | Korrektheit |
