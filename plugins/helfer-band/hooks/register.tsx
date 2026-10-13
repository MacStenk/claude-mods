import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ArtikelEintrag, Auftrag, FccStand, Fenster, Stand } from '../types'

const auftraege = atom({ plugin: 'helfer-band', key: 'auftraege' } as const, [] as Auftrag[])
const jetzt = atom({ plugin: 'helfer-band', key: 'jetzt' } as const, 0)
const stand = atom({ plugin: 'helfer-band', key: 'stand' } as const, null as Stand | null)
const claude = atom({ plugin: 'helfer-band', key: 'claude' } as const, [] as Fenster[])
const artikel = atom({ plugin: 'helfer-band', key: 'artikel' } as const, [] as ArtikelEintrag[])
const PANE = 'helfer-dashboard'
const ARTIKEL_PANE = 'helfer-artikel'

export function datumFormatiert(ts: number | string): string {
  const d = new Date(typeof ts === 'number' ? (ts > 1e11 ? ts : ts * 1000) : ts)
  if (isNaN(d.getTime())) return ''
  const tag = String(d.getDate()).padStart(2, '0')
  const monat = String(d.getMonth() + 1).padStart(2, '0')
  const jahr = d.getFullYear()
  return `${tag}.${monat}.${jahr}`
}

export function sortierteArtikel(entries: ArtikelEintrag[]): ArtikelEintrag[] {
  const zeit = (v: number | string | undefined): number => {
    if (typeof v === 'number') return v > 1e11 ? v : v * 1000
    if (typeof v === 'string') {
      const n = Number(v)
      if (!isNaN(n)) return n > 1e11 ? n : n * 1000
      const t = new Date(v).getTime()
      return isNaN(t) ? 0 : t
    }
    return 0
  }
  return [...entries].sort((a, b) => zeit(b.published_at) - zeit(a.published_at))
}

export function sichtbareArtikel(entries: ArtikelEintrag[], rows?: number): ArtikelEintrag[] {
  const room = Math.max(1, (rows ?? 24) - 4)
  return entries.slice(0, room)
}

const ZIEL_NAME: Record<string, string> = {
  'agy-sonnet': 'helfer auto → agy mit Claude Sonnet (Antigravity)',
  'agy-gemini': 'helfer auto → agy mit Gemini (Antigravity)',
  'claude-code': 'helfer auto → Claude Code (dein Abo)',
  codex: 'helfer auto → Codex (OpenAI-Abo)',
  keins: 'nichts frei, Aufträge warten',
}

export function wann(ziel: Date, jetzt: Date = new Date()): string {
  const hhmm = `${String(ziel.getHours()).padStart(2, '0')}:${String(ziel.getMinutes()).padStart(2, '0')}`
  const tag = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffTage = Math.round((tag(ziel) - tag(jetzt)) / 86400000)
  const min = Math.round((ziel.getTime() - jetzt.getTime()) / 60000)
  const abstand = min <= 0 ? '' : min < 60 ? ` (in ${min} Min.)` : min < 1440 ? ` (in ${Math.floor(min / 60)} Std. ${min % 60} Min.)` : ''
  if (diffTage === 0) return `heute ${hhmm}${abstand}`
  if (diffTage === 1) return `morgen ${hhmm}${abstand}`
  const wt = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'][ziel.getDay()]
  return `${wt} ${String(ziel.getDate()).padStart(2, '0')}.${String(ziel.getMonth() + 1).padStart(2, '0')}. ${hhmm}`
}

export function empfehlung(st: Stand, cl: Fenster[]): string[] {
  if (st.weiche && (st.weiche.schreiben || st.weiche.bauen)) {
    const z: string[] = []
    const n = (w: { ziel: string } | null | undefined) => (w ? ZIEL_NAME[w.ziel] ?? w.ziel : 'unbekannt')
    if (st.weiche.schreiben) z.push(`Schreiben: ${n(st.weiche.schreiben)}`)
    if (st.weiche.bauen) z.push(`Bauen: ${n(st.weiche.bauen)}`)
    z.push('Einzelfragen, Texte, Klassifizieren: FreeLLMAPI (127.0.0.1:31415)')
    const woche = cl.find(f => f.kind === 'seven_day')?.percentUsed ?? 0
    if (woche >= 80) z.push(`Claude sparen: Woche bei ${Math.round(woche)} %, nur planen und prüfen`)
    return z
  }
  const k = st.kontingent.codex
  const woche = cl.find(f => f.kind === 'seven_day')?.percentUsed ?? 0
  const z: string[] = []
  z.push(k && k.fenster_prozent >= 95 ? `Bauen: helfer adler (Codex frei ab ${uhr(k.fenster_reset)})` : 'Bauen: helfer codex')
  z.push('Einzelfragen, Texte, Klassifizieren: FreeLLMAPI (127.0.0.1:31415)')
  if (woche >= 80) z.push(`Claude sparen: Woche bei ${Math.round(woche)} %, nur planen und prüfen`)
  return z
}

export function zahl(n: number): string {
  return n.toLocaleString('de-DE')
}

export type FccZeile = {
  text: string
  farbe?: 'green' | 'red'
  dim?: boolean
}

export function fccZeilen(fcc: FccStand | null | undefined): FccZeile[] {
  if (!fcc) {
    return [{ text: 'nicht gestartet (App ‚Free Claude Code‘ oder `fcc-server`)', dim: true }]
  }
  const zeilen: FccZeile[] = []
  zeilen.push({ text: `${fcc.laeuft ? 'läuft' : 'gestoppt'}${fcc.modell ? ` · Modell ${fcc.modell}` : ''}` })
  if (fcc.bereit && fcc.bereit.length > 0) {
    zeilen.push({ text: `bereit: ${fcc.bereit.join(', ')}`, farbe: 'green' })
  }
  if (fcc.fehler && fcc.fehler.length > 0) {
    zeilen.push({ text: `Start fehlgeschlagen: ${fcc.fehler.join(', ')}`, farbe: 'red' })
  }
  zeilen.push({ text: `${fcc.eingerichtet} Anbieter eingerichtet, ${fcc.modelle} Modelle` })
  return zeilen
}

function uhr(ts: number): string {
  const d = new Date(ts * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function restText(alle: { wer: string; start: number; ende: number | null; rc: number | null }[], a: { wer: string; start: number }, nun: number): string {
  const fertig = alle.filter(x => x.wer === a.wer && x.ende !== null && x.rc === 0).map(x => (x.ende as number) - x.start)
  if (fertig.length === 0) return ''
  const ueblich = Math.round(fertig.reduce((s, d) => s + d, 0) / fertig.length)
  const bisher = nun - a.start
  return bisher < ueblich ? `, noch etwa ${dauer(ueblich - bisher)}` : `, länger als üblich (sonst ${dauer(ueblich)})`
}

export function balken(prozent: number, breite = 20): string {
  const voll = Math.max(0, Math.min(breite, Math.round((prozent / 100) * breite)))
  return '█'.repeat(voll) + '░'.repeat(breite - voll)
}

// Beendete Aufträge bleiben so lange sichtbar
const NACHLAUF_S = 30 * 60

export function auswerten(text: string, nun: number): Auftrag[] {
  const byId = new Map<string, Auftrag>()
  for (const zeile of text.split('\n')) {
    if (!zeile.trim()) continue
    let z: Record<string, unknown>
    try { z = JSON.parse(zeile) } catch { continue }
    const id = String(z.id ?? '')
    if (!id) continue
    if (typeof z.start === 'number') {
      byId.set(id, {
        id, wer: String(z.wer ?? '?'), ordner: String(z.ordner ?? ''), auftrag: String(z.auftrag ?? ''),
        start: z.start, ende: byId.get(id)?.ende ?? null, rc: byId.get(id)?.rc ?? null,
      })
    } else if (typeof z.ende === 'number') {
      const a = byId.get(id)
      if (a) { a.ende = z.ende; a.rc = typeof z.rc === 'number' ? z.rc : null }
    }
  }
  return [...byId.values()]
    .filter(a => a.ende === null ? nun - a.start < 24 * 3600 : nun - a.ende < NACHLAUF_S)
    .sort((a, b) => b.start - a.start)
}

export function dauer(s: number): string {
  const m = Math.floor(s / 60)
  if (m < 1) return `${s} s`
  return m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60} Min.` : `${m} Min.`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const home = (await $.env.get('HOME')) ?? ''
    const pfad = `${home}/.local/state/helfer/auftraege.jsonl`
    const laden = async () => {
      const nun = Math.floor((await $.clock.now()) / 1000)
      let text = ''
      try { text = await $.fs.read(pfad) } catch { text = '' }
      await update($, auftraege, () => auswerten(text, nun))
      await update($, jetzt, () => nun)
    }
    await laden()
    $.clock.every(5000, () => { void laden() })

    const statusLaden = async () => {
      try {
        let bin = `${home}/.local/bin/helfer-status`
        let hatLocal = false
        try {
          await $.fs.stat(bin)
          hatLocal = true
        } catch {
          hatLocal = false
        }
        if (!hatLocal) {
          const pluginRoot = (await $.env.get('CLAUDE_PLUGIN_ROOT')) ?? $.plugin.root ?? ''
          if (pluginRoot) {
            bin = `${pluginRoot}/bin/helfer-status`
          }
        }
        const r = await $.process.run([bin, '--json'])
        if (r.exitCode === 0) await update($, stand, () => JSON.parse(r.stdout) as Stand)
        const u = await $.session.usage()
        await update($, claude, () => u.rateLimits.map(f => ({ kind: f.kind, percentUsed: f.percentUsed, resetsAt: f.resetsAt })))
        // Für ki-weiche: Claude-Code-Kontingent als Datei (nur Prozentwerte)
        try { await $.fs.write(`${home}/.local/state/helfer/claude-kontingent.json`, JSON.stringify(u.rateLimits.map(f => ({ kind: f.kind, percentUsed: f.percentUsed, resetsAt: f.resetsAt })))) } catch { /* ohne Datei nimmt ki-weiche Claude Code nicht */ }
      } catch { /* nächster Versuch in 10 s */ }
    }
    void statusLaden()
    $.clock.every(10000, () => { void statusLaden() })

    const linksAktiv = Boolean(await $.env.get('HELFER_LINKS'))
    if (linksAktiv) {
      const artikelLaden = async () => {
        try {
          const r = await $.http.fetch('https://stevennoack.de/index.json')
          if (r.ok) {
            const daten = JSON.parse(r.text) as { entries?: ArtikelEintrag[] }
            if (Array.isArray(daten.entries)) {
              await update($, artikel, () => sortierteArtikel(daten.entries!))
            }
          }
        } catch {
          /* Fehler still abfangen */
        }
      }
      void artikelLaden()
      $.clock.every(10 * 60 * 1000, () => { void artikelLaden() })

      await $.command.register({ name: 'artikel', description: 'Steven Noacks Artikel (stevennoack.de)' })
    }

    await $.command.register({ name: 'helfer', description: 'Dashboard: Helfer-Aufträge, Codex-Kontingent, FreeLLMAPI' })
    return next(e)
  })

  on('command.run', { command: 'helfer' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Helfer' })
    return { text: 'Helfer-Dashboard geöffnet.' }
  })

  on('command.run', { command: 'artikel' }, async $ => {
    const linksAktiv = Boolean(await $.env.get('HELFER_LINKS'))
    if (!linksAktiv) {
      return { text: 'Artikel-Panel ist deaktiviert (HELFER_LINKS nicht gesetzt).' }
    }
    await $.ui.open({ id: ARTIKEL_PANE, title: 'Artikel' })
    return { text: 'Artikel-Panel geöffnet.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Link, Text } = $.ui.resolve(e)
    const st = await read($, stand)
    if (!st) return <Text dimColor>Lade helfer-status …</Text>
    const k = st.kontingent.codex
    const cl = await read($, claude)
    const farbe = (p: number) => (p >= 90 ? 'red' : p >= 70 ? 'yellow' : 'green')
    const name: Record<string, string> = { five_hour: '5-Std.-Fenster', seven_day: 'Woche         ' }
    const port = String(st.fcc?.port || (await $.env.get('FCC_PORT')) || '8082')
    const linksAktiv = Boolean(await $.env.get('HELFER_LINKS'))
    return (
      <Box flexDirection="column" gap={1}>
        {linksAktiv ? (
          <Box flexDirection="row" gap={2}>
            <Link href="https://stevennoack.de/schreiben/">Schreiben</Link>
            <Link href="https://stevennoack.de/logbuch/">Logbuch</Link>
            <Link href="https://stevennoack.de/freigabe/">Freigaben</Link>
            <Link href="https://stevennoack.de/">Website</Link>
            <Button
              key="pane-artikel"
              label="Artikel"
              onPress={async () => {
                await $.ui.open({ id: ARTIKEL_PANE, title: 'Artikel' })
              }}
            />
          </Box>
        ) : null}
        <Box flexDirection="column" borderStyle="round" paddingX={1}>
          <Text bold>Jetzt nehmen</Text>
          {empfehlung(st, cl).map(z => <Text key={z}>→ {z}</Text>)}
        </Box>
        <Box flexDirection="column" borderStyle="round" paddingX={1}>
          <Text bold>Claude (dieses Abo)</Text>
          {cl.length === 0 && <Text dimColor>noch keine Messung in dieser Sitzung</Text>}
          {cl.map(f => (
            <Text key={f.kind}>{name[f.kind] ?? f.kind} <Text color={farbe(f.percentUsed)}>{balken(f.percentUsed)}</Text> {Math.round(f.percentUsed)} %{f.resetsAt ? <Text dimColor>  wieder voll {wann(new Date(f.resetsAt))}</Text> : null}</Text>
          ))}
        </Box>
        <Box flexDirection="column" borderStyle="round" paddingX={1}>
          <Text bold>Codex-Abo (OpenAI)</Text>
          {k ? (
            <Box flexDirection="column">
              <Text>5-Std.-Fenster <Text color={farbe(k.fenster_prozent)}>{balken(k.fenster_prozent)}</Text> {Math.round(k.fenster_prozent)} %  <Text dimColor>frei {wann(new Date(k.fenster_reset * 1000))}</Text></Text>
              <Text>Woche         <Text color={farbe(k.woche_prozent)}>{balken(k.woche_prozent)}</Text> {Math.round(k.woche_prozent)} %</Text>
            </Box>
          ) : <Text dimColor>nicht eingerichtet</Text>}
        </Box>
        <Box flexDirection="column" borderStyle="round" paddingX={1}>
          <Text bold>Antigravity / agy (Google-Abo)</Text>
          {!st.kontingent.agy && <Text dimColor>nicht eingerichtet</Text>}
          {(st.kontingent.agy ?? []).map(g => {
            const benutzt = 100 - g.rest
            return (
              <Text key={g.gruppe + g.fenster}>{(g.gruppe.startsWith('Gemini') ? 'Gemini' : 'Claude/GPT').padEnd(11)}{g.fenster === '5h' ? '5 Std.' : 'Woche '} <Text color={farbe(benutzt)}>{balken(benutzt)}</Text> {Math.round(benutzt)} %{g.reset ? <Text dimColor>  wieder voll {wann(new Date(g.reset))}</Text> : null}</Text>
            )
          })}
        </Box>
        <Box flexDirection="column" borderStyle="round" paddingX={1}>
          <Text bold>FreeLLMAPI {st.freellmapi && st.freellmapi.anbieter.length > 0 ? <Text dimColor>({st.freellmapi.anbieter.length} von {st.freellmapi.im_katalog ?? '?'} Anbietern eingerichtet)</Text> : null}</Text>
          {(!st.freellmapi || st.freellmapi.anbieter.length === 0) && <Text dimColor>nicht eingerichtet</Text>}
          {(st.freellmapi?.anbieter ?? []).map(a => {
            const quote = a.anfragen_stunde ? Math.round((a.ok_stunde / a.anfragen_stunde) * 100) : 100
            return (
              <Text key={a.anbieter}>
                <Text color={a.aktiv ? 'green' : 'gray'}>{a.aktiv ? '●' : '○'}</Text> {a.anbieter.padEnd(16)} letzte Std. <Text color={farbe(100 - quote)}>{a.ok_stunde}/{a.anfragen_stunde} ok</Text>  <Text dimColor>heute {a.ok}/{a.anfragen}, {zahl(a.tokens)} Tokens{a.sperren ? `, ${a.sperren} gesperrt` : ''}</Text>
              </Text>
            )
          })}
        </Box>
        <Box flexDirection="column" borderStyle="round" paddingX={1}>
          <Box flexDirection="row" gap={2}>
            <Text bold>Free Claude Code (127.0.0.1:{port})</Text>
            <Link href={`http://127.0.0.1:${port}/admin`}>Admin</Link>
          </Box>
          {fccZeilen(st.fcc).map((z, idx) => (
            <Text key={String(idx)} color={z.farbe} dimColor={z.dim}>{z.text}</Text>
          ))}
        </Box>
        <Box flexDirection="column" borderStyle="round" paddingX={1}>
          <Text bold>Aufträge (24 Std.)</Text>
          {st.auftraege === null && <Text dimColor>nicht eingerichtet</Text>}
          {st.auftraege !== null && st.auftraege.length === 0 && <Text dimColor>keine</Text>}
          {(st.auftraege ?? []).slice(0, 8).map(a => {
            const ort = a.ordner.split('/').filter(Boolean).pop() ?? a.ordner
            const laeuft = a.ende === null
            const f = laeuft ? 'yellow' : a.rc === 0 ? 'green' : 'red'
            const z = laeuft ? `läuft ${dauer(st.jetzt - a.start)}${restText(st.auftraege ?? [], a, st.jetzt)}` : a.rc === 0 ? `fertig nach ${dauer((a.ende ?? st.jetzt) - a.start)}` : `Fehler ${a.rc}`
            return (
              <Box key={a.id} flexDirection="column">
                <Box flexDirection="row" gap={1}>
                  <Text><Text color={f}>{laeuft ? '⚙' : a.rc === 0 ? '✓' : '✗'} {a.wer}</Text> {ort} · {a.auftrag} · <Text color={f}>{z}</Text>{a.tokens ? <Text dimColor> · {zahl(a.tokens)} Tokens, {a.runden} Runden</Text> : null}</Text>
                  <Button
                    key={`bericht-${a.id}`}
                    label="Bericht öffnen"
                    onPress={async () => {
                      const pfad = `${a.ordner}/ERGEBNIS.md`
                      try {
                        await $.fs.stat(pfad)
                        await $.process.run(['open', '-a', 'TextEdit', pfad])
                      } catch {
                        $.ui.toast(`Kein Bericht in ${a.ordner}`)
                      }
                    }}
                  />
                </Box>
                {a.letzte_zeile ? <Text dimColor>   {a.letzte_zeile.slice(0, 110)}</Text> : null}
              </Box>
            )
          })}
        </Box>
        <Text dimColor>aktualisiert {uhr(st.jetzt)} · Esc schließt</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: ARTIKEL_PANE }, async ($, e) => {
    const { Box, Link, Text } = $.ui.resolve(e)
    const alle = await read($, artikel)
    const sichtbar = sichtbareArtikel(alle, e.viewport?.rows)
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column" borderStyle="round" paddingX={1}>
          <Text bold>Artikel ({alle.length})</Text>
          {alle.length === 0 && <Text dimColor>Lade Artikel von stevennoack.de …</Text>}
          {sichtbar.map(a => (
            <Text key={a.slug}>
              <Text dimColor>{datumFormatiert(a.published_at)}</Text>{' '}
              <Link href={`https://stevennoack.de/artikel/${a.slug}/`} label={a.title}>
                {a.title}
              </Link>
            </Text>
          ))}
        </Box>
        <Text dimColor>Esc schließt</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const liste = await read($, auftraege)
    if (liste.length === 0) return next(e)
    const nun = await read($, jetzt)
    const standJetzt = await read($, stand)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {liste.slice(0, 5).map(a => {
          const ort = a.ordner.split('/').filter(Boolean).pop() ?? a.ordner
          const laeuft = a.ende === null
          const ok = a.rc === 0
          const zeichen = laeuft ? '⚙' : ok ? '✓' : '✗'
          const farbe = laeuft ? 'yellow' : ok ? 'green' : 'red'
          const zustand = laeuft ? `läuft ${dauer(nun - a.start)}${restText(standJetzt?.auftraege ?? liste, a, nun)}` : ok ? `fertig nach ${dauer((a.ende ?? nun) - a.start)}` : `Fehler ${a.rc} nach ${dauer((a.ende ?? nun) - a.start)}`
          return (
            <Text key={a.id}>
              <Text color={farbe}>{zeichen} {a.wer}</Text>
              <Text dimColor> {ort} · {a.auftrag} · </Text>
              <Text color={farbe}>{zustand}</Text>
            </Text>
          )
        })}
      </Box>
    )
  })
}
