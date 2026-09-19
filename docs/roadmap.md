# Roadmap (Fork)

Priorität: 🔴 bald · 🟡 sinnvoll · 🟢 nice-to-have · ⚪ Idee

## Offen aus dem aktuellen Stand

- 🔴 **Manueller Test der Fork-Features im Browser** nach [TESTING.md](TESTING.md) – auf dem Dev-Rechner ist kein Chrome
  verfügbar, die Änderungen wurden nur per Lint + Node-Smoke-Test verifiziert.
- ✅ ~~Commit aufteilen~~ – erledigt (6 Feature-Commits + 2 Tab-Groups-Commits, 19.09.2026).
- 🟡 **Tab-Health-Fix upstream melden** (False-Positive bei `DISCARD_AFTER_SUSPEND`, siehe Katalog §7) – reiner Bugfix, PR-Kandidat.
- 🟡 **Branch `Eigen` löschen** (identisch mit `fable`-Basis, keine eigenen Commits).
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

## Bewusst NICHT geplant

- Kein eigener Build-Step / Bundler (Upstream lädt `src/` direkt).
- Keine Verteilung über den Chrome Web Store (privater Fork, „Load unpacked“).
- Keine Übersetzung der Fork-Strings über `en`+`de` hinaus.
