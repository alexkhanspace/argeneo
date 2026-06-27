/**
 * Fêtes & « marronniers » qui font bouger le CA d'une boulangerie (galette,
 * crêpes, Saint-Nicolas, fête des mères…). Liste curée, calculée localement
 * (aucune API) : dates fixes + dates mobiles dérivées de Pâques. Map iso -> nom.
 */

export type Observances = Record<string, string>

const cache = new Map<number, Observances>()

function iso(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Dimanche de Pâques (algorithme de Meeus/Butcher, calendrier grégorien). */
function easter(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3=mars, 4=avril
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, n: number): Date {
  const r = new Date(date)
  r.setDate(r.getDate() + n)
  return r
}

/** n-ième `weekday` (0=dim..6=sam) du mois m0 (0-based). */
function nthWeekday(year: number, m0: number, weekday: number, n: number): Date {
  const first = new Date(year, m0, 1)
  const offset = (weekday - first.getDay() + 7) % 7
  return new Date(year, m0, 1 + offset + (n - 1) * 7)
}

/** Dernier `weekday` du mois m0. */
function lastWeekday(year: number, m0: number, weekday: number): Date {
  const last = new Date(year, m0 + 1, 0)
  const offset = (last.getDay() - weekday + 7) % 7
  return new Date(year, m0, last.getDate() - offset)
}

function toIso(d: Date): string {
  return iso(d.getFullYear(), d.getMonth(), d.getDate())
}

export function getCuratedEvents(year: number): Observances {
  const cached = cache.get(year)
  if (cached) return cached

  const o: Observances = {}
  // Cumule plusieurs événements le même jour (ex. Fête de la Musique + Fête des
  // pères le 21 juin 2026) au lieu d'écraser.
  const add = (key: string, label: string) => {
    o[key] = o[key] ? `${o[key]} · ${label}` : label
  }

  // --- Dates fixes ---
  add(iso(year, 0, 6), '👑 Épiphanie (galette des rois)')
  add(iso(year, 1, 2), '🥞 Chandeleur')
  add(iso(year, 1, 14), '❤️ Saint-Valentin')
  add(iso(year, 5, 21), '🎵 Fête de la Musique')
  add(iso(year, 6, 14), '🎆 Fête nationale')
  add(iso(year, 8, 1), '🍂 Rentrée')
  add(iso(year, 9, 31), '🎃 Halloween')
  add(iso(year, 11, 6), '🎅 Saint-Nicolas')
  add(iso(year, 11, 24), '🎄 Réveillon de Noël')
  add(iso(year, 11, 25), '🎄 Noël')
  add(iso(year, 11, 31), '🥂 Saint-Sylvestre')

  // --- Dates mobiles ---
  const pa = easter(year)
  add(toIso(addDays(pa, -47)), '🍩 Mardi Gras (beignets)')
  add(toIso(pa), '🐑 Pâques')
  // Fête des mères : dernier dimanche de mai (1er dim. de juin si = Pentecôte).
  const pentecote = addDays(pa, 49)
  let meres = lastWeekday(year, 4, 0)
  if (toIso(meres) === toIso(pentecote)) meres = nthWeekday(year, 5, 0, 1)
  add(toIso(meres), '💐 Fête des mères')
  add(toIso(nthWeekday(year, 5, 0, 3)), '👔 Fête des pères')
  // Beaujolais nouveau : 3e jeudi de novembre.
  add(toIso(nthWeekday(year, 10, 4, 3)), '🍷 Beaujolais nouveau')

  cache.set(year, o)
  return o
}
