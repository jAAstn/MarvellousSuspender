# Testen (Fork)

Stand 28.10.2026 · Manifest 9.1.0.1. Die Extension hat eine echte Unit-Suite (Vitest), dazu
Lint-Gate, Build und eine manuelle Browser-Checkliste für alles, was nur im Browser sichtbar ist.

## 1. Unit-Tests

```sh
npm test                 # vitest run, alle tests/**/*.test.js
npx vitest run tests/gsUtils.cleanUrl.test.js   # eine Datei
```

- Konfiguration: `vitest.config.mjs`, `environment: 'node'`, Setup `tests/setup/chrome-stub.js`.
- Der Stub ist die **einzige** `chrome.*`-Attrappe. Er implementiert bewusst nur, was die Module
  beim Laden und in den Tests anfassen; ein nicht gestubbter Aufruf soll laut scheitern.
- Aktueller Stand: **31 Dateien, 514 Tests; 513 grün, 1 rot.**
  Die rote Stelle ist bekannt und dokumentiert:
  `tests/gsTabSuspendManager.eligibility.test.js` – eine numerische `0` als `SUSPEND_TIME`
  soll laut Test **nicht** als „Never“ gelten. Das ist die Upstream-Oddity, keine Regression
  dieses Branches; der Test wird nicht durch eine Verhaltensänderung „passend“ gemacht.

E2E liegt getrennt und braucht einen anderen Lauf:

```sh
npm run test:e2e         # vitest.e2e.config.mjs, tests/e2e/
```

## 2. Lint

```sh
npm run lint             # volle Ausgabe (Altlasten + eigene Änderungen)
npm run lint:ci          # Gate: nur Verstöße, die nicht in lint-baseline.json stehen
npm run lint:baseline    # Baseline neu schreiben – nur bewusst, nach Fix-Runde/Regeländerung
```

- `lint-baseline.json` friert **1.061** Bestandsverstöße als `file:line:rule` ein.
- Aktueller Stand: `npm run lint` → **129 Errors, 760 Warnungen** (889 Probleme), alles
  vorbestehend. `npm run lint:ci` ist derzeit **rot**, weil einige neuere Testzeilen noch nicht
  in der Baseline stehen (u. a. `tests/gsTabQueue.test.js`, `tests/setup/suspend-manager-harness.js`,
  `tests/tgs.tabGroupKeyCache.test.js`). Das ist Baseline-Drift, kein neuer Produktionsfehler.
- Für die eigene Änderung reicht der Einzelaufruf; „0 Fehler auf den neu hinzugefügten Zeilen“
  ist das Kriterium, nicht „`npm run lint` ist grün“ (das ist es im Branch nicht):

```sh
npx eslint src/js/gsUtils.js src/js/suspended.js tests/gsUtils.cleanUrl.test.js
```

## 3. Build

```sh
npx grunt zip            # -> build/zip/tms-9.1.0.1.zip
```

Prüft gleichzeitig, dass die Grunt-Kopie alle Dateien findet und die String-Replaces laufen.
Braucht für den CRX-Teil `key.pem`; für `zip` genügt das Standard-Setup.

## 4. Locales

```sh
npm run check-locales
```

Erwartung: die 11 Fork-Keys fehlen in den 17 nicht gepflegten Locales (17 `locale(s) need attention`).
Alles andere wäre neu.
Nur `src/_locales/en/messages.json` wird von Beiträgen gepflegt; `de` ist die zweite
Handpflege-Sprache des Forks. Andere Locales kommen über Crowdin.

## 5. Manuelle Checkliste (Chrome, „Load unpacked“ auf `src/`)

> Auf dem Dev-Rechner ist kein automatisierter Browser-Lauf verfügbar. Die Punkte unten sind
> nach wie vor Pflicht für Änderungen an sichtbarer UI (AGENTS.md, Definition of Done).

### Suspended-Seite / URL-Anzeige (neu, `setUrl`)

- [ ] Tab suspendieren → Topbar zeigt die Original-URL **ohne** `https://`, Query und Trailing Slash
      (z. B. `example.com/path`).
- [ ] Seite mit sehr langer URL → Anzeige bleibt gekürzt, Layout bricht nicht.
- [ ] Klick auf die Topbar unsuspendiert weiterhin (der `onclick`-Handler darf durch `textContent`
      nicht verloren gehen).
- [ ] Präparierter Hash: `chrome-extension://<id>/suspended.html#ttl=Test&pos=0&uri=https://example.com/<img src=x>`
      → der Text erscheint **wörtlich** (kein Bild, kein zusätzliches Element), keine Konsolenfehler.
- [ ] Titel mit Kleiner-als-Zeichen: `…suspended.html#ttl=1%20%3C%202%20%26%20%3Cb%3Efett%3C%2Fb%3E&pos=0&uri=https://example.com`
      → Tab-Titel, große Überschrift und Topbar zeigen `1 < 2 & <b>fett</b>` wörtlich; **kein** `&lt;`
      und kein fettes Element.

### Custom Auto-Suspend Times

- [ ] Optionen → Auto-Suspend: Textarea erscheint **unter** der Always-Suspend-Liste.
- [ ] Globales Timeout „Never“ → Textarea bleibt sichtbar.
- [ ] Regel `example.com : 1`, Tab im Hintergrund → nach ~1 min suspendiert, obwohl global „Never“.
- [ ] Regel `example.com : 0` bei global 5 min → Tab wird **nicht** suspendiert.
- [ ] Reihenfolge: `example.com : 0` über `example.com : 5` → 0 gewinnt; vertauscht → 5 gewinnt.
- [ ] Kommentarzeile `# test` und Leerzeilen stören nicht.
- [ ] Battery: Stecker ziehen → Tabs ohne Regel nehmen den Battery-Wert, Tabs mit Regel behalten sie.

### Popup-Zeile

- [ ] Normaler Tab: zweite Zeile „Wird nach X Min. ausgesetzt“ / „Will suspend after X min“.
- [ ] ≥ 60 min → Stunden-Schreibweise (90 → 1.5, 120 → 2).
- [ ] Custom-Regel → Suffix „(eigene Regel)“ / „(custom)“.
- [ ] Suspended/Whitelist/`chrome://`-Tab → keine zweite Zeile.

### Favicon-Durchreichung

- [ ] Per JS gesetztes `data:`-Favicon bleibt nach dem Suspendieren erhalten.
- [ ] Suspended-URL enthält `&favicon=data%3A…` **vor** `&uri=`.
- [ ] Unsuspend → Original-URL korrekt, kein Favicon-Rest.
- [ ] Normale Seite (http-Favicon) → **kein** `favicon=` in der URL.
- [ ] Session-Manager: wiederhergestellte suspended Tabs zeigen korrekte Favicons.

### History-Cleanup

- [ ] Suspendieren → `chrome://history` enthält keinen `suspended.html`-Eintrag.
- [ ] Original-URL bleibt im Verlauf.
- [ ] Browser-Neustart mit vielen suspended Tabs → keine Fehler im SW-Log.

### ZeroRAM-Migration

- [ ] Test-Tab `.../suspended.html?uri=https%3A%2F%2Fexample.com&ttl=Beispiel` öffnen →
      history.html → Migrate erkennt `pciejkjdekpfadcjaincgoamekjljcfc` → TMS-Platzhalter.
- [ ] Great-Suspender-Format (`#ttl=…&uri=…`) migriert weiterhin per Host-Swap.

### Tab Health

- [ ] `DISCARD_AFTER_SUSPEND` an, benannte Gruppe mit suspendiertem Tab → Scan meldet **0**
      „grouped tabs in broken state“.
- [ ] Option aus, Chrome < 150, Gruppen-Tab von Chrome discarded → wird weiterhin gemeldet.
- [ ] Brave-Pfad (`chrome://newtab/`) unverändert.

### Never-Suspend-Gruppen

- [ ] Benannte Gruppe offen → Select mit „<Name> (<Farbe>)“ + „Hinzufügen“.
- [ ] Hinzufügen → Gruppe in der Liste, verschwindet aus dem Select, Popup zeigt den Gruppen-Status.
- [ ] Unbenannte Gruppe wird **nicht** angeboten.
- [ ] „Entfernen“ → Gruppe taucht wieder im Select auf.

### Tab-Strip-Kontextmenü (aktiv)

- [ ] **Chromium < 150** (z. B. Brave 1.84): Extension neu laden → Errors-Tab bleibt leer, das
      normale Seiten-Kontextmenü zeigt die TMS-Einträge weiterhin, Rechtsklick auf einen Tab zeigt
      **kein** TMS-Untermenü.
- [ ] **Chromium 150+**: Rechtsklick auf einen Tab → TMS-Untermenü mit allen 16 `tab_*`-Aktionen;
      Aktionen wirken auf den rechtsgeklickten Tab, auch wenn ein anderer aktiv ist.
- [ ] Option „Add context menu“ aus/ein → Menü wird korrekt entfernt/neu aufgebaut.

### Externer Message-Kanal

`externalMessageRequestListener` hängt an `chrome.runtime.onMessageExternal`; das Manifest hat
**kein** `externally_connectable`, also dürfen nur andere Extensions senden. Test aus der
Service-Worker-Konsole einer zweiten Test-Extension:

```js
chrome.runtime.sendMessage('<TMS_ID>', { action: 'suspend' }, (r) => console.log('reply:', r));
chrome.runtime.sendMessage('<TMS_ID>', { action: 'unsuspend', tabId: <suspendedTabId> }, (r) => console.log('reply:', r));
```

- [ ] Jeder Aufruf antwortet sofort, auch auf `await`-Pfaden.
- [ ] Unbekanntes `action` → `Error: unknown request.action`.
- [ ] Ungültiger `tabId` → `Error: no tab found with id: …` statt Timeout.

### Regression

- [ ] Suspend/Unsuspend, Whitelist, Always-Suspend, Tab-Gruppen, „Suspend all“ wie vorher.
- [ ] Options speichern/laden ohne Konsolenfehler; Sync überträgt `gsCustomSuspendTimes`.
- [ ] `npm run check-locales` → genau die 11 Fork-Keys fehlen, sonst nichts Neues.
