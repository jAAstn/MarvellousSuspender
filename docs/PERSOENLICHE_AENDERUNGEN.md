# Katalog der persönlichen Änderungen

> **Stand:** 28.10.2026 · Basis: `upstream/release/9.1.0` (Commit `7aeb8e45`), Manifest **9.1.0.1**
> (`860bb1fe`) · Branch `testing-bevor-merging-zu-eigen-+-mast`
> **Prinzip:** Alle Fork-Logik lebt in **einem** eigenen Modul `src/js/gsCustomSuspend.js`.
> Upstream-Dateien enthalten nur minimale Hooks, jede Zeile ist mit `// [FORK]` (JS/CSS)
> bzw. `<!-- [FORK] -->` (HTML) markiert.
> `grep -rn "\[FORK\]" src` listet **alle** Berührungspunkte → Pflicht-Check nach jedem Upstream-Merge
> (siehe [UPSTREAM_UPDATE.md](UPSTREAM_UPDATE.md)).

## Übersicht der Hooks (40 Stellen außerhalb des Moduls, 42 Marker gesamt)

| Datei | Anzahl | Was |
|---|---|---|
| `src/js/gsTabSuspendManager.js` | 6 | Import, 2× `favIconUrl`, History-Cleanup, Eligibility-Override |
| `src/js/tgs.js` | 4 | Import, Timer-Override, Status-Override, History-Retry |
| `src/js/gsUtils.js` | 4 | Import, `generateSuspendedUrl(…, favIconUrl)`, Settings-Change-Trigger |
| `src/js/suspended.js` | 3 | Import, `getPassthroughFaviconMeta()`, Aufruf in `initTab()` |
| `src/js/options.js` | 3 | `elementPrefMap.customSuspendTimes`, Aufruf + Funktion `renderNeverSuspendGroupPicker()` |
| `src/js/popup.js` | 3 | Import, `getSuspendTimeDetail()`, Aufruf in `setStatus()` |
| `src/js/health.js` | 3 | Import, Flag `_ignoreDiscardedGrouped`, Prüfung in `scanTab()` |
| `src/js/gsStorage.js` | 2 | Key `CUSTOM_SUSPEND_TIMES` + Default `''` |
| `src/js/background.js` | 2 | Message-Case `addNeverSuspendGroup`, externer Message-Listener (detached-IIFE-Rewrite) |
| `src/js/history.js` | 2 | Import, `knownExtensions[ZeroRAM]` |
| `src/js/historyUtils.js` | 2 | Import, ZeroRAM-Konvertierung in `migrateTabs()` |
| `src/options.html` | 2 | Textarea-Block, Gruppen-Picker-Block |
| `src/js/gsTabDiscardManager.js` | 1 | `favIconUrl` durchreichen |
| `src/js/gsSession.js` | 1 | `favIconUrl` durchreichen |
| `src/css/style.css` | 1 | `.tabGroupPicker` |
| `src/css/popup.css` | 1 | `.statusTimeDetail` |
| `src/js/gsCustomSuspend.js` | 2 | im Modul selbst (nicht Teil der 40) |
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

**Upstream-Status:** #551 ist inzwischen gemergt (`b5fa5ee4`); Upstream gated
`isBrokenGroupedDiscardedTab()` selbst auf Chrome < 150. Der Fork-Flag ist für diesen Fall damit
redundant – siehe Roadmap („Tab-Health-Fork-Flag aufräumen“).

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
die 11 Keys in 17 weiteren Locales als `missing` – **bekannt und akzeptiert**. Die Keys:

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

---

## 10. Tab-Strip-Kontextmenü (aktiv, mit Browser-Guard)

**Hintergrund:** Der `tab`-Context-Typ für `chrome.contextMenus` (Rechtsklick auf einen Tab in der
Tab-Leiste) ist eine **Chromium-150-API**. Auf älteren Engines (z. B. Brave 1.84 / Chromium 142)
warf `create()` mit `contexts: ['tab']` einen TypeError und brach den **kompletten** Menü-Aufbau ab —
auch das normale Seiten-Kontextmenü fehlte.

**Aktueller Stand (`tgs.js`, `[FORK]`-markiert):** 16 Tab-Strip-Einträge werden als Liste aufgebaut.
Nur der **erste** wird in `try/catch` registriert; gelingt das nicht, wird die Sektion übersprungen und
das Seitenmenü bleibt bestehen. Ein Fehler bei einem späteren Eintrag wird bewusst nicht gefangen —
das wäre ein Defekt an genau diesem Eintrag, kein fehlendes Browser-Feature. Die Einträge führen die
bestehende `lastCreate`-Kette des Seitenmenüs fort, damit der Aufbau erst nach dem letzten `create()`
auflöst.

**Vorgeschichte, wichtig für Upstream-Merges:** Commit `d8ec67d3` („Remove Turkish locale & disable
tab-strip menu“) hatte den Block auskommentiert. Der Stand davor war jedoch **syntaktisch kaputt**:
`tabStripItems` und `lastCreate` waren je zweimal im selben Scope deklariert (`node --check`:
`Identifier 'tabStripItems' has already been declared`). Das Auskommentieren war die Rettung, entfernte
aber still 16 Menüeinträge. Commit `f95d6b11` hat die letzte valide Struktur aus `97436179`
wiederhergestellt: Liste bleibt, Erzeugung aktiv, Tab-Strip-Einträge setzen die `lastCreate`-Kette fort.
Alle 12 Kontextmenü-Tests sind grün.

**Nicht mehr vorhanden:** die frühere Wegwerf-Probe `isTabStripContextSupported()` mit eigenem
IPC-Round-Trip. Der leichte `try/catch`-Guard deckt den einzigen realistischen Fehlerfall ab.

---

## 11. Externer Message-Kanal: detached-IIFE-Muster

**Problem:** `externalMessageRequestListener` in `background.js` (antwortet auf `chrome.runtime.sendMessage`
externer Caller, Aktionen `suspend`/`unsuspend`) war eine `async function`, die `sendResponse()` nach
`await`-Punkten (`gsChrome.tabsGet`, `tgs.unsuspendTab`) aufrief. Chrome hält den Message-Kanal aber nur
offen, wenn der Listener **synchron** `true` zurückgibt — ein zurückgegebenes Promise wird ignoriert. Der
Kanal schloss sofort, jede Antwort nach dem ersten `await` ging still verloren, externe Caller warteten bis
zum Timeout.

**Fix (`background.js`, Commit `273b44cb`, `[FORK]`-markiert):** Umstellung auf das Muster des internen
`messageRequestListener`:
- synchroner Listener, der am Ende `return true` ausführt (Kanal bleibt offen),
- gesamte Async-Arbeit in einer detached `(async () => { … })()`-IIFE,
- ergänzender `catch` um den kompletten IIFE-Body: wirft z. B. `tabsGet` oder `unsuspendTab`, bekommt der
  externe Caller jetzt eine (leere) Antwort statt ewig zu hängen,
- Bereinigung: `sendResponse('Error: …', x)` übergab zwei Argumente (Chrome verwirft das zweite still) →
  korrekte Template-Literals; das im async-Body unerreichbare `return true` entfiel, der Durchfall-Pfad
  antwortet jetzt mit `sendResponse()` statt gar nicht.

---

## 12. Promise-Executoren, Lint-Baseline & CI

**Problem 1 — `new Promise(async …)`-Antipattern (12 Stellen in 8 Dateien):** ein async-Executor kann das
äußere Promise per `throw` **nie** settle'n — der Fehler versickert im verworfenen Executor-Promise, alles
Wartende hängt ewig.

**Fix:** jede Stelle ist jetzt eine `async function`, deren Rejection der Aufrufer bereits behandelt
(verifiziert: `gsTabQueue` fängt Executor-Fehler über `Promise.resolve().then(executorFn).catch(exceptionFn)`),
bzw. ein synchroner Executor, der per Callback settle't — der `calculateTabStatus`-Wrapper in `tgs.js` blieb
bewusst synchron, weil das callback-basierte Subjekt **keinen** Rückgabewert liefert (ein `(s) => s`-Rewrite
hätte `undefined` geliefert). Erfolgspfade unverändert; einziger Unterschied: echte Fehler werden zu
Rejections statt ewigem Schweigen.

**Problem 2 — keine CI, 207+ Lint-Errors als wachsender Backlog:** nichts verhinderte, dass neue Verstöße
sich mit den Altlasten vermischen.

**Fix:**
- `scripts/lint-baseline.js` + `lint-baseline.json`: Baseline friert die ~1.060 Bestandsverstöße als
  `file:line:rule`-Keys ein. `npm run lint:ci` (Gate) scheitert nur an **neuen** Verstößen;
  `npm run lint:baseline` regeneriert (Backlog-Abbau schrumpft die Baseline).
- `.github/workflows/ci.yml`: Lint-Gate bei jedem Push/PR; `check-locales` non-blocking
  (`continue-on-error`) bis der Crowdin-Sync die 16 pending Locales liefert.
- `eslint.config.mjs`: `eslint-plugin-promise` (`flat/recommended`) aktiviert, kuratiert — Callback-Mixing-
  und await-to-Regeln aus (die `chrome.*`-APIs sind callback-basiert); die echten Promise-Vertragsregeln
  (`always-return`, `catch-or-return`, `param-names`, `no-return-in-finally`, `valid-params`) greifen auf
  neuem Code. **Stolperstein dokumentiert:** `no-async-promise-executor` ist eine **Core**-ESLint-Regel, keine
  Plugin-Regel — steht jetzt explizit auf `error`.

**Grundlage:** `docs/DECISIONS.md` ADR-010; Upstream-Dateien berührt: `background.js`, `gsChrome.js`,
`gsFavicon.js`, `gsSession.js`, `gsTabSuspendManager.js`, `gsUtils.js`, `suspended.js`, `tgs.js` —
semantisch identische Umbauten ohne `[FORK]`-Marker (kein Verhaltenwechsel, siehe ADR-010).

---

## 13. Performance-Pass (Commit `1cd52c41`)

Kein Verhaltenswechsel, nur weniger wiederholte Arbeit auf heißen Pfaden. Die Änderungen sind
bewusst **nicht** `[FORK]`-markiert: Es sind Upstream-Optimierungen, die auch dort passen würden
(ADR-010).

- **`gsUtils.js`** – Whitelist-/Always-Suspend-Listen werden einmal gesplittet (Cache, max. 20
  Einträge), `/regex/`-Einträge einmal kompiliert (max. 500), `getHashVariable()` parst den Hash
  einer Suspended-URL einmal statt viermal, `htmlEncode()` verwendet ein wiederverwendetes
  `<pre>`, `getChromeVersion()` wird gemerkt.
- **`gsStorage.js`** – `getOption()` liest aus dem geteilten Settings-Cache und klont nicht mehr
  das komplette Objekt pro Eigenschaft; nur echte Objektwerte werden geklont. Der Cache wird
  über `chrome.storage.onChanged` invalidiert.
- **`tgs.js`** – unabhängige `getOption`/Schutz-Prüfungen laufen parallel, die
  Auswertungsreihenfolge von `calculateTabStatus()` bleibt gleich; `isCharging()` wird einmal
  gelesen; Timer-Reset für alle Tabs in 10er-Blöcken.
- **`gsTabSuspendManager.js`** – Capture-Optionen und Eligibility-Reads parallel;
  `isCanvasVisible()` sampelt eine 32×32-Downscale statt das ganze Canvas zurückzulesen.
- **Weitere** – `gsSession.js` (Session-ID gemerkt), `gsBackup.js` (Device-ID pro Kontext),
  `gsFavicon.js` (parallele Fingerprints), `gsPrecapture.js`, `gsTabDiscardManager.js`,
  `background.js` (Battery-Handler), `options.js` (rAF-gebündelter Scroll-Handler).

Mikrobenchmarks für den Cache-Pfad und `getOption()` wurden lokal ausgeführt; die Werte sind
maschinen- und laufzeitabhängig und deshalb **nicht** als Zusage dokumentiert.

---

## 14. Test-Suite (Vitest)

Seit dem 27./28.10.2026 gibt es eine echte Suite statt Nur-Smoke-Test:

- `vitest.config.mjs`: `environment: 'node'`, `tests/**/*.test.js`, Setup
  `tests/setup/chrome-stub.js`. Der Stub implementiert nur die APIs, die die Module beim Laden
  und in den Tests wirklich anfassen; alles andere bleibt absichtlich `undefined`.
- **31 Dateien, 514 Tests** (513 grün), Schwerpunkt: Suspended-URL-Format, Whitelist-/Listen-Caches,
  Queue, Session-Restore, Suspension-Eligibility, Kontextmenü, Storage-Optionen.
- **Bekannte Altlast:** `gsTabSuspendManager.eligibility.test.js` erwartet, dass eine numerische
  `0` als `SUSPEND_TIME` **nicht** als „Never“ gilt (Upstream-Oddity). Der Test ist rot; die
  Abweichung ist dokumentiert und bewusst nicht durch eine Verhaltensänderung „grün“ gemacht.
- E2E liegt getrennt in `tests/e2e/` (`npm run test:e2e`), nicht Teil von `npm test`.

---

## 15. Session-Manager: Session-Titel als Text

`historyItems.createSessionTitle()` setzt den Session-Namen als Textknoten und baut die
Zählerzeile als echtes `<small>`-Element daneben. Vorher ging beides als Template-String durch
`innerHTML`. Der Name kommt aus dem Speichern-Dialog (`window.prompt`) oder aus dem Dateinamen
eines importierten JSON-Backups – also aus Nutzer-/Backup-Daten, nicht aus der Extension.
Das geschützte Leerzeichen ist jetzt ein echtes `\u00A0` (mit `textContent` würde `&nbsp;`
wörtlich erscheinen). Test: `tests/historyItems.sessionTitle.test.js` mit minimalem DOM-Double
(kein jsdom), inklusive Erhalt der Singular-/Plural-Zählerzeile und Markup-im-Namen-Fall.

---

## 16. Suspended-Seite: URL-Anzeige über `textContent`

`setUrl()` schreibt die gekürzte Original-URL nicht mehr per `innerHTML`, sondern per
`textContent`; die Kürzung selbst liegt als reine, testbare Funktion in
`gsUtils.cleanUrlForDisplay()` (`tests/gsUtils.cleanUrl.test.js`). Hintergrund: `suspended.html`
ist web-accessible, der `uri`-Hash ist frei wählbar. Die CSP verhindert Skript, Inline-Styles,
externe Bilder und Iframes; übrig blieb Markup-Injection mit Phishing-/Spoofing-Wirkung.
Die übrigen Stellen stehen mit Priorität in [ISSUE-innerhtml.md](ISSUE-innerhtml.md).

---

## 17. Suspended-Seite: Titel als Text

`gsUtils.setSuspendedPageTitle(doc, title)` setzt `document.title`, `#gsTitle` und
`#gsTopBarTitle` per `textContent`; `setTitle()` hängt nur noch den `mousedown`-Handler an das
Topbar-Element. Der `htmlEncode`-Block in `initTab()` ist entfernt – ein Titel mit `<` bleibt
`<` und wird nicht mehr als `&lt;` angezeigt (genau der Fehler aus 9.0.36, nur umgekehrt).
Test: `tests/gsUtils.suspendedTitle.test.js` (4 Fälle; der `innerHTML`-Setter des Doubles wirft,
damit ein Rückfall sofort auffällt).

---

## 18. Suspended-Seite: Suspend-Grund als Text

`gsUtils.setSuspendedPageReason(doc, reason)` legt die Zeile `#reasonMsg` beim ersten Aufruf an
und schreibt den Grund per `textContent`. Der Grund ist ein Locale-String aus Crowdin und damit
laut `AGENTS.md` Daten; ein `null`-Grund leert die Zeile wie zuvor `innerHTML = null`. Test:
`tests/gsUtils.suspendedReason.test.js` (4 Fälle: Anlegen, Wiederverwenden, leerer Grund,
fehlender Container).

---

## 19. `historyItems.createEl()` ohne `innerHTML`

`createEl()` setzt seinen Text per `textContent` statt per `innerHTML = gsUtils.htmlEncode(text)`.
Das war die letzte Stelle, an der die History-Seite überhaupt noch encodiert hat: Labels aus
`messages.json`, Tab-Titel und Gruppennamen sind Text. Der Session-Test lässt `innerHTML` jetzt
werfen, damit ein Rückfall in den Markup-Pfad sofort auffällt.
