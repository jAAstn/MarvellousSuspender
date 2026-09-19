# Katalog der persönlichen Änderungen

> **Stand:** 19.09.2026 · Basis: `upstream/master` (gioxx/MarvellousSuspender, v9.0.3, Commit `25574c39`)
> **Prinzip:** Alle Fork-Logik lebt in **einem** eigenen Modul `src/js/gsCustomSuspend.js`.
> Upstream-Dateien enthalten nur minimale Hooks, jede Zeile ist mit `// [FORK]` (JS/CSS)
> bzw. `<!-- [FORK] -->` (HTML) markiert.
> `grep -rn "\[FORK\]" src` listet **alle** Berührungspunkte → Pflicht-Check nach jedem Upstream-Merge
> (siehe [UPSTREAM_UPDATE.md](UPSTREAM_UPDATE.md)).

## Übersicht der Hooks (27 Stellen außerhalb des Moduls)

| Datei | Anzahl | Was |
|---|---|---|
| `src/js/gsStorage.js` | 2 | Key `CUSTOM_SUSPEND_TIMES` + Default `''` |
| `src/js/gsUtils.js` | 3 | Import, `generateSuspendedUrl(…, favIconUrl)`, Settings-Change-Trigger |
| `src/js/tgs.js` | 4 | Import, Timer-Override, Status-Override, History-Retry |
| `src/js/gsTabSuspendManager.js` | 5 | Import, 2× `favIconUrl`, History-Cleanup, Eligibility-Override |
| `src/js/gsTabDiscardManager.js` | 1 | `favIconUrl` durchreichen |
| `src/js/gsSession.js` | 1 | `favIconUrl` durchreichen |
| `src/js/suspended.js` | 3 | Import, `getPassthroughFaviconMeta()`, Aufruf in `initTab()` |
| `src/js/options.js` | 3 | `elementPrefMap.customSuspendTimes`, Aufruf + Funktion `renderNeverSuspendGroupPicker()` |
| `src/options.html` | 2 | Textarea-Block, Gruppen-Picker-Block |
| `src/js/health.js` | 4 | Import, Flag `_ignoreDiscardedGrouped`, Setzen in `scan()`, Prüfung in `scanTab()` |
| `src/js/background.js` | 1 | Message-Case `addNeverSuspendGroup` |
| `src/css/style.css` | 1 | `.tabGroupPicker` |
| `src/js/popup.js` | 3 | Import, `getSuspendTimeDetail()`, Aufruf in `setStatus()` |
| `src/css/popup.css` | 1 | `.statusTimeDetail` |
| `src/js/history.js` | 2 | Import, `knownExtensions[ZeroRAM]` |
| `src/js/historyUtils.js` | 2 | Import, ZeroRAM-Konvertierung in `migrateTabs()` |
| `src/_locales/en/messages.json` | 11 Keys | (nicht markiert – JSON erlaubt keine Kommentare) |
| `src/_locales/de/messages.json` | 11 Keys | dito |
| `.gitignore` | 1 | `!/docs` – Upstream ignoriert `/docs`, der Fork versioniert es (Zeile am Dateiende) |
| `CHANGELOG.md`, `README.md` | je 1 Abschnitt | Fork-Abschnitt am Dateiende (Deutsch) |

Importe stehen **immer als letzte Zeile** des jeweiligen Import-Blocks (ein vorhersehbarer Hunk pro Datei).

---

## 1. Custom Auto-Suspend Times (Regex / Wildcard / Substring)

**Beschreibung:** Pro-URL-Override des globalen Suspend-Timeouts. Textliste in den Optionen,
eine Regel pro Zeile im Format `PATTERN : MINUTES`.

- Getrennt wird am **letzten** Doppelpunkt → `https://example.com:8080/x : 7` funktioniert.
- Komma als Dezimaltrenner erlaubt (`2,5`), `0` = dieser Tab wird **nie** automatisch suspendiert.
- `#` oder `//` am Zeilenanfang = Kommentar. Ungültige Zeilen werden stillschweigend ignoriert.
- Reihenfolge = Priorität (erster Treffer gewinnt). Deshalb läuft die Liste **nicht** durch
  `gsUtils.cleanupWhitelist()` (das würde sortieren/deduplizieren).
- Battery-Timeout (`SUSPEND_TIME_ON_BATTERY`, Upstream #252) wird respektiert: der Upstream berechnet
  erst den effektiven globalen Wert, **dann** ersetzt der Fork ihn durch eine passende Regel.

**Match-Typen** (in dieser Reihenfolge, implementiert in `gsCustomSuspend.testPattern()`):
1. Regex: `/pattern/` → `gsUtils.testForMatch()` (gleiche Semantik wie Whitelist)
2. Wildcard: enthält `*` → escaped + `*` → `.*` (Fork-Ergänzung)
3. Substring: alles andere → `gsUtils.testForMatch()` (Vorkommen irgendwo in der URL)

**Modul-API (`gsCustomSuspend`):**

| Funktion | Zweck |
|---|---|
| `parseCustomSuspendTimes(raw)` | Text → `[{ pattern, minutes }]` |
| `testPattern(pattern, url)` | Einzelvergleich Regex → Wildcard → Substring |
| `getCustomSuspendMinutesForUrl(rules, url)` | erste passende Regel oder `null` |
| `getCustomSuspendRules()` | liest + parst (memoisiert auf Rohtext) |
| `resolveSuspendTime(url, globalSuspendTime)` | **zentraler Einstieg** → `{ minutes, isCustom }` |
| `getEffectiveGlobalSuspendTime(isCharging)` | spiegelt Upstream-Logik (AC/Battery) für Kontexte ohne eigene Berechnung (Popup) |
| `formatSuspendTimeDetail(info)` | Popup-Text „Will suspend after …“ |

**Hooks:**
- `tgs.resetAutoSuspendTimerForTab()` – nach der Battery-Berechnung:
  `suspendTime = (await gsCustomSuspend.resolveSuspendTime(tab.url, suspendTime)).minutes;`
- `tgs.calculateTabStatus()` – `effectiveSuspendTime === '0'` ersetzt durch `resolveSuspendTime(...).minutes === 0`
  → eine Regel kann ein globales „Never“ aufheben **oder** mit `0` ein „Never“ nur für diese URL erzwingen.
- `gsTabSuspendManager.checkTabEligibilityForSuspension()` (forceLevel ≥ 3) – identische Ersetzung.
- `gsUtils.performPostSaveUpdates()` – `changedSettingKeys.includes(gsStorage.CUSTOM_SUSPEND_TIMES)` löst
  `resetAutoSuspendTimerForTab` für alle normalen Tabs aus.
- `options.html` – eigener `<div class="formRow">` direkt unter der „Always suspend“-Liste.
  **Bewusst ohne** `autoSuspendOption`-Klasse, damit die Liste bei globalem „Never“ sichtbar bleibt.

**Semantische Erweiterung ggü. Upstream (bewusst):** Ein nicht-numerischer/leerer globaler Wert wird
jetzt als `0` (= Never) behandelt. Upstream-Default ist `'60'` und der Wert kommt aus einem `<select>`,
praktisch also kein Unterschied.

---

## 2. Popup-Anzeige „Wann wird der Tab suspended?“

**Beschreibung:** Unter dem normalen Status des aktiven Tabs erscheint eine zweite, kleinere Zeile:
`Will suspend after X min` / `… X h`, bei Custom-Regel zusätzlich ` (custom)`.
Nur bei Status `NORMAL`/`ACTIVE` (= ein Timer kann überhaupt laufen). Für suspended/whitelisted/
never/special Tabs bleibt die Zeile leer.

**Hinweis:** Bei einer Custom-Regel `0` liefert `calculateTabStatus()` `STATUS_NEVER`, das Popup zeigt dann
den Upstream-Text „Automatic tab suspension disabled“ – ohne `(custom)`-Hinweis. Akzeptiert (siehe Roadmap).

**Dateien:** `popup.js` (`getSuspendTimeDetail(status)`), `popup.css` (`#statusDetail .statusTimeDetail`),
`_locales/{en,de}` (`js_popup_suspend_time_minutes|hours|custom`). Text wird per `gsUtils.htmlEncode()`
eingesetzt (kein XSS über i18n-Strings).

---

## 3. Favicon-Durchreichung (data:-URL) – „mirrors ZeroRAM“

**Beschreibung:** Ein zur Laufzeit per Script injiziertes `data:`-Favicon geht sonst beim Suspend verloren
(`gsFavicon` löst über den Chrome-Favicon-Cache neu auf und findet es nicht). Das Favicon wird jetzt als
`favicon=<encodeURIComponent(dataUrl)>`-Hash-Parameter in der Suspended-URL mitgeführt.

**Regeln (`gsCustomSuspend.isPassthroughFavicon()`):** nur `data:`-URLs, nur `< 16 384` Zeichen.
`http(s)`-Favicons werden **nicht** angehängt (Chrome-Cache löst sie ohnehin auf).

**Hash-Reihenfolge ist kritisch:** `#ttl=…&pos=…&favicon=…&uri=…` – `uri=` muss **letzter** Parameter
bleiben, weil `gsUtils.getHashVariable()` alles nach `uri=` unencoded als Original-URL liest.

**Dateien:**
- `gsUtils.generateSuspendedUrl(url, title, scrollPos, favIconUrl)` – 4. Parameter optional,
  Einfügen über `gsCustomSuspend.buildFaviconHashParam()`.
- Aufrufstellen mit `tab.favIconUrl`: `gsTabSuspendManager.js` (3×), `gsTabDiscardManager.js` (1×),
  `gsSession.js` (1×, `sessionTab.favIconUrl`).
- `suspended.js` – `getPassthroughFaviconMeta(suspendedUrl)` baut via `gsFavicon.buildFaviconMeta()`
  das Meta; Fallback auf `gsFavicon.getFaviconMeta(tab)` (Upstream-Pfad) bei Fehler/Abwesenheit.

**Trade-off:** Suspended-URLs (und damit Session-Backups) werden bis zu 16 KB länger pro Tab.

---

## 4. History-Cleanup für Suspended-Platzhalter – „mirrors ZeroRAM“

**Beschreibung:** `chrome.tabs.update` auf `chrome-extension://…/suspended.html#…` erzeugt einen
Verlaufseintrag pro Suspend. Upstream räumt erst beim **Un**suspend auf (`removeTabHistoryForUnsuspendedTab`).
Der Fork löscht die Platzhalter-URL zusätzlich:
1. direkt nach `gsChrome.tabsUpdate()` in `gsTabSuspendManager.executeTabSuspension()`
   (kann zu früh sein – Eintrag existiert evtl. noch nicht), und
2. bei `status === 'complete'` in `tgs.handleSuspendedTabStateChanged()` (der zuverlässige Retry).

`chrome.history.deleteUrl()` auf eine nicht vorhandene URL ist ein No-op; Fehler werden nur geloggt.
Permission `history` ist im Upstream-Manifest bereits vorhanden.

---

## 5. ZeroRAM-Migration

**Beschreibung:** Die History-Seite (Abschnitt „Migrate“) kann Tabs einer anderen Suspend-Extension
übernehmen. ZeroRAM Suspender (`pciejkjdekpfadcjaincgoamekjljcfc`) wird als bekannte Extension ergänzt.

**ZeroRAM-Format** (verifiziert im Quellcode [yhchiu/ZeroRAM-Suspender](https://github.com/yhchiu/ZeroRAM-Suspender), `background.js`):
`suspended.html?uri=<enc>&ttl=<enc>[&favicon=<enc>]` – **Query-String** statt Hash, alle Werte
`encodeURIComponent`-kodiert.

**Dateien:**
- `history.js` – `knownExtensions[gsCustomSuspend.ZERORAM_EXTENSION_ID] = gsCustomSuspend.ZERORAM_EXTENSION_NAME`
- `historyUtils.migrateTabs()` – vor dem Upstream-Host-Swap: `gsCustomSuspend.convertForeignSuspendedUrl(url)`.
  Liefert bei `?uri=` eine fertige TMS-URL via `gsUtils.generateSuspendedUrl(originalUrl, title, '0', favicon)`
  (Favicon wird über Regel 3 gefiltert), sonst `null` → Upstream-Pfad unverändert.

---

## 6. Eigene Icons

Drei PNGs des **Default**-Icon-Sets (nicht `img/legacy/`) ersetzt – Commit `ffa69791 img change`:

- `src/img/ic_suspendy_16x16.png` (Haupt-Action-Icon, 1276 → 755 Bytes)
- `src/img/ic_suspendy_16x16_grey.png` (Icon „pausiert/discarded/suspended“)
- `src/img/ic_suspendy_32x32_grey.png` (dito, 32 px)

Referenzen: `manifest.json` (`action.default_icon`, `icons`), `tgs.js` (`ICON_SUSPENSION_ACTIVE/PAUSED`),
`gsMascot.js` (Mapping auf Legacy-Varianten). Bei einem Upstream-Update dieser Dateien: **unsere Version
behalten** (`git checkout --ours`).

---

## 7. Tab Health: False-Positive „grouped tabs in broken state“

**Problem (Upstream):** `health.js scanTab()` zählt jeden Tab als „Tab Groups bug“, der gleichzeitig
gruppiert, suspendiert **und** discarded ist. Mit aktivierter Option „Apply your browser's built-in
memory-saving when suspending“ (`DISCARD_AFTER_SUSPEND`) discarded TMS suspendierte Tabs aber absichtlich
→ jeder gesunde Gruppen-Tab wird gemeldet, „Repair“ schließt/erstellt ihn neu, er wird sofort wieder
discarded → beim nächsten Scan wieder „broken“. Der zugrunde liegende Chrome-Bug (crbug.com/522338670)
ist laut Upstream-CHANGELOG ab **Chrome 150** nativ gefixt.

**Fix:** `gsCustomSuspend.shouldIgnoreDiscardedGroupedTabs()` → `true`, wenn die Option aktiv ist **oder**
`gsUtils.getChromeVersion() >= 150`. `health.js` setzt das Ergebnis einmal pro `scan()` in ein Modul-Flag
und überspringt dann den Chrome/Edge-Pfad (`tabGroupsDiscarded`). Der Brave-Pfad (`chrome://newtab/`)
bleibt unberührt.

**Upstream-Kandidat:** ja – reiner Bugfix, sollte als PR/Issue gemeldet werden.

---

## 8. Optionen: Never-Suspend-Gruppen direkt hinzufügen

**Beschreibung:** Upstream erlaubt das Hinzufügen einer Gruppe zur Liste „Never suspend tabs in the
following tab groups“ nur per Rechtsklick-Kontextmenü; die Options-Seite zeigt/entfernt nur. Der Fork
ergänzt darunter ein `<select>` mit allen **offenen, benannten** Gruppen, die noch nicht in der Liste
sind, plus „Add“.

**Regeln:** Nur der Live-Key (`gsUtils.getTabGroupKey(group)`, also nur benannte Gruppen) – dieselbe
Regel wie im Kontextmenü („name the group before exempting it“). Zwei Gruppen mit gleichem Namen+Farbe
sind ein Eintrag (wie in der Liste). Das Hinzufügen läuft über den Service Worker
(`tgs.setTabGroupNeverSuspend(groupKey, true)`), exakt der Pfad des Upstream-„Remove“-Links – Timer-
Neu-Armierung und Incognito-Schutz sind damit identisch.

**Dateien:**
- `options.html` – `<div class="tabGroupPicker">` mit `#neverSuspendGroupsSelect` + `#neverSuspendGroupsAddBtn`
- `options.js` – `renderNeverSuspendGroupPicker(listedKeys, openGroups)`, aufgerufen am Ende von
  `renderNeverSuspendGroups()` (deckt Add + Remove ab)
- `background.js` – Message-Case `addNeverSuspendGroup` (validiert mit `gsUtils.parseTabGroupKey`)
- `style.css` – `.tabGroupPicker`, `.tabGroupPicker a.disabled`
- Locales `en`/`de`: `html_options_never_suspend_groups_add`, `…_add_placeholder`, `…_add_none`

---

## 9. i18n

Nur `en` (Default-Locale, Chrome-Fallback) und `de` gepflegt. `npm run check-locales` meldet deshalb
die 11 Keys in 16 weiteren Locales als `missing` – **bekannt und akzeptiert**. Die Keys:

```
html_options_always_suspend_custom_times_title
html_options_always_suspend_custom_times_tooltip_line1a
html_options_always_suspend_custom_times_tooltip_line1b
html_options_always_suspend_custom_times_tooltip_line2a
html_options_always_suspend_custom_times_tooltip_line2b
js_popup_suspend_time_minutes      ($mins$)
js_popup_suspend_time_hours        ($hours$)
js_popup_suspend_time_custom
html_options_never_suspend_groups_add
html_options_never_suspend_groups_add_placeholder
html_options_never_suspend_groups_add_none
```
