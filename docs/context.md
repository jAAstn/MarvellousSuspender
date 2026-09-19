# Projekt-Kontext

## Was ist das hier?

Ein **persönlicher Fork** von [gioxx/MarvellousSuspender](https://github.com/gioxx/MarvellousSuspender)
(„The Marvellous Suspender“, TMS) – einer MV3-Chrome-Extension, die inaktive Tabs durch eine leichte
Platzhalter-Seite ersetzt, um RAM/CPU zu sparen. TMS ist selbst der gepflegte Nachfolger von
„The Great Suspender“.

Der Fork ergänzt Funktionen, die upstream (noch) nicht existieren – siehe
[PERSOENLICHE_AENDERUNGEN.md](PERSOENLICHE_AENDERUNGEN.md). Ziel ist **nicht**, sich vom Upstream zu
entfernen, sondern dessen tägliche Updates weiter mitzunehmen.

## Repos & Branches

| | |
|---|---|
| Upstream | `https://github.com/gioxx/MarvellousSuspender.git` (Remote `upstream`) |
| Fork | `https://github.com/jAAstn/MarvellousSuspender.git` (Remote `origin`) |
| `master` | 1:1 Spiegel von `upstream/master` |
| `fable` | Arbeitsbranch mit Fork-Änderungen (basiert auf `master`) |
| `Eigen` | Altstand, obsolet nach Merge |

Upstream-Basis der aktuellen Fork-Änderungen: Commit `25574c39` (18.09.2026, „Merge #490 never-suspend-tab-group“),
Manifest-Version **9.0.3**, Upstream-`CHANGELOG.md` hat bereits einen `[Unreleased]`-Block (→ nächste Version 9.0.4 / 9.1.0).

## Upstream-Konventionen, die wir übernehmen

- **Code-Stil:** 2 Spaces, Single Quotes, Stroustrup-Braces, aligned Imports (`import  { x }               from`),
  IIFE-Module (`export const gsFoo = (() => { … return { … }; })();`), ausführliche Kommentare mit Issue-Nummern.
- **Optionen:** Key in `gsStorage` (SCREAMING_CASE → camelCase-String mit `gs`-Präfix), Default in
  `getSettingsDefaults()`, DOM-Element-ID ↔ Key in `options.js elementPrefMap`, i18n-Key `html_options_*`.
- **i18n:** `data-i18n="__MSG_key__"` in HTML, `gsUtils.getMessage(key, [subs])` in JS, Platzhalter `$name$`.
  Upstream pflegt nur `en`+`it` direkt, Rest via Crowdin. Wir pflegen `en`+`de`.
- **CHANGELOG.md:** Keep-a-Changelog, sehr ausführliche Engineering-Einträge mit Dateiliste. `src/CHANGELOG_USER.md`
  ist die kurze Nutzer-Version fürs „What's new“-Modal.
- **Logging:** `gsUtils.log/warning/error(tabIdOrModule, …)`; Debug-Flags `debugInfo/debugError` werden
  beim Build auf `false` gesetzt.

## Fork-Konventionen (zusätzlich)

- Jede Zeile in einer Upstream-Datei, die vom Fork stammt, trägt `[FORK]`.
- Neue Logik → `src/js/gsCustomSuspend.js`, nicht in Upstream-Dateien.
- Fork-Imports als **letzte** Zeile des Import-Blocks.
- Fork-Doku ausschließlich in `docs/` (existiert upstream nicht) + Fork-Abschnitte **am Ende** von
  `CHANGELOG.md` und `README.md`.
- Dokumentationssprache: Deutsch. Code-Kommentare im Modul Deutsch, Hook-Kommentare in Upstream-Dateien
  Englisch (fügen sich in den Upstream-Stil ein).

## Umgebung

- Windows 11, Git Bash. Node + npm vorhanden (`node_modules` installiert).
- Kein Chrome auf dem Entwicklungsrechner für automatisierte Browser-Tests → manuelle Tests nach
  [TESTING.md](TESTING.md).

## Dokumente in `docs/`

| Datei | Inhalt |
|---|---|
| [README.md](README.md) | Index |
| [context.md](context.md) | dieses Dokument |
| [architecture.md](architecture.md) | Aufbau der Extension, Tab-Lebenszyklus, Speicher-Layer |
| [PERSOENLICHE_AENDERUNGEN.md](PERSOENLICHE_AENDERUNGEN.md) | Katalog aller Fork-Änderungen mit exakten Stellen |
| [UPSTREAM_UPDATE.md](UPSTREAM_UPDATE.md) | Merge-Anleitung + Checkliste |
| [TESTING.md](TESTING.md) | Manuelle Testfälle + Node-Smoke-Test |
| [DECISIONS.md](DECISIONS.md) | Architektur-Entscheidungen (ADR-Stil) |
| [performance-audit.md](performance-audit.md) | Optimierungspotenzial (Upstream + Fork) |
| [roadmap.md](roadmap.md) | Ideen / offene Punkte |
