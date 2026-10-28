# Issue: verbleibende `innerHTML`-Datenpfade

> **Stand:** 28.10.2026 · Branch `testing-bevor-merging-zu-eigen-+-mast` · Manifest 9.1.0.1
> **Regel:** `AGENTS.md` verbietet Seiten-, Tab-, Backup- und Locale-Daten in
> `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`.
> **Warum kein öffentliches GitHub-Issue:** `SECURITY.md` verlangt für Sicherheitsfunde den
> privaten Meldeweg (Advisory oder Mail). Dieses Dokument ist der Merkposten im Fork; ein
> öffentliches Issue würde die Lücke vor einer Fixversion beschreiben. Ob der Fork selbst
> öffentlich ist, entscheidet, ob dieses Dokument mit veröffentlicht wird.

## Kurzfassung

Die CSP der Extension-Seiten fängt den gefährlichsten Teil ab: Es gibt keine
Skriptausführung, keine Inline-Styles, keine externen Bilder und keine Iframes. Übrig
bleibt **Markup-Injection mit Spoiler-/Phishing-Wirkung** in einer Seite, die
`chrome-extension://` als Origin hat. Das ist kein Datenabfluss und keine
Extension-Übernahme, aber ein Verstoß gegen die eigene Policy und ein realistischer
UI-Spoofing-Pfad.

**Einstufung:** niedrig (CVSS-nah 3–4), nicht merge-blockierend, aber vor dem nächsten
Public-Release zu schließen.

## Warum die CSP hier stark hilft

`src/manifest.json` setzt für `extension_pages`:

```
script-src 'self'; object-src 'self'; child-src 'self';
connect-src 'self' https://www.googleapis.com https://accounts.google.com …;
img-src 'self' data: chrome:; style-src 'self'; default-src 'self';
frame-ancestors 'none'
```

Daraus folgt für injiziertes Markup:

| Vektor | möglich? | Grund |
|---|---|---|
| `<script>`, `onerror=`, `javascript:`-Handler | **nein** | `script-src 'self'` |
| `<style>`, `style="…"`, CSS-Overlay | **nein** | `style-src 'self'` |
| `<img src="https://angreifer/…">` (Tracking-Ping) | **nein** | `img-src 'self' data: chrome:` |
| `<iframe src="…">` | **nein** | `child-src 'self'` |
| `<a href="https://phishing…">` | **ja** | Navigation ist nicht von `default-src` erfasst |
| `<form action="https://…">` + injizierte Felder | **ja** | `form-action` fehlt in der CSP |
| Text-/Struktur-Manipulation (`<b>`, `<br>`, `<h1>`) | **ja** | reines Markup |

Zusätzlich filtert `gsUtils.getOriginalUrl()` die Schemata auf `http:`, `https:` und
`file:`. Ein `javascript:`- oder `data:`-Wert aus dem Hash erreicht den `href` daher
nicht. Das ist die zweite Schutzschicht hinter der CSP.

## Stand der Stellen

| Prio | Datei:Zeile | Datenquelle | Erreichbarkeit | Wirkung | Aufwand |
|---|---|---|---|---|---|
| ~~P1~~ | ~~`suspended.js` `setUrl`~~ | `uri` aus dem URL-Hash | **behoben** (28.10.2026): `textContent` + `gsUtils.cleanUrlForDisplay()` | – | – |
| ~~P2~~ | ~~`historyItems.js` `createSessionTitle`~~ | Session-Name (Nutzer oder **importiertes Backup**) | History-Seite, kein Web-Zugriff | **behoben** (28.10.2026): Textknoten + echtes `<small>`; Test `tests/historyItems.sessionTitle.test.js` | – |
| ~~P3~~ | ~~`suspended.js` `setTitle`~~ | `ttl` aus dem Hash | web-accessible Seite | **behoben** (28.10.2026): `gsUtils.setSuspendedPageTitle()`, `textContent`; `htmlEncode`-Block entfernt; Test `tests/gsUtils.suspendedTitle.test.js` | – |
| ~~P3~~ | ~~`suspended.js` `setReason`~~ | Locale-String (Crowdin) | nur bei Suspend-Grund „low memory“ | **behoben** (28.10.2026): `gsUtils.setSuspendedPageReason()`, `textContent`; Test `tests/gsUtils.suspendedReason.test.js` | – | – |
| P4 | `suspended.js:126/130` `setCommand` | Hotkey (`chrome.commands`) + Locale | Extension-eigene Daten | kein realistischer Angriff | trivial |
| P4 | `suspended.js:276` `setWatermark` | Manifest-Name/Version | Extension-eigene Daten | keiner | trivial |
| P4 | `suspended.js:78/399` Preview-/Toast-Template | statisches Template im HTML | keine Fremddaten | keiner | – |
| P4 | `history.js:447` `migrateNameEl` | Name bekannter Fremd-Extensions | feste Liste | keiner | trivial |
| ~~P4~~ | ~~`historyItems.js` `createEl`~~ | beliebiger Text, aber `htmlEncode` davor | diverse Aufrufer | **behoben** (28.10.2026): `textContent` statt `innerHTML = htmlEncode(text)`; der Session-Test lässt `innerHTML` werfen | – |
| P4 | `health.js` (mehrere), `popup.js:222` | Locale-Strings + Zähler | Extension-eigene Daten | keiner | – |
| – | `debug.js:351` | Log-Einträge (enthalten URLs/Titel) | Debug-Seite | **bereits korrekt** `htmlEncode` | – |

## Erledigt

1. ~~`setUrl`~~ – `textContent` + `gsUtils.cleanUrlForDisplay()`.
2. ~~`sessionTitle`~~ – Textknoten + echtes `<small>`.
3. ~~`setTitle`~~ – `gsUtils.setSuspendedPageTitle()`, `htmlEncode`-Block entfernt.
4. ~~`setReason`~~ – `gsUtils.setSuspendedPageReason()`, `textContent`.
5. ~~`createEl`~~ – `textContent` statt `innerHTML = htmlEncode(text)`.

Damit ist keine Stelle mehr offen, an der Nutzer-/Backup-/Hash-/Locale-Daten ungefiltert
in eine Extension-Seite gelangen. Die verbleibenden Treffer sind statisches Markup
(Template-Klone, Icons) oder Extension-eigene Daten ohne Fremdeinfluss und können in
einem Aufräum-PR mitlaufen.

## Testbarkeit

Die Test-Suite läuft in `environment: 'node'` (kein jsdom). Deshalb:

- Reine String-Logik (wie `gsUtils.cleanUrlForDisplay()`) direkt testen – bereits
  geschehen in `tests/gsUtils.cleanUrl.test.js`.
- Für DOM-Aufbau (`sessionTitle`, `setTitle`) entweder eine kleine Builder-Funktion
  herausziehen und den erzeugten Text prüfen, oder ein minimales DOM-Double im Test
  aufbauen. Alle drei Muster sind jetzt im Repo: `tests/gsUtils.cleanUrl.test.js` für
  reine String-Logik, `tests/historyItems.sessionTitle.test.js` für den DOM-Aufbau,
  `tests/gsUtils.suspendedTitle.test.js` und `tests/gsUtils.suspendedReason.test.js`
  für „schreibt Text, niemals innerHTML“. Kein neues npm-Paket ohne
  Maintainer-Zusage (`AGENTS.md`).

## Abgrenzung

`innerHTML` mit **statischem** Markup (Template-Klone, Icons, eigene Beschriftungen)
ist kein Finding. Die Regel betrifft Daten, nicht jede Verwendung der Eigenschaft.
