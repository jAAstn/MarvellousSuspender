# Roadmap (Fork)

Priorität: 🔴 bald · 🟡 sinnvoll · 🟢 nice-to-have · ⚪ Idee
Stand 09.11.2026 · Manifest 9.1.0.2 · Branch `eigen-9.1.0-neu`

## Offen aus dem aktuellen Stand

- 🟡 **Manueller Handtest im Unpacked-Profil** nach [TESTING.md](TESTING.md) für die UI-Punkte,
  die der E2E-Lauf nicht abdeckt (Custom-Times, Favicon, ZeroRAM, Kontextmenü).
- 🟡 **`externally_connectable` im Manifest festlegen**: `onMessageExternal` akzeptiert aktuell
  Messages von jeder anderen Extension. Entweder gewünschte Sender-IDs whitelisten oder den
  Listener entfernen, falls keine externe Nutzung geplant ist.
- 🟡 **„Test list“-Button für Custom-Times** analog zu Whitelist/Always-Suspend
  (`testWhitelistBtn`-Pattern in `options.js`): zeigt, welche offenen Tabs von welcher Regel mit
  welchen Minuten getroffen werden. Rein additiv.
- 🟡 **Popup bei Custom-Regel `0`**: aktuell Upstream-Text „Automatic tab suspension disabled“
  ohne `(custom)`-Hinweis. Option: eigener Status-Text oder Suffix auch im NEVER-Zweig.

## Erledigt

- ✅ **`innerHTML`-Datenpfade geschlossen** – `setUrl`, `sessionTitle`, `setTitle`, `setReason`
  und `createEl` schreiben Text; Bewertung und Restfälle in
  [ISSUE-innerhtml.md](ISSUE-innerhtml.md) (28.10.2026).
- ✅ **Unit-Tests** – Vitest-Suite mit 28 Dateien/496 Tests, alle grün (09.11.2026).
- ✅ **CI + Lint-Baseline** – Workflow mit `lint:ci`-Gate; Baseline am 09.11.2026 auf 857
  Einträge neu erzeugt, Gate grün (roher `npm run lint`: 128 Errors/756 Warnungen Altbestand).
- ✅ **Promise-Executoren** – alle 12 `new Promise(async …)`-Stellen eliminiert (19.09.2026).
- ✅ **Performance-Pass** – Settings-Cache, parallele Reads, Listen-/Regex-Caches,
  Hash-Parsing, SnapDOM-Sampling (28.10.2026, Commit `1cd52c41`).
- ✅ **Tab-Strip-Kontextmenü** – wieder aktiv, Chrome-<150-Guard per `try/catch`
  (28.10.2026, `f95d6b11`); die frühere Probe-Memoisierung ist damit gegenstandslos.
- ✅ **Branch-Situation** – `eigen-9.1.0-neu` ist der aktive Branch (neu auf `upstream/master`,
  `e71b4ba9`); `backup/vor-neuaufbau-9.1.0.2` sichert den alten Stand.
- ✅ **CHANGELOG-Konflikt** – Marker aufgelöst, Duplikate entfernt, Perf/Context-Menü ergänzt
  (28.10.2026, `f6434a7f`).
- ✅ **Neuaufbau auf Upstream 9.1.0** – alter Merge verworfen, `eigen-9.1.0-neu` von
  `upstream/master` (`e71b4ba9`) aufgebaut, Fork-Patch 3-Wege angewendet (09.11.2026).
- ✅ **Echter Browser-Ladetest** – Chrome for Testing 157, E2E 39/39 grün (09.11.2026).
- ✅ **Tab-Health-Hook** – beim Neuaufbau entfallen; Upstream #551 deckt den Fall ab.

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

- `upstream/master` trägt v9.1.0 (`e71b4ba9`); der Release-Tag ist `f12709e2`.
  Vor jedem Merge prüfen, welche Linie den gewünschten Stand trägt.
- Upstream-`[Unreleased]`-Block lesen – neue Options-Keys oder ein Umbau von
  `calculateTabStatus()` sind die wahrscheinlichsten Konfliktquellen.
- Sollte Upstream die Executor-Stellen (Katalog §12) selbst anfassen: deren Version gewinnen
  (semantisch identisch erwartet) – Details ADR-010.
- Upstream #551 (Tab Health) ist gemergt und der Fork-Hook ist beim Neuaufbau entfallen.

## Lint & CI-Pflege

- 🟢 **Lint-Backlog abbauen** (857 eingefrorene Verstöße, 128 Errors/756 Warnungen): die
  Warnungen sind großteils `--fix`-bar; nach jeder Fix-Runde die Baseline per
  `npm run lint:baseline` schrumpfen lassen.
- 🟢 **`no-floating-promises` / `no-misused-promises` reaktivieren**: in `eslint.config.mjs` als
  TODO markiert; mit der Baseline-Mechanik gefahrlos einschaltbar.
- 🟢 **`check-locales` zum harten Gate machen**, sobald der Crowdin-Sync die 17 pending Locales
  nachzieht (`continue-on-error` aus dem Workflow entfernen).

## Bewusst NICHT geplant

- Kein eigener Build-Step / Bundler (Upstream lädt `src/` direkt).
- Keine Verteilung über den Chrome Web Store (privater Fork, „Load unpacked“).
- Keine Übersetzung der Fork-Strings über `en`+`de` hinaus.
