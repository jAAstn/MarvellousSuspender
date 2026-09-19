# Upstream-Update: Anleitung

Der Upstream ([gioxx/MarvellousSuspender](https://github.com/gioxx/MarvellousSuspender)) bekommt
praktisch täglich Commits. Dieses Dokument beschreibt, wie ein Update eingespielt wird, **ohne** die
persönlichen Änderungen zu verlieren.

## Setup (einmalig – bereits erledigt)

```sh
git remote -v
# origin    https://github.com/jAAstn/MarvellousSuspender.git
# upstream  https://github.com/gioxx/MarvellousSuspender.git
```

Branches:
- `master` – Spiegel von `upstream/master` (keine eigenen Commits, nur fast-forward)
- `fable` – **Arbeitsbranch** = `master` + Fork-Commits
- `Eigen` – älterer Stand, kann nach erfolgreichem Merge gelöscht werden

## Grundprinzip

1. Alle Fork-Logik ist in `src/js/gsCustomSuspend.js` gebündelt.
2. Upstream-Dateien enthalten nur Ein-Zeilen-Hooks mit `[FORK]`-Marker.
3. Import-Zeilen stehen **am Ende** des Import-Blocks (ein vorhersehbarer Konflikt-Hunk).
4. CHANGELOG.md / README.md haben einen eigenen Fork-Abschnitt **am Dateiende**.
5. `docs/` existiert im Upstream nicht → nie Konflikte. Achtung: Upstream ignoriert `/docs` in der `.gitignore`;
   der Fork hebt das mit `!/docs` am Dateiende wieder auf.

## Ablauf (Merge-Variante, empfohlen)

```sh
# 1. Sauberer Arbeitsstand
git status                    # muss leer sein, sonst committen/stashen

# 2. Upstream holen und master fast-forwarden
git fetch upstream
git checkout master
git merge --ff-only upstream/master
git push origin master        # optional

# 3. In den Arbeitsbranch mergen
git checkout fable
git merge master
```

### Bei Konflikten

```sh
git status                    # zeigt "both modified"-Dateien
```

Für jede Konfliktdatei:

| Datei | Regel |
|---|---|
| `src/img/ic_suspendy_16x16.png`, `…_16x16_grey.png`, `…_32x32_grey.png` | **immer unsere Version**: `git checkout --ours <datei>` |
| `src/js/gsCustomSuspend.js` | kann nicht konfligieren (existiert nur bei uns) |
| `CHANGELOG.md`, `README.md` | Upstream-Teil übernehmen, Fork-Abschnitt am Ende behalten |
| `.gitignore` | Upstream-Teil übernehmen, die `!/docs`-Zeile am Ende **muss bleiben** (sonst verschwindet `docs/` aus dem Repo) |
| `src/_locales/en|de/messages.json` | beide Seiten behalten; JSON-Kommas prüfen |
| alle anderen | Konflikt von Hand lösen – die `[FORK]`-Zeile muss **erhalten bleiben** und weiter zum umgebenden Upstream-Code passen |

```sh
git add <datei>
git merge --continue
```

### Pflicht-Checks nach jedem Merge

```sh
# a) Alle Hook-Stellen noch vorhanden? (Soll: 27 Treffer außerhalb gsCustomSuspend.js, Stand 09/2026)
grep -rn "\[FORK\]" src --include=*.js --include=*.html --include=*.css | grep -v gsCustomSuspend.js | wc -l

# b) Signaturen, die der Fork erweitert, noch kompatibel?
grep -n "generateSuspendedUrl" src/js/*.js          # alle Aufrufe mit 4. Argument?
grep -n "effectiveSuspendTime === '0'" src/js/*.js  # darf es NICHT mehr geben (durch resolveSuspendTime ersetzt)

# c) Lint (Fork-Dateien müssen fehlerfrei sein; Upstream hat ein paar bekannte Altfehler)
npx eslint --quiet src/js/gsCustomSuspend.js src/js/tgs.js src/js/gsTabSuspendManager.js \
  src/js/gsUtils.js src/js/popup.js src/js/suspended.js src/js/historyUtils.js

# d) Locale-JSON valide?
node -e "for (const l of ['en','de']) JSON.parse(require('fs').readFileSync('src/_locales/'+l+'/messages.json','utf8').replace(/^\uFEFF/,''))"

# e) Manuelle Tests → docs/TESTING.md
```

### Typische Upstream-Änderungen, die Aufmerksamkeit brauchen

| Wenn Upstream … | dann … |
|---|---|
| `resetAutoSuspendTimerForTab()` umbaut | Hook `resolveSuspendTime(tab.url, suspendTime)` muss **nach** der finalen Berechnung von `suspendTime` und **vor** dem `isNaN/<= 0`-Check stehen |
| `calculateTabStatus()` / `checkTabEligibilityForSuspension()` den Never-Check ändert | unseren `resolveSuspendTime(...).minutes === 0` an die neue Stelle ziehen |
| `generateSuspendedUrl()` das Hash-Format ändert | `buildFaviconHashParam()` muss weiterhin **vor** `uri=` landen |
| `getHashVariable()` umschreibt | `getFaviconFromSuspendedUrl()` gegenprüfen (Smoke-Test unten) |
| `suspended.js initTab()` das Favicon-Setup verschiebt | `getPassthroughFaviconMeta()` davor einhängen |
| `popup.js setStatus()` umbaut | `statusDetail += await getSuspendTimeDetail(status)` direkt vor dem `innerHTML`-Write |
| `historyUtils.migrateTabs()` ändert | `convertForeignSuspendedUrl(url)` vor dem Host-Swap behalten |
| `health.js scanTab()`/`scan()` umbaut | Flag `_ignoreDiscardedGrouped` muss vor der Tab-Schleife gesetzt und im Chrome/Edge-Zweig geprüft werden. Baut Upstream den Fix selbst ein → Hook entfernen |
| `options.js renderNeverSuspendGroups()` umbaut | `renderNeverSuspendGroupPicker(groupKeys, openGroups)` am Ende aufrufen; Signatur ggf. anpassen |
| `background.js` Message-Switch umbaut | Case `addNeverSuspendGroup` neben `removeNeverSuspendGroup` behalten |
| neue Settings-Keys in `gsStorage` einführt | keine Aktion, unser Key hängt am Block-Ende |
| eigene Custom-Timeout-Funktion einführt (Feature-Request upstream?) | Fork-Feature 1 evtl. **entfernen** und Migration des Storage-Keys erwägen |

### Smoke-Test des Moduls (ohne Browser)

Es gibt keine Test-Suite im Upstream. Ein schneller Node-Smoke-Test des Parsers/Matchers/Favicon-Roundtrips
liegt als Vorlage in `docs/TESTING.md` (Abschnitt „Node-Smoke-Test“).

## Alternative: Rebase statt Merge

Wenn eine lineare Historie gewünscht ist:

```sh
git checkout fable
git rebase master
# Konflikte wie oben lösen, dann:
git rebase --continue
git push --force-with-lease origin fable
```

Nachteil: Force-Push; Vorteil: Fork-Commits bleiben als saubere, kleine Commits oben auf.
Tipp: Fork-Commits thematisch klein halten (ein Feature = ein Commit), dann sind Konflikte lokal begrenzt.

## Wenn Upstream ein Fork-Feature selbst einbaut

1. Upstream-Implementation prüfen (Storage-Key, Format).
2. Fork-Hooks für dieses Feature entfernen (`grep [FORK]`), Modul-Funktionen löschen.
3. Falls nötig, einmalige Migration alter Werte (`gsCustomSuspendTimes` → neuer Key) in
   `background.js onInstalled` – **auch das als `[FORK]` markieren**.
4. Katalog in `PERSOENLICHE_AENDERUNGEN.md` + Fork-Abschnitt im `CHANGELOG.md` aktualisieren.
