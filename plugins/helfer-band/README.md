# helfer-band

**English summary:** A Claude Code mod that adds a `/helfer` dashboard and a status band above the prompt. It shows usage limits of Claude, OpenAI Codex and Google Antigravity, the local FreeLLMAPI and Free Claude Code proxies, and background jobs started by the user's own helper scripts. Everything is read locally; nothing is sent anywhere unless `HELFER_LINKS=1` is set (see below). Sections for tools that are not installed show "nicht eingerichtet" (not set up).

## Was die Mod zeigt

- **Claude:** 5-Stunden-Fenster und Woche dieses Abos, aus den Daten, die Claude Code selbst liefert.
- **Codex (OpenAI):** Auslastung aus den lokalen Sitzungsdateien unter `~/.codex/sessions`.
- **Antigravity (Google):** verbleibende Kontingente je Modellgruppe.
- **FreeLLMAPI:** eingerichtete Anbieter, Anfragen und Tokens von heute.
- **Free Claude Code:** ob der lokale Proxy läuft, Modell, bereite und fehlgeschlagene Anbieter.
- **Aufträge:** laufende und beendete Hintergrund-Aufträge der letzten 24 Stunden mit Dauer, Tokens und Link zum Bericht.

## Was die Mod ausführt, liest und abruft

Offen gelegt für die Prüfung und für alle, die sie installieren:

- **Datenlieferant:** Die Mod startet alle 10 Sekunden `helfer-status --json`. Liegt eine ausführbare Datei unter `~/.local/bin/helfer-status`, nimmt sie diese (eigene Anpassung des Nutzers), sonst das mitgelieferte `bin/helfer-status` (Python 3).
- **Lokale Dateien, nur lesend:** `~/.codex/sessions`, `~/.local/state/helfer/auftraege.jsonl`, die Protokolldatei `.helfer.log` im Ordner eines Auftrags, die FreeLLMAPI-Datenbank unter `~/Library/Application Support/FreeLLMAPI/freeapi.db` (mit `sqlite3 -readonly`). Schlüssel werden nicht gelesen.
- **Lokale Programme, falls vorhanden:** `agy -p /usage` (Antigravity-Kontingent) und `~/.local/bin/ki-weiche` (eigene Empfehlung des Nutzers).
- **Lokales Netz:** `GET http://127.0.0.1:8082/admin/api/status` für Free Claude Code (Port über `FCC_PORT`). Nur Status, keine Schlüssel.
- **Internet:** nur mit gesetzter Umgebungsvariable `HELFER_LINKS=1`. Dann lädt `/artikel` die Artikelliste von `https://stevennoack.de/index.json` und das Dashboard zeigt Links zu stevennoack.de. Ohne die Variable gibt es keinen Abruf.
- **Knopf „Bericht öffnen“:** öffnet die `ERGEBNIS.md` eines Auftrags mit `open -a TextEdit` (macOS).

- **Eine Datei, die die Mod schreibt:** `~/.local/state/helfer/claude-kontingent.json` mit den Prozentwerten und Rücksetzzeiten des Claude-Kontingents (sonst nichts). Die Datei liest das optionale Skript `ki-weiche` des Nutzers. Andere Dateien schreibt die Mod nicht.

### Warum die Mod Programme startet

Die Prüfung von Anthropic meldet in `hooks/register.tsx` einen Programmaufruf, dessen Befehl sie nicht ganz lesen kann (Zeile mit `$.process.run([bin, '--json'])`). `bin` ist genau einer von zwei festen Pfaden: `~/.local/bin/helfer-status`, falls vorhanden, sonst `${CLAUDE_PLUGIN_ROOT}/bin/helfer-status` aus diesem Plugin. Das Argument ist immer `--json`. Der zweite Aufruf, `open -a TextEdit <Pfad>`, öffnet nur eine `ERGEBNIS.md` zum Lesen. Die Mod nimmt keine Befehle von einem Server an und reicht keine Netzwerkdaten an Programme weiter.

### Was die Hooks tun

- `session.start`: startet den Datenlieferanten alle 10 Sekunden und registriert die Befehle `/helfer` (und mit `HELFER_LINKS=1` auch `/artikel`).
- `command.run` für `helfer` und `artikel`: öffnet das Dashboard bzw. die Artikelliste.
- `ui.render` für das eigene Panel und `AbovePrompt`: zeichnet das Dashboard, die Artikelliste und das Band über dem Prompt aus den gelesenen Daten. Die Hooks lesen und verändern keine anderen Aufrufe.

## Datenschutz

Die Mod erhebt, speichert und überträgt keine personenbezogenen Daten. Alles bleibt auf dem eigenen Rechner. Die einzige Verbindung ins Internet ist der Abruf der öffentlichen Artikelliste `https://stevennoack.de/index.json`, und den gibt es nur mit `HELFER_LINKS=1`. Dabei werden keine Daten aus dem Rechner mitgeschickt. Die Mod schickt keine Eingaben ab und ändert keine Einstellungen.

## Voraussetzungen

Claude Code mit Mod-Unterstützung, Python 3. Optional: `codex`, `agy`, FreeLLMAPI, Free Claude Code.

Installation, Anpassung und das JSON-Format von `helfer-status` stehen im README des Repos: https://github.com/MacStenk/claude-mods

## Lizenz

MIT, siehe `LICENSE`.
