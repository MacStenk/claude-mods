export type Auftrag = {
  id: string
  wer: string
  ordner: string
  auftrag: string
  start: number
  ende: number | null
  rc: number | null
}

export type StandAuftrag = Auftrag & { tokens: number | null; runden: number | null; letzte_zeile: string }
export type Anbieter = { anbieter: string; schluessel: number; aktiv: number; ok: number; anfragen: number; tokens: number; sperren: number; ok_stunde: number; anfragen_stunde: number }
export type Fenster = { kind: string; percentUsed: number; resetsAt?: string }
export type WeicheWahl = { ziel: string; grund?: string } | null
export type FccStand = {
  laeuft: boolean
  modell: string
  bereit: string[]
  fehler: string[]
  eingerichtet: number
  modelle: number
  port?: number | string
}
export type Stand = {
  weiche?: { schreiben: WeicheWahl; bauen: WeicheWahl } | null
  jetzt: number
  kontingent: { agy: { gruppe: string; fenster: string; rest: number; reset: string | null }[] | null; codex: { fenster_prozent: number; fenster_reset: number; woche_prozent: number; woche_reset: number } | null }
  freellmapi: { anbieter: Anbieter[]; im_katalog: number | null } | null
  fcc?: FccStand | null
  auftraege: StandAuftrag[] | null
}

export type ArtikelEintrag = {
  slug: string
  title: string
  published_at: number | string
  type?: string
  summary?: string
  url?: string
}

declare module 'claude-code' {
  interface PluginState {
    'helfer-band': {
      auftraege: Auftrag[]
      jetzt: number
      stand: Stand | null
      claude: Fenster[]
      artikel: ArtikelEintrag[]
    }
  }
}
