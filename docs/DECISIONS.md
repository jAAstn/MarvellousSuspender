# Entscheidungen (ADR-Stil)

Kurzformat: Kontext → Entscheidung → Konsequenzen. Neue Einträge oben anfügen, alte nie löschen
(bei Änderung als „ersetzt durch ADR-n“ markieren).

---

## ADR-007 · Kein Test-Runner, sondern Node-Smoke-Test + manuelle Checkliste

**Kontext:** Upstream hat keine Tests. Ein Jest/Vitest-Setup würde `package.json`, Config-Dateien und evtl.
ESLint-Config berühren → Merge-Konflikte bei jedem Upstream-Update.
**Entscheidung:** Smoke-Test als Vorlage in `docs/TESTING.md` (Stubs, `eval` des Moduls), manuelle
Browser-Checkliste. Keine Test-Dateien im Repo.
**Konsequenzen:** Kein CI-Schutz; Disziplin nötig, die Checkliste nach Merges abzuarbeiten.

## ADR-006 · i18n nur `en` + `de`

**Kontext:** 19 Locales; `check-locales` flaggt fehlende Keys. Alle 19 anzufassen = 19 Konfliktdateien.
**Entscheidung:** `en` (Default-Locale, Chrome-Fallback) + `de`. `check-locales`-Meldungen für die Fork-Keys (aktuell 11)
sind akzeptiert.
**Konsequenzen:** Nutzer anderer Sprachen sehen die Fork-Strings englisch. Kein Crowdin-Sync für den Fork.

## ADR-005 · Fork-Abschnitte in CHANGELOG.md / README.md am Dateiende, auf Deutsch

**Kontext:** Upstream schreibt neue Einträge immer oben (`## [Unreleased]`); jeder Eingriff dort konfligiert.
**Entscheidung:** Eigener Abschnitt am Dateiende, Deutsch (wie `docs/`). Detail-Doku bleibt in `docs/`.
**Konsequenzen:** Fork-Einträge sind weniger prominent; Konfliktrisiko ≈ 0.

## ADR-004 · Custom-Regel `0` liefert `STATUS_NEVER` (kein eigener Status)

**Kontext:** Ein neuer `gsUtils.STATUS_*`-Wert müsste in `calculateTabStatus`, `popup.js`, `setIconStatus`,
Debug-Seite und i18n eingezogen werden – viele Upstream-Stellen.
**Entscheidung:** `resolveSuspendTime(...).minutes === 0` → bestehender `STATUS_NEVER`. Popup zeigt den
Upstream-Text ohne `(custom)`-Hinweis.
**Konsequenzen:** Minimaler Eingriff; leichte Ungenauigkeit im Popup (siehe Roadmap).

## ADR-003 · Favicon nur als `data:`-URL < 16 KB durchreichen

**Kontext:** `http(s)`-Favicons löst `gsFavicon` ohnehin über den Chrome-Cache auf; nur zur Laufzeit injizierte
`data:`-Favicons gehen verloren. Unbegrenzte Längen würden Session-Backups und `chrome.tabs.update`-URLs aufblähen.
**Entscheidung:** Filter in `gsCustomSuspend.isPassthroughFavicon()`; Parameter **vor** `uri=` im Hash.
**Konsequenzen:** Bis 16 KB längere Suspended-URLs; `uri=`-Position ist eine Invariante, die bei
Upstream-Änderungen an `generateSuspendedUrl`/`getHashVariable` geprüft werden muss.

## ADR-002 · Upstream-Helfer wiederverwenden statt duplizieren

**Kontext:** Regex-/Substring-Matching existiert als `gsUtils.testForMatch()`; Battery-Logik in `tgs`.
**Entscheidung:** `testPattern()` delegiert Regex+Substring an `testForMatch`, ergänzt nur Wildcard.
Der Timer-Hook nimmt das **fertig berechnete** globale Timeout des Upstreams als Eingabe statt es neu zu berechnen.
**Konsequenzen:** Verhalten bleibt konsistent zur Whitelist; Upstream-Fixes an `testForMatch` wirken automatisch.
Ausnahme: `getEffectiveGlobalSuspendTime()` spiegelt die Battery-Logik fürs Popup (dort gibt es keine
Upstream-Berechnung) – bei Upstream-Änderung an der Logik nachziehen.

## ADR-001 · Ein Fork-Modul + markierte Ein-Zeilen-Hooks

**Kontext:** Upstream bekommt tägliche Commits. Der ursprüngliche Katalog verteilte die Logik über `tgs.js`,
`gsTabSuspendManager.js`, `gsUtils.js` etc. – jede Funktion dort ist ein potenzieller Konflikt.
**Entscheidung:** Alle Logik in `src/js/gsCustomSuspend.js`. Upstream-Dateien erhalten nur Aufrufe, jede Zeile
mit `[FORK]`, Imports als letzte Zeile des Import-Blocks.
**Konsequenzen:** `grep [FORK]` = vollständige Konflikt-Checkliste. Zyklische Imports (`gsUtils ↔ gsCustomSuspend`)
sind unproblematisch, da nur zur Laufzeit aufgelöst (Upstream-Muster). Kleine Redundanz: `getEffectiveGlobalSuspendTime`.
