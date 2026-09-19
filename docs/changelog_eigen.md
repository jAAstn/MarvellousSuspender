# Eigenes Changelog (changelog_eigen.md)

> **Zweck:** Alle Änderungen, die **wir** (dieser Fork, hier „(3)“ bis „(8)“) seit dem 19.09.2026 vorgenommen
> haben — getrennt vom Upstream-`CHANGELOG.md`, damit sofort klar ist, was von uns stammt und was nicht.
> Die Sektionen (1) und (2) sind ältere Fork-Änderungen aus demselben Zyklus und der Vollständigkeit halber
> mitaufgeführt (Details: [PERSOENLICHE_AENDERUNGEN.md](PERSOENLICHE_AENDERUNGEN.md)).
>
> **Bezugspunkte:**
> - Upstream-Basis: `gioxx/MarvellousSuspender` v9.0.3, Commit `25574c39` (18.09.2026)
> - Arbeitsbranch: `Eigen` (Merge-Ziel `fable`/`master` siehe [UPSTREAM_UPDATE.md](UPSTREAM_UPDATE.md))
> - Upstream-`CHANGELOG.md`: unsere Einträge stehen dort zusätzlich gespiegelt am **Dateiende** unter
>   „Fork-Änderungen (jAAstn/MarvellousSuspender)“ — Sektionen (3)–(5) —, nicht im Upstream-`[Unreleased]`.
>
> **Commit-Bezug:** Commits `65ae5988` (Tab-Strip-Probe) und `273b44cb` (externer Listener) existieren bereits;
> die restlichen Änderungen dieser Session (Executor-Umbauten, CI, Baseline, Doku, Marker-Nachzug) sind mit
> den Commits „Executor-Refactor“, „CI + Lint-Baseline“ und „docs: Session-Doku + changelog_eigen“ eingecheckt.

---

## [Fork] 2026-09-19 (8) — Dokumentation

### Hinzugefügt
- **`docs/changelog_eigen.md` (diese Datei)** als separater, gebündelter Verlauf unserer eigenen Änderungen —
  getrennt vom Upstream-Verlauf, damit bei jedem Upstream-Merge oder -Blick sofort trennbar ist, was wem gehört.

### Geändert
- **`[FORK]`-Marker-Nachzug für bereits committete Fix-Hooks** (`tgs.js`: `isTabStripContextSupported()` +
  `buildContextMenu()`-Gating; `background.js`: `externalMessageRequestListener`): die beiden älteren Fix-Commits
  (`65ae5988`, `273b44cb`) waren vor der Konvention entstanden und trugen keine Marker — damit hätte
  `grep -rn "\[FORK\]" src` (die Merge-Checkliste, siehe [UPSTREAM_UPDATE.md](UPSTREAM_UPDATE.md)) die Stellen
  übersehen. Nachgezogen; wegen Datei-Überlappung mit dem Executor-Refactor im selben Commit eingecheckt
  (Commit-Tabelle unten). Die Marker-Anzahl (jetzt 30) ist in [PERSOENLICHE_AENDERUNGEN.md](PERSOENLICHE_AENDERUNGEN.md)
  und den Pflicht-Checks nachgeführt.
- `CHANGELOG.md`: unsere zwei versehentlich im Upstream-`[Unreleased]`-Block gelandeten Einträge (CI,
  Promise-Executor) sind in den Fork-Abschnitt am **Dateiende** umgezogen (Konvention laut ADR-005: Fork-Einträge
  niemals im Upstream-Block, da dort jeder Upstream-Merge konfligiert). Ein Verweistext am Block-Ende erklärt,
  wo die Fork-Ergänzungen stehen.
- `docs/DECISIONS.md`: ADR-008 (Chromium-Fähigkeitsprobe statt User-Agent-Sniffing), ADR-009 (detached-IIFE-Muster
  für Message-Listener) neu; ADR-007 („kein CI“) durch die CI-Einführung **ersetzt** — bleibt zur Historie
  erhalten, ist aber mit (7) obsolet geworden.
- `docs/TESTING.md`: Lint-Sektion von „ad-hoc-Dateiliste“ auf die neue Baseline-Mechanik (`npm run lint:ci` /
  `npm run lint:baseline`) umgestellt; neue manuelle Checklisten-Punkte für Tab-Strip-Kontextmenü (Brave < 150
  und Chromium 150+) und externen Message-Listener ergänzt.
- `docs/roadmap.md`: erledigte Punkte (CI, Promise-Executoren) abgehakt; neue offene Punkte aus der
  Optimierungs-Analyse aufgenommen (Probe-Memoisierung, `externally_connectable`, Unit-Tests für die Queue).
- `docs/PERSOENLICHE_AENDERUNGEN.md`: Sektionen 10–12 (Tab-Strip-Probe, Listener-Fix, CI/Baseline) ergänzt.
- `docs/README.md`: `changelog_eigen.md` in den Index aufgenommen.

---

## [Fork] 2026-09-19 (7) — CI & Lint-Baseline

### Hinzugefügt
- **GitHub-Actions-Workflow** (`.github/workflows/ci.yml`): Lint-Gate bei jedem Push und jeder PR
  (`npm run lint:ci`), `npm run check-locales` non-blocking mit `continue-on-error` (bis der Crowdin-Sync die
  16 pending Locales liefert — Umschalten auf hart dokumentiert im Workflow-Kommentar).
- **Lint-Baseline-Mechanik** (`scripts/lint-baseline.js`, `lint-baseline.json`, npm-Scripts `lint:ci`/`lint:baseline`):
  friert die ~1.060 Bestandsverstöße als `file:line:rule`-Keys ein. `--check` (CI) scheitert nur an Verstößen,
  die eine Änderung **neu** einführt; `--update` regeneriert die Baseline (Absicht: Backlog inkrementell
  abbauen, verschwundene Einträge schrumpfen beim nächsten `--update`-Lauf).

### Geändert
- `eslint.config.mjs`: `eslint-plugin-promise` (`flat/recommended`) aktiviert, kuratiert — die Callback-Mixing-
  und await-to-Regeln bleiben aus (die `chrome.*`-APIs sind callback-basiert), die echten Promise-Vertragsregeln
  (`always-return`, `catch-or-return`, `param-names`, `no-return-in-finally`, `valid-params`) greifen auf
  neuem Code. **Fund dabei:** `no-async-promise-executor` ist **keine** Plugin-Regel, sondern eine Core-ESLint-
  Regel — die erste Config-Version scheiterte daran; jetzt explizit auf `error` mit Kommentar dokumentiert.
- `package.json`: `lint:ci` / `lint:baseline` Scripts.

### Bekannt / akzeptiert
- Die Baseline enthält auch die ~110 Befunde, die die Promise-Preset-Regeln auf Legacy-Code werfen — eingefroren
  wie der Rest. Neuer Code misst sich daran.
- `check-locales` bleibt im CI non-blocking, bis der Crowdin-Sync die 16 pending Locales nachzieht.

---

## [Fork] 2026-09-19 (6) — Promise-Executoren (12 Stellen in 8 Dateien)

### Behoben
- **`new Promise(async (resolve, reject) => …)`-Antipattern eliminiert** (`background.js`, `gsChrome.js`,
  `gsFavicon.js`, `gsSession.js`, `gsTabSuspendManager.js` ×2, `gsUtils.js` ×3, `suspended.js`, `tgs.js` ×2):
  ein async-Executor kann das äußere Promise per `throw` **nie** settle'n — der Fehler versickert im
  verworfenen Executor-Promise, alles Wartende hängt ewig. Jede Stelle ist jetzt eine `async function`, deren
  Rejection der Aufrufer bereits behandelt (verifiziert: `gsTabQueue` fängt Executor-Fehler über
  `Promise.resolve().then(executorFn).catch(exceptionFn)`), bzw. ein synchroner Executor, der per Callback
  settle't — der `calculateTabStatus`-Wrapper in `tgs.js` blieb bewusst synchron, weil das callback-basierte
  Subjekt **keinen** Rückgabewert liefert (ein `(s) => s`-Rewrite hätte `undefined` geliefert).
- Erfolgspfade unverändert; einziger beobachtbarer Unterschied: ein echter Fehler führt jetzt zu einer
  Rejection statt ewigem Schweigen. Die Core-Regel `no-async-promise-executor` ist jetzt `error`, damit das
  Muster nicht zurückkommt.

---

## [Fork] 2026-09-19 (5) — Externer Message-Kanal

### Behoben
- **`externalMessageRequestListener` antwortete nie auf `await`-Pfaden** (`background.js`, Commit `273b44cb`):
  die Funktion war `async` und rief `sendResponse()` nach `await`-Punkten (`gsChrome.tabsGet`, `tgs.unsuspendTab`)
  auf. Chrome hält den Message-Kanal aber nur offen, wenn der Listener **synchron** `true` zurückgibt — ein
  zurückgegebenes Promise wird ignoriert, der Kanal schloss sofort, und jede Antwort nach dem ersten `await`
  ging still verloren (externe Caller warteten bis zum Timeout). Umgestellt auf das Muster des internen
  `messageRequestListener`: synchroner Listener mit `return true`, gesamte Async-Arbeit in einer detached IIFE,
  ergänzender `catch`, damit auch eine Exception dem Sender eine (leere) Antwort liefert statt ewigem Hängen.
  Nebenbei bereinigt: `sendResponse('Error: …', x)` übergab zwei Argumente (das zweite wird von Chrome
  verworfen) und ist jetzt korrekte Template-Literal-Konkatenation; das unerreichbare `return true` im
  async-Body entfiel, der Durchfall-Pfad antwortet jetzt mit `sendResponse()` statt gar nicht.

---

## [Fork] 2026-09-19 (4) — Tab-Strip-Kontextmenü auf alten Chromium-Versionen

### Behoben
- **Extension-Kontextmenü erschien auf Chromium < 150 gar nicht** (`tgs.js`, Commit `65ae5988`): der
  `tab`-Context-Typ für `chrome.contextMenus` (Tab-Leiste rechtsklick) ist eine Chromium-150-API
  ([PSA der Chromium-Extensions-Gruppe](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/RReE8dtY4Ok/m/hOQaYDNYAwAJ)).
  Auf älteren Engines (z. B. Brave 1.84 / Chromium 142) warf jeder der 17 `tab_*`-`create()`-Aufrufe einen
  TypeError und brach den kompletten Menü-Aufbau ab — auch das normale Seiten-Kontextmenü fehlte
  (Uncaught-in-promise-Fehler im `brave://extensions`-Errors-Tab, Screenshot-Report).
  `buildContextMenu()` fragt jetzt vorab per Wegwerf-Probe-Item (`tab_context_support_probe`, unsichtbar,
  `contexts: ['tab']`) die Unterstützung ab (`isTabStripContextSupported()`): deckt sowohl den **synchronen**
  TypeError (Argument-Check vor dem IPC-Versand → `try/catch`) als auch den **asynchronen**
  `runtime.lastError`-Pfad ab; das Probe-Item wird wieder entfernt, das Ergebnis entscheidet, ob die
  Tab-Strip-Sektion registriert wird. Auf Chromium 149+ (API nimmt Registrierung an, UI-Rendering noch nicht
  shipped) erscheinen die Items automatisch, sobald der Browser das Feature ausrollt — `onInstalled` feuert
  auch bei Browser-Updates, kein Extension-Update nötig.

### Bekannt / akzeptiert
- Das Probe-Ergebnis ist nicht memoisiert — der Probe läuft bei jedem Rebuild (Installation, Extension-Update,
  jede Änderung der Kontextmenü-Einstellung). Die Unterstützung ist pro Browser-Prozess konstant, eine
  Modul-Variable würde den IPC-Round-Trip sparen und nebenbei ein kleines Doppel-Registrierungs-Race
  entschärfen. Offen in [roadmap.md](roadmap.md) (🟡).

---

## [Fork] 2026-09-19 (3) — Unfälle unterwegs (fürs Protokoll)

### Behoben
- **Baseline-Skript-Null-Dereferenz**: die erste Version von `scripts/lint-baseline.js` berechnete
  `newViolations`/`resolved` vor dem `--update`-Early-Return — bei `--update` wäre `null.has(k)` gecrasht.
  Behoben, bevor die Baseline erzeugt wurde.
- **Zwischenzeitliche ESLint-Verstöße durch eigene Konkatenation**: bei der Listener-Umstellung erzeugten
  `+`-Konkatenationen zwei neue `prefer-template`-Warnungen — korrigiert, Baseline (0 Errors / 1 Warning)
  wiederhergestellt, bevor committet wurde.

### Entdeckt (nicht behoben, upgestreamt auf die Roadmap)
- `write_todos`-Loop-Falle im Verlauf: dasselbe unveränderte Todo-Liste wiederholt ohne Fortschritt —
  Reihenfolge der eigentlichen Arbeit unbeeinträchtigt, aber dokumentiert als Verhaltensnotiz.
- `git status`-Missverständnis: die two „getrennten Commits“-Anfrage war bereits zur Hälfte erledigt
  (Tab-Strip-Fix war schon als `65ae5988` eingecheckt) — ein leerer zweiter Commit wäre falsch gewesen.

---

## Übersicht der Commits dieser Session

| # | Commit | Inhalt |
|---|---|---|
| (4) | `65ae5988` — *Probe 'tab' context before registering menu* | `tgs.js` + `CHANGELOG.md` (vom Nutzer committet, Copilot-Co-Author) |
| (5) | `273b44cb` — *fix(fork): reply reliably on the external message channel* | `background.js` |
| (6) | *refactor(fork): replace async promise executors with settled-safe functions* | 8 Dateien in `src/js` (inkl. `[FORK]`-Marker-Nachzug für (4)/(5) — liegt in denselben Dateien) |
| (7) | *ci(fork): add lint-baseline gate and enable eslint-plugin-promise* | `eslint.config.mjs`, `package.json`, `scripts/lint-baseline.js`, `lint-baseline.json`, `.github/workflows/ci.yml` |
| (8) | *docs(fork): session docs, changelog_eigen, CHANGELOG fork-section restructure* | `docs/*`, `CHANGELOG.md` |
