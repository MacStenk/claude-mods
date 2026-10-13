import { test, expect } from 'claude-code/testing'
import { auswerten, datumFormatiert, dauer, empfehlung, fccZeilen, restText, sichtbareArtikel, wann, sortierteArtikel } from './register'

test('Start- und Endzeilen werden zusammengeführt', () => {
  const text = [
    '{"id":"a","wer":"codex","ordner":"/x/datenraum","auftrag":"A.md","pid":1,"start":1000}',
    '{"id":"b","wer":"adler","ordner":"/x/befehle","auftrag":"B.md","pid":2,"start":1100}',
    '{"id":"a","ende":1300,"rc":0}',
    'kaputt',
  ].join('\n')
  const l = auswerten(text, 1400)
  expect(l.length).toBe(2)
  expect(l[0]?.id).toBe('b')
  expect(l[0]?.ende).toBe(null)
  expect(l[1]?.rc).toBe(0)
})

test('alte beendete Aufträge fallen weg', () => {
  const text = '{"id":"a","wer":"codex","ordner":"/x","auftrag":"A.md","pid":1,"start":0}\n{"id":"a","ende":10,"rc":1}'
  expect(auswerten(text, 10 + 31 * 60).length).toBe(0)
})

test('dauer', () => {
  expect(dauer(65)).toBe('1 Min.')
  expect(dauer(3720)).toBe('1 Std. 2 Min.')
  expect(dauer(40)).toBe('40 s')
})

test('Empfehlung schaltet bei vollem Codex-Fenster auf den Adler', () => {
  const st = { jetzt: 0, freellmapi: null, auftraege: [], kontingent: { agy: null, codex: { fenster_prozent: 98, fenster_reset: 0, woche_prozent: 31, woche_reset: 0 } } }
  const z = empfehlung(st, [{ kind: 'seven_day', percentUsed: 85 }])
  expect(z[0]?.startsWith('Bauen: helfer adler')).toBe(true)
  expect(z.some(x => x.startsWith('Claude sparen'))).toBe(true)
  const frei = empfehlung({ ...st, kontingent: { agy: null, codex: { ...st.kontingent.codex, fenster_prozent: 40 } } }, [])
  expect(frei[0]).toBe('Bauen: helfer codex')
})

test('datumFormatiert formatiert Timestamps und Strings als TT.MM.JJJJ', () => {
  expect(datumFormatiert(1791891909)).toBe('13.10.2026')
  expect(datumFormatiert(1791891909000)).toBe('13.10.2026')
  expect(datumFormatiert('2026-05-04T12:00:00Z')).toBe('04.05.2026')
  expect(datumFormatiert('ungueltig')).toBe('')
})

test('sortierteArtikel sortiert absteigend nach published_at', () => {
  const liste = [
    { slug: 'alt', title: 'Alt', published_at: 1000 },
    { slug: 'neu', title: 'Neu', published_at: 3000 },
    { slug: 'mittel', title: 'Mittel', published_at: 2000 },
  ]
  const s = sortierteArtikel(liste)
  expect(s.map(x => x.slug)).toEqual(['neu', 'mittel', 'alt'])
})

test('sichtbareArtikel beschränkt Zeilen auf Raum des Viewports', () => {
  const viele = Array.from({ length: 30 }, (_, i) => ({
    slug: `art-${i}`,
    title: `Artikel ${i}`,
    published_at: 1000 + i,
  }))
  expect(sichtbareArtikel(viele, 24).length).toBe(20)
  expect(sichtbareArtikel(viele, 10).length).toBe(6)
  expect(sichtbareArtikel(viele, 4).length).toBe(1)
  expect(sichtbareArtikel(viele).length).toBe(20)
})

test('Restzeit aus fertigen Läufen desselben Helfers', () => {
  const alle = [
    { wer: 'adler', start: 0, ende: 600, rc: 0 },
    { wer: 'adler', start: 0, ende: 1200, rc: 0 },
    { wer: 'codex', start: 0, ende: 60, rc: 0 },
  ]
  expect(restText(alle, { wer: 'adler', start: 1000 }, 1300)).toBe(', noch etwa 10 Min.')
  expect(restText(alle, { wer: 'adler', start: 0 }, 2000)).toBe(', länger als üblich (sonst 15 Min.)')
  expect(restText(alle, { wer: 'zenmux', start: 0 }, 10)).toBe('')
})

test('wann: heute, morgen und Datum mit Abstand', () => {
  const jetzt = new Date(2026, 9, 13, 18, 0)
  expect(wann(new Date(2026, 9, 13, 18, 10), jetzt)).toBe('heute 18:10 (in 10 Min.)')
  expect(wann(new Date(2026, 9, 14, 21, 0), jetzt)).toBe('morgen 21:00')
  expect(wann(new Date(2026, 9, 14, 9, 30), jetzt)).toBe('morgen 09:30 (in 15 Std. 30 Min.)')
  expect(wann(new Date(2026, 9, 19, 13, 23), jetzt)).toBe('Mo. 19.10. 13:23')
})

test('Free Claude Code Zeilen aus beispiel-status', () => {
  const fcc = {
    laeuft: true,
    modell: 'nvidia_nim/nvidia/nemotron-3-super-120b-a12b',
    bereit: ['zenmux', 'ollama_cloud', 'openai'],
    fehler: ['nvidia_nim', 'gemini'],
    eingerichtet: 6,
    modelle: 193,
  }
  const z = fccZeilen(fcc)
  expect(z.length).toBe(4)
  expect(z[0]?.text).toBe('läuft · Modell nvidia_nim/nvidia/nemotron-3-super-120b-a12b')
  expect(z[1]?.text).toBe('bereit: zenmux, ollama_cloud, openai')
  expect(z[1]?.farbe).toBe('green')
  expect(z[2]?.text).toBe('Start fehlgeschlagen: nvidia_nim, gemini')
  expect(z[2]?.farbe).toBe('red')
  expect(z[3]?.text).toBe('6 Anbieter eingerichtet, 193 Modelle')
})

test('Free Claude Code wenn fcc null (nicht gestartet)', () => {
  const z = fccZeilen(null)
  expect(z.length).toBe(1)
  expect(z[0]?.text).toBe('nicht gestartet (App ‚Free Claude Code‘ oder `fcc-server`)')
  expect(z[0]?.dim).toBe(true)
})
