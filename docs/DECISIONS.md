# Entscheidungen (ADR-Stil)

Kurzformat: Kontext → Entscheidung → Konsequenzen. Neue Einträge oben anfügen, alte nie löschen
(bei Änderung als „ersetzt durch ADR-n“ markieren).

---

## ADR-007 · Kein Test-Runner, sondern Node-Smoke-Test + manuelle Checkliste *(CI-Teil ersetzt, siehe Update unten)*

**Kontext:** Upstream hat keine Tests. Ein Jest/Vitest-Setup würde `package.json`, Config-Dateien und evtl.
ESLint-Config berühren → Merge-Konflikte bei jedem Upstream-Update.
**Entscheidung:** Smoke-Test als Vorlage in `docs/TESTING.md` (Stubs, `eval` des Moduls), manuelle
Browser-Checkliste. Keine Test-Dateien im Repo.
**Konsequenzen:** Kein CI-Schutz; Disziplin nötig, die Checkliste nach Merges abzuarbeiten.
**Update (19.09.2026):** Der „kein CI“-Teil ist obsolet — der Lint-Gate-Workflow
(`.github/workflows/ci.yml`, Baseline-Mechanik, Katalog §12) sichert jetzt „keine neuen
Lint-Verstöße“ auf jedem Push. Der „kein Test-Runner“-Teil bleibt: Unit-Tests für reine Logik
(Queue, Lock, URL-Helfer) bleiben Roadmap-Thema und sollen ohne Konfliktfläche mit
Upstream-Config bleiben.

## ADR-008 · Chromium-Fähigkeitsprobe statt User-Agent-Sniffing

**Kontext:** Der `tab`-Context-Typ für `chrome.contextMenus` existiert erst ab Chromium 150; auf
älteren Engines warf jeder `create()` einen TypeError und brach den kompletten Menü-Aufbau ab
(Extension-Kontextmenü komplett weg auf Brave 1.84 / Chromium 142). Eine Versionsprüfung
(`getChromeVersion() >= 150`) wäre möglich, aber tückisch bei Beta/Dev-Builds, bei Browsern, die
Features zurückportieren oder von Upstream-Chromium abweichen — und sie braucht Pflege bei jedem
neuen Feature.
**Entscheidung:** Fähigkeit per **Probe** erkennen statt Version parsen: `isTabStripContextSupported()`
registriert ein unsichtbares Wegwerf-Item mit dem neuen Context-Typ und wertet den Callback aus
(synchroner TypeError via `try/catch`, asynchroner `runtime.lastError`-Pfad via Callback-Check).
Gibt es die API nicht, wird die Sektion übersprungen; gibt es sie, registriert sie — unabhängig
davon, wann das UI-Rendering im jeweiligen Browser shipped.
**Konsequenzen:** Kein Versions-Management, funktioniert auf jeder Engine, self-healing bei
Browser-Updates (`onInstalled` feuert erneut). Kosten: ein IPC-Round-Trip pro Menü-Rebuild (offen
zur Memoisierung, siehe Roadmap 🟡) und ein unsichtbares Probe-Item für einen Tick. Das Muster ist
auf andere „gibt es das Feature schon?“-Fragen übertragbar.

## ADR-009 · Message-Listener: synchron `return true` + detached IIFE

**Kontext:** `chrome.runtime.onMessage`-Listener, die `sendResponse()` nach `await` aufrufen, brauchen
einen offenen Kanal — Chrome hält ihn nur, wenn der Listener synchron `true` zurückgibt. Ein
`async function`-Listener gibt stattdessen ein Promise zurück, das Chrome ignoriert: der Kanal schließt
sofort, alle Antworten nach dem ersten `await` verfallen still. Das interne `messageRequestListener`
im selben File löst das bereits korrekt.
**Entscheidung:** Für alle Listener mit Post-`await`-Antwort gilt das Muster des internen Listeners:
synchroner `function`-Listener mit `return true` am Ende, gesamte Async-Arbeit in einer detached
`(async () => { … })()`-IIFE, `try/catch` im IIFE-Body, damit eine Exception dem Sender eine (leere)
Antwort liefert statt ewigem Hängen. Angewendet auf `externalMessageRequestListener` (Commit `273b44cb`).
**Konsequenzen:** Das Muster ist im Code (Kommentar dokumentiert das Warum) und als Konvention in
diesem ADR; neue Listener mit asynchroner Antwort kopieren es. `promise/prefer-await-to-callbacks`
bleibt aus — es würde dieses legitime Chrome-API-Muster anflaggen.

## ADR-010 · Mechanische Refactors in Upstream-Dateien ohne `[FORK]`-Marker

**Kontext:** Die 12 Promise-Executor-Umbauten berühren 8 Upstream-Dateien. Als `[FORK]`-markierte
Ein-Zeilen-Hooks wären sie sinnlos (kein Fork-Logik-Anteil) und würden als 12 Ghost-Conflicts die
`grep [FORK]`-Merge-Checkliste aufblähen; semantisch sind es identische Umbauten, die Upstream
selbst jederzeit so vornehmen würde.
**Entscheidung:** Mechanische Refactors ohne Verhaltensänderung (async-Executor → async-Funktion bzw.
synchroner Executor) werden **nicht** mit `[FORK]` markiert; nur echter Fork-Code bekommt Marker.
Der Refactor ist im Katalog (§12) und in `docs/changelog_eigen.md` dokumentiert, nicht in der
Marker-Liste.
**Konsequenzen:** Bei einem Upstream-Merge kann Upstream diese Stellen eigenständig ändern, ohne dass
ein Konflikt unsere Handlung erzwingt — trifft Upstream selbst auf das Antipattern, verschwinden die
Stellen einfach aus unserer Doku. Grenzfall: „mechanisch“ heißt *identische Semantik* auf dem
Erfolgspfad; wäre die Semantik anders (z. B. gewollte neue Fehlerpfade), wäre es Fork-Logik → Marker.

## ADR-011 · Eigenes Changelog (`docs/changelog_eigen.md`) getrennt vom Upstream-Verlauf

**Kontext:** Der Fork-Verlauf verteilte sich auf den Fork-Abschnitt am `CHANGELOG.md`-Ende, die Docs und
Commit-Nachrichten — bei der Frage „was davon ist unser?“ musste man erst zusammensuchen. Zudem landeten
durch Versehen zwei Fork-Einträge im Upstream-`[Unreleased]`-Block (ADR-005-Verstoß).
**Entscheidung:** Gebündelter eigener Verlauf in `docs/changelog_eigen.md` (Sektionen nummeriert, mit
Commit-Bezug); `CHANGELOG.md` hält den Fork-Abschnitt am Dateiende als Spiegel, Upstream-Block bleibt
upstream-frei (Pointer-Vermerk am Block-Ende, falls doch mal jemand sucht).
**Konsequenzen:** Trennung upstream/eigen ist auf einen Blick sichtbar; der Spiegel im `CHANGELOG.md`
muss bei neuen Einträgen mitgepflegt werden (doppelt dokumentiert, bewusst — dort ist der Ort, den ein
Upstream-Merge ohnehin nicht anrührt).

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
