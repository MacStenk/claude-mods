# helfer-band

Claude-Code-Plugin mit Dashboard (`/helfer`) und Statusband über dem Prompt für Hintergrund-Aufträge und Modell-Kontingente.

## Installation

```
/plugin marketplace add MacStenk/claude-mods
/plugin install helfer-band@stevennoack-mods
```

## Was das Panel zeigt

- **Empfehlung („Jetzt nehmen“):** Welcher Helfer für Schreiben, Bauen oder Einzelfragen aktuell am besten geeignet ist (bzw. Kontingente schont).
- **Claude (dieses Abo):** 5-Stunden-Fenster und 7-Tage-Woche mit Balken und Reset-Zeit.
- **Codex-Abo (OpenAI):** 5-Stunden- und Wochenauslastung aus lokalen Sitzungen.
- **Antigravity / agy (Google-Abo):** Verbleibende Kontingente je Modellgruppe und Fenster.
- **FreeLLMAPI:** Lokale Anbieter, aktive Schlüssel, Anfragen, Tokens und Modell-Sperren.
- **Free Claude Code:** ob der lokale Proxy läuft, gewähltes Modell, bereite und beim Start fehlgeschlagene Anbieter, Link zur Verwaltung (Port per `FCC_PORT`, Standard 8082).
- **Aufträge (24 Std.):** Zuletzt gelaufene und aktive Aufträge mit Status (⚙ läuft / ✓ fertig / ✗ Fehler), Dauer, Tokens und Knopf zum Öffnen des Berichts (`ERGEBNIS.md`).
- **Über dem Prompt:** Kompaktes Band der letzten aktiven/beendeten Aufträge direkt in der Eingabezeile.

### Optionale Links

Wird die Umgebungsvariable `HELFER_LINKS=1` gesetzt, blendet das Dashboard zusätzlich direkte Links zu Webseiten ein und schaltet den Befehl `/artikel` frei. Ohne gesetzte Variable bleibt die Leiste verborgen.

## Voraussetzungen

- **Claude Code** mit Plugin-Unterstützung
- **Python 3** (wird vom mitgelieferten `helfer-status` genutzt)

### Optionale Dienste

- OpenAI Codex CLI (`codex`)
- Google Antigravity CLI (`agy`)
- FreeLLMAPI (lokale SQLite-Datenbank)
- Free Claude Code (`fcc-server`, liest nur `/admin/api/status`, keine Schlüssel)
- Helfer-Auftragsregister (`~/.local/state/helfer/auftraege.jsonl`)

Fehlt ein optionaler Dienst, zeigt der entsprechende Abschnitt im Dashboard sauber `nicht eingerichtet` an, ohne Fehlermeldung oder Absturz.

## Anpassen

### Pfad und eigenes Skript für `helfer-status`
- **Datei:** `plugins/helfer-band/hooks/register.tsx`
- **Funktion:** `statusLaden` (im `session.start`-Hook in `register`)

Beim Starten und alle 10 Sekunden sucht das Plugin nach dem Datenlieferanten in dieser Reihenfolge:
1. `~/.local/bin/helfer-status` (falls per `$.fs.stat` vorhanden)
2. `${CLAUDE_PLUGIN_ROOT}/bin/helfer-status` bzw. `${$.plugin.root}/bin/helfer-status` (Fallback auf das im Plugin mitgelieferte Skript)

Wer ein eigenes Skript oder eine angepasste Abfrage nutzen möchte, legt einfach eine ausführbare Datei (`chmod +x`) unter `~/.local/bin/helfer-status` ab. Das Plugin verwendet dieses Skript dann automatisch bevorzugt.

### JSON-Format von `helfer-status --json`
- **Datei:** `plugins/helfer-band/bin/helfer-status`
- **Funktion:** `main()` (Typen in `plugins/helfer-band/types/index.d.ts`)

Das Skript `helfer-status --json` liefert ein JSON-Objekt auf stdout. Wer eigene Dienste oder Backends anbindet, gibt dieses Format aus. Nicht konfigurierte Dienste liefern `null`:

```json
{
  "jetzt": 1791925028,
  "kontingent": {
    "codex": {
      "fenster_prozent": 12.0,
      "fenster_reset": 1791932000,
      "woche_prozent": 45.0,
      "woche_reset": 1792400000
    },
    "agy": [
      {
        "gruppe": "Gemini 2.5 Flash",
        "fenster": "5h",
        "rest": 85.0,
        "reset": "2026-10-13T23:00:00Z"
      }
    ]
  },
  "freellmapi": {
    "anbieter": [
      {
        "anbieter": "ollama",
        "schluessel": 1,
        "aktiv": 1,
        "ok": 20,
        "anfragen": 20,
        "tokens": 4500,
        "sperren": 0,
        "ok_stunde": 5,
        "anfragen_stunde": 5
      }
    ],
    "im_katalog": 3
  },
  "weiche": {
    "schreiben": { "ziel": "agy-sonnet", "grund": "Kontingent frei" },
    "bauen": { "ziel": "codex", "grund": "unter 90 %" }
  },
  "auftraege": [
    {
      "id": "a-101",
      "wer": "codex",
      "ordner": "~/projekte/beispiel",
      "auftrag": "Tests laufen lassen",
      "start": 1791924000,
      "ende": null,
      "rc": null,
      "tokens": 12000,
      "runden": 3,
      "letzte_zeile": "Running tests..."
    }
  ]
}
```

### Eigenen Dienst in `helfer-status` ergänzen
- **Datei:** `plugins/helfer-band/bin/helfer-status`
- **Funktionen:** Eigene Hilfsfunktion und Einbindung in `main()`

Im Skript wird eine Abfragefunktion definiert, die bei Erfolg ein Dictionary oder bei Fehlern `None` liefert, und in `main()` in das `out`-Dictionary übergeben:

```python
def lokales_modell():
    """Prüft einen lokalen Modellserver auf Port 11434 (z. B. Ollama)."""
    import urllib.request
    try:
        req = urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=2)
        daten = json.loads(req.read().decode())
        modelle = [m["name"] for m in daten.get("models", [])]
        return {"aktiv": True, "modelle": modelle, "anzahl": len(modelle)}
    except Exception:
        return None
```

In `main()` wird das Ergebnis eingehängt: `out["lokal"] = lokales_modell()`.

### Auftragsliste `~/.local/state/helfer/auftraege.jsonl`
- **Dateien:** `plugins/helfer-band/hooks/register.tsx` (Funktion `auswerten`) und `plugins/helfer-band/bin/helfer-status` (Funktion `auftraege`)

Aufträge werden als JSONL zeilenweise protokolliert. Start und Ende werden mit derselben `id` als getrennte Zeilen eingetragen:

- **Startzeile:**
  - `id` (String): Eindeutige Kennung des Auftrags
  - `wer` (String): Ausführendes Werkzeug oder Modell (z. B. `codex`, `adler`, `skript`)
  - `ordner` (String): Absoluter Arbeitsordner
  - `auftrag` (String): Kurze Beschreibung der Aufgabe
  - `start` (Zahl): Unix-Timestamp in Sekunden
- **Endezeile:**
  - `id` (String): Identisch zur Startzeile
  - `ende` (Zahl): Unix-Timestamp in Sekunden
  - `rc` (Zahl): Exit-Code (0 für Erfolg, >0 für Fehler)

Beispiel zweier Zeilen in `~/.local/state/helfer/auftraege.jsonl`:

```json
{"id": "job-42", "wer": "mein-skript", "ordner": "~/projekte/beispiel", "auftrag": "Projekt bauen", "start": 1791925000}
{"id": "job-42", "ende": 1791925035, "rc": 0}
```

Die Funktion `auswerten` führt Start- und Endezeilen zusammen. Fehlt die Endezeile, gilt der Auftrag als aktiv (`⚙`). Nach Abschluss bleibt er 30 Minuten im Band sichtbar.

### Steuerung über `HELFER_LINKS`
- **Datei:** `plugins/helfer-band/hooks/register.tsx`
- **Funktionen:** `register` (Prüfung von `HELFER_LINKS` und Registrierung von `/artikel`), `command.run` für `artikel`, `ui.render` für Pane `helfer-dashboard`

Wird die Umgebungsvariable `HELFER_LINKS=1` gesetzt, schalten sich folgende Funktionen aktiv:
- **Kopfleiste im Dashboard:** Im Helfer-Panel (`/helfer`) erscheint oben eine Menüzeile mit direkten Links zu Schreiben, Logbuch, Freigaben und Website sowie der Button „Artikel“.
- **Befehl `/artikel`:** Registriert den Slash-Befehl `/artikel`, der regelmäßig `https://stevennoack.de/index.json` lädt und ein eigenes Panel mit aktuellen Artikeln öffnet.
- **Ohne Variable:** Bleibt die Leiste komplett ausgeblendet und `/artikel` inaktiv, sodass keine privaten Links in öffentlichen Umgebungen sichtbar sind.

## Lizenz

MIT License, Copyright (c) 2026 Steven Noack. Siehe [LICENSE](LICENSE).
