# Roadmap (Fork)

Priorität: 🔴 bald · 🟡 sinnvoll · 🟢 nice-to-have · ⚪ Idee

## Offen aus dem aktuellen Stand

- 🔴 **Manueller Test der Fork-Features im Browser** nach [TESTING.md](TESTING.md) – auf dem Dev-Rechner ist kein Chrome
  verfügbar, die Änderungen wurden nur per Lint + Node-Smoke-Test verifiziert. Neu dazugekommen: Checklisten-Punkte
  für Tab-Strip-Kontextmenü (Katalog §10) und externen Message-Kanal (§11).
- ✅ ~~Commit aufteilen~~ – erledigt (6 Feature-Commits + 2 Tab-Groups-Commits, 19.09.2026).
- ✅ **CI + Lint-Baseline** – erledigt (19.09.2026): GitHub-Workflow mit `lint:ci`-Gate, Baseline friert die
  ~1.060 Altverstöße ein (Katalog §12, ADR-007-Update).
- ✅ **Promise-Executoren umbauen** – erledigt (19.09.2026): alle 12 `new Promise(async …)`-Stellen eliminiert,
  `no-async-promise-executor` als Core-Regel aktiv (Katalog §12).
- 🟡 **Probe-Ergebnis memoisieren** (`tgs.isTabStripContextSupported()`, Katalog §10): Modul-Variable statt
  IPC-Round-Trip bei jedem Menü-Rebuild; entschärft nebenbei ein Doppel-Registrierungs-Race bei nahezu
  gleichzeitigem Aufruf (`onInstalled` + Storage-Change-Listener).
- 🟡 **`externally_connectable` im Manifest festlegen** (Katalog §11): `onMessageExternal` akzeptiert aktuell
  Messages von *jeder* anderen Extension. Entweder gewünschte Sender-IDs whitelisten oder – falls keine externe
  Nutzung geplant ist – den Listener ganz entfernen.
- 🟡 **Unit-Tests für reine Logik** (ADR-007-Update): `gsTabQueue` (Concurrency/Timeout), Settings-Lock,
  `getRootUrl`/`parseTabGroupKey`/`cleanupWhitelist`, Backup-Dateinamen-Regexes – alles ohne Chrome-APIs
  testbar; würde die dokumentierten Race-Annahmen absichern.
- 🟡 **Tab-Health-Fix upstream melden** (False-Positive bei `DISCARD_AFTER_SUSPEND`, siehe Katalog §7) – reiner Bugfix, PR-Kandidat.
- 🟡 **Branch-Situation klären**: `Eigen` trägt inzwischen eigene Commits (Tab-Strip-Fix `65ae5988`, Listener-Fix
  `273b44cb` + Session-Commits) – entweder in `fable` mergen und `Eigen` löschen, oder `Eigen` als Arbeitsbranch
  deklarieren (dann [context.md](context.md) anpassen).
- 🟡 **„Test list“-Button für Custom-Times** analog zu Whitelist/Always-Suspend (`testWhitelistBtn`-Pattern in
  `options.js`): zeigt, welche offenen Tabs von welcher Regel mit welchen Minuten getroffen werden.
  Rein additiv (eigener Button + Modal), gut als `[FORK]` isolierbar.
- 🟡 **Popup bei Custom-Regel `0`**: aktuell Upstream-Text „Automatic tab suspension disabled“ ohne `(custom)`-Hinweis.
  Option: eigener Status-Text oder `(custom)`-Suffix auch im NEVER-Zweig.

## Ideen für weitere Fork-Features

- 🟡 **Custom-Times-Regel per Kontextmenü anlegen** („Diesen Tab nach X min suspendieren“ → fügt `<host> : X` an).
- 🟡 **Regel-Validierung in den Optionen**: ungültige Zeilen (kein `:`, negative Zahl, kaputte Regex) inline markieren
  statt stillschweigend zu ignorieren.
- 🟢 **Export/Import der Fork-Settings** getrennt vom Upstream-Backup (nur `gsCustomSuspendTimes`), um bei einem
  Upstream-Storage-Umbau nichts zu verlieren.
- 🟢 **Favicon-Passthrough auch für `blob:`/`chrome://favicon`-Fälle** prüfen – aktuell nur `data:`.
- ⚪ **Regel-Typ „Zeitfenster“** (z. B. `youtube.com : 120 @ 18-23`) – nur wenn wirklich gebraucht (YAGNI).
- ⚪ **Migration weiterer Suspender-Formate** (UnaSuspender, Tab Suspender) nach dem ZeroRAM-Muster in
  `convertForeignSuspendedUrl()`.

## Upstream beobachten

- Upstream-Issue-Tracker auf „per-site timeout“, „custom suspend time“ o. ä. prüfen. Sollte Upstream das Feature
  einbauen → Fork-Feature 1 zurückbauen (siehe [UPSTREAM_UPDATE.md](UPSTREAM_UPDATE.md), letzter Abschnitt).
- Upstream-`[Unreleased]`-Block regelmäßig lesen – neue Options-Keys oder ein Umbau von `calculateTabStatus()`
  sind die wahrscheinlichsten Konfliktquellen.
- Sollte Upstream die Executor-Stellen (Katalog §12) selbst anfassen, während wir sie geändert haben: deren
  Version gewinnen (Upstream-Implementierung prüfen, semantisch identisch erwartet) – Details ADR-010.

## Lint & CI-Pflege

- 🟢 **Lint-Backlog abbauen** (1.060 eingefrorene Verstöße, Katalog §12): die 746 Warnungen sind großteils
  `--fix`-bar; nach jeder Fix-Runde die Baseline per `npm run lint:baseline` schrumpfen lassen.
- 🟢 **`no-floating-promises` / `no-misused-promises` reaktivieren**: in `eslint.config.mjs` als TODO markiert;
  mit der Baseline-Mechanik jetzt gefahrlos einschaltbar (neue Befunde landen in der Baseline statt CI zu
  sprengen) – würde fire-and-forget-Aufrufe sichtbar machen.
- 🟢 **`check-locales` zum harten Gate machen**, sobald der Crowdin-Sync die 16 pending Locales nachzieht
  (`continue-on-error` aus dem Workflow entfernen).

## Bewusst NICHT geplant

- Kein eigener Build-Step / Bundler (Upstream lädt `src/` direkt).
- Keine Verteilung über den Chrome Web Store (privater Fork, „Load unpacked“).
- Keine Übersetzung der Fork-Strings über `en`+`de` hinaus.
