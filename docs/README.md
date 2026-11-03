# docs/ – Fork-Dokumentation

Dieses Verzeichnis existiert **nur im Fork** (nicht im Upstream) und ist damit konfliktfrei.

| Datei | Wann lesen |
|---|---|
| [context.md](context.md) | Einstieg: Was ist der Fork, Branches, Konventionen |
| [architecture.md](architecture.md) | Wie die Extension aufgebaut ist (Kontexte, Module, Tab-Lebenszyklus, Speicher) |
| [PERSOENLICHE_AENDERUNGEN.md](PERSOENLICHE_AENDERUNGEN.md) | **Katalog aller Fork-Änderungen** mit exakten Hook-Stellen |
| [changelog_eigen.md](changelog_eigen.md) | **Unser eigener Changelog-Verlauf** (nummerierte Sektionen, Commit-Bezug) – getrennt vom Upstream |
| [UPSTREAM_UPDATE.md](UPSTREAM_UPDATE.md) | **Vor jedem Upstream-Merge**: Ablauf + Checkliste |
| [TESTING.md](TESTING.md) | Nach jedem Merge/Feature: Lint, Node-Smoke-Test, manuelle Checkliste |
| [DECISIONS.md](DECISIONS.md) | Warum Dinge so gebaut sind (ADRs) |
| [performance-audit.md](performance-audit.md) | Optimierungspotenzial in Upstream und Fork |
| [ISSUE-innerhtml.md](ISSUE-innerhtml.md) | Offene `innerHTML`-Datenpfade (Risiko, Priorität, Fix-Reihenfolge) |
| [roadmap.md](roadmap.md) | Offene Punkte und Ideen |

## Schnellstart nach einem Upstream-Update

```sh
git fetch upstream && git checkout master && git merge --ff-only upstream/master
git checkout testing-bevor-merging-zu-eigen-+-mast && git merge master
grep -rn "\[FORK\]" src --include=*.js --include=*.html --include=*.css | grep -v gsCustomSuspend.js | wc -l   # Soll: 40 (Stand 10/2026)
npm test
npx eslint --quiet src/js/gsCustomSuspend.js
```
