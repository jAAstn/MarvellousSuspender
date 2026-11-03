# Roadmap (Fork)

Priorität: 🔴 bald · 🟡 sinnvoll · 🟢 nice-to-have · ⚪ Idee
Stand 28.10.2026 · Manifest 9.1.0.1 · Branch `testing-bevor-merging-zu-eigen-+-mast`

## Offen aus dem aktuellen Stand

- 🔴 **Manueller Handtest im Unpacked-Profil** nach [TESTING.md](TESTING.md). Auf dem Dev-Rechner
  läuft kein automatisierter Browser; die Unit-Suite deckt Logik, aber nicht Rendering und
  `chrome.contextMenus` im echten Browser. Besonders relevant: wiederhergestelltes Tab-Strip-Menü
  und die neue `textContent`-URL-Anzeige.
- 🟡 **Eine rote Test-Erwartung klären**: `SUSPEND_TIME: 0` als Zahl soll laut
  `gsTabSuspendManager.eligibility.test.js` **nicht** „Never“ sein. Entweder Test oder
  Produktionslogik an die dokumentierte Upstream-Semantik anpassen – nicht stillschweigend
  die Assertion löschen.
- 🟡 **`npm run lint:ci` wieder grün bekommen**: Die 1.061er-Baseline passt nicht mehr zu einigen
  neueren Testzeilen (`gsTabQueue`, `suspend-manager-harness`, `tgs.tabGroupKeyCache`). Entweder
  die Verstöße beheben oder die Baseline bewusst mit `npm run lint:baseline` neu schreiben und
  die Änderung im PR begründen.
- 🟡 **`externally_connectable` im Manifest festlegen**: `onMessageExternal` akzeptiert aktuell
  Messages von jeder anderen Extension. Entweder gewünschte Sender-IDs whitelisten oder den
  Listener entfernen, falls keine externe Nutzung geplant ist.
- 🟡 **Tab-Health-Fork-Flag aufräumen**: Upstream #551 ist gemergt und gated
  `isBrokenGroupedDiscardedTab()` bereits auf Chrome < 150. Der Fork-Flag
  `_ignoreDiscardedGrouped` ist damit für diesen Fall redundant; nur die
  `DISCARD_AFTER_SUSPEND`-Bedingung fügt noch etwas hinzu. Prüfen, ob der Hook ganz entfallen kann.
- 🟡 **„Test list“-Button für Custom-Times** analog zu Whitelist/Always-Suspend
  (`testWhitelistBtn`-Pattern in `options.js`): zeigt, welche offenen Tabs von welcher Regel mit
  welchen Minuten getroffen werden. Rein additiv.
- 🟡 **Popup bei Custom-Regel `0`**: aktuell Upstream-Text „Automatic tab suspension disabled“
  ohne `(custom)`-Hinweis. Option: eigener Status-Text oder Suffix auch im NEVER-Zweig.

## Erledigt

- ✅ **`innerHTML`-Datenpfade geschlossen** – `setUrl`, `sessionTitle`, `setTitle`, `setReason`
  und `createEl` schreiben Text; Bewertung und Restfälle in
  [ISSUE-innerhtml.md](ISSUE-innerhtml.md) (28.10.2026).
- ✅ **Unit-Tests** – Vitest-Suite mit 31 Dateien/514 Tests (28.10.2026, ADR-013).
- ✅ **CI + Lint-Baseline** – Workflow mit `lint:ci`-Gate, Baseline (19.09.2026); derzeit wegen
  Baseline-Drift rot, siehe oben.
- ✅ **Promise-Executoren** – alle 12 `new Promise(async …)`-Stellen eliminiert (19.09.2026).
- ✅ **Performance-Pass** – Settings-Cache, parallele Reads, Listen-/Regex-Caches,
  Hash-Parsing, SnapDOM-Sampling (28.10.2026, Commit `1cd52c41`).
- ✅ **Tab-Strip-Kontextmenü** – wieder aktiv, Chrome-<150-Guard per `try/catch`
  (28.10.2026, `f95d6b11`); die frühere Probe-Memoisierung ist damit gegenstandslos.
- ✅ **Branch-Situation** – `testing-bevor-merging-zu-eigen-+-mast` ist der aktive Branch,
  `eigen-+-mast` nur noch Referenz. `fable` existiert nicht mehr.
- ✅ **CHANGELOG-Konflikt** – Marker aufgelöst, Duplikate entfernt, Perf/Context-Menü ergänzt
  (28.10.2026, `f6434a7f`).

## Ideen für weitere Fork-Features

- 🟡 **Custom-Times-Regel per Kontextmenü anlegen** („Diesen Tab nach X min suspendieren“ →
  fügt `<host> : X` an).
- 🟡 **Regel-Validierung in den Optionen**: ungültige Zeilen (kein `:`, negative Zahl, kaputte
  Regex) inline markieren statt stillschweigend zu ignorieren.
- 🟢 **Export/Import der Fork-Settings** getrennt vom Upstream-Backup (nur
  `gsCustomSuspendTimes`), um bei einem Upstream-Storage-Umbau nichts zu verlieren.
- 🟢 **Favicon-Passthrough auch für `blob:`/`chrome://favicon`-Fälle** prüfen – aktuell nur `data:`.
- ⚪ **Regel-Typ „Zeitfenster“** (z. B. `youtube.com : 120 @ 18-23`) – nur wenn wirklich gebraucht.
- ⚪ **Migration weiterer Suspender-Formate** (UnaSuspender, Tab Suspender) nach dem
  ZeroRAM-Muster in `convertForeignSuspendedUrl()`.

## Upstream beobachten

- `upstream/release/9.1.0` ist die aktuellere Linie; `upstream/master` hinkt auf 9.0.3 hinterher.
  Vor jedem Merge prüfen, welche Linie den gewünschten Stand trägt.
- Upstream-`[Unreleased]`-Block lesen – neue Options-Keys oder ein Umbau von
  `calculateTabStatus()` sind die wahrscheinlichsten Konfliktquellen.
- Sollte Upstream die Executor-Stellen (Katalog §12) selbst anfassen: deren Version gewinnen
  (semantisch identisch erwartet) – Details ADR-010.
- Upstream #551 (Tab Health) ist gemergt; den Fork-Hook bei der nächsten Runde gegen die neue
  Implementierung prüfen.

## Lint & CI-Pflege

- 🟢 **Lint-Backlog abbauen** (1.061 eingefrorene Verstöße): die 760 Warnungen sind großteils
  `--fix`-bar; nach jeder Fix-Runde die Baseline per `npm run lint:baseline` schrumpfen lassen.
- 🟢 **`no-floating-promises` / `no-misused-promises` reaktivieren**: in `eslint.config.mjs` als
  TODO markiert; mit der Baseline-Mechanik gefahrlos einschaltbar.
- 🟢 **`check-locales` zum harten Gate machen**, sobald der Crowdin-Sync die 17 pending Locales
  nachzieht (`continue-on-error` aus dem Workflow entfernen).

## Bewusst NICHT geplant

- Kein eigener Build-Step / Bundler (Upstream lädt `src/` direkt).
- Keine Verteilung über den Chrome Web Store (privater Fork, „Load unpacked“).
- Keine Übersetzung der Fork-Strings über `en`+`de` hinaus.
