/**
 * Météo via Open-Meteo (gratuit, sans clé). Couvre l'historique (archive) et
 * les prévisions. On récupère la météo journalière (code + T° min/max) pour un
 * mois et des coordonnées données, à superposer sur le calendrier de saisie.
 */

export interface DayWeather {
  code: number
  tMin: number | null
  tMax: number | null
}

/** Météo par date ISO (YYYY-MM-DD) pour le mois demandé. */
export type MonthWeather = Record<string, DayWeather>

function iso(year: number, monthZeroBased: number, day: number): string {
  return `${year}-${String(monthZeroBased + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function toIso(d: Date): string {
  return iso(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

/**
 * Récupère la météo d'un mois pour une position. Choisit l'API « archive »
 * pour un mois entièrement passé, sinon l'API « forecast » (qui couvre les
 * jours récents + les prévisions à venir).
 */
export async function getMonthWeather(
  latitude: number,
  longitude: number,
  year: number,
  monthZeroBased: number,
): Promise<MonthWeather> {
  const lastDay = new Date(year, monthZeroBased + 1, 0).getDate()
  const monthStart = new Date(year, monthZeroBased, 1)
  const monthEnd = new Date(year, monthZeroBased, lastDay)

  const today = new Date()
  const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const isPastMonth = monthEnd < firstOfCurrentMonth

  // Chaque API n'accepte qu'une fenêtre limitée : l'« archive » s'arrête quelques
  // jours avant aujourd'hui, et le « forecast » va d'environ -90j à +15j. On borne
  // la plage demandée à cette fenêtre (sinon Open-Meteo renvoie une erreur 400 et
  // toute la météo du mois disparaît). Les jours hors fenêtre n'auront pas de météo.
  let rangeStart = monthStart
  let rangeEnd = monthEnd
  let base: string
  if (isPastMonth) {
    base = 'https://archive-api.open-meteo.com/v1/archive'
    const archiveMax = addDays(today, -5)
    if (rangeEnd > archiveMax) rangeEnd = archiveMax
  } else {
    base = 'https://api.open-meteo.com/v1/forecast'
    const forecastMin = addDays(today, -90)
    const forecastMax = addDays(today, 15)
    if (rangeStart < forecastMin) rangeStart = forecastMin
    if (rangeEnd > forecastMax) rangeEnd = forecastMax
  }

  // Rien d'exploitable (mois entièrement hors fenêtre, ex. loin dans le futur).
  if (rangeStart > rangeEnd) return {}

  const url =
    `${base}?latitude=${latitude}&longitude=${longitude}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&start_date=${toIso(rangeStart)}&end_date=${toIso(rangeEnd)}`

  const res = await fetch(url)
  if (!res.ok) throw new Error('Météo indisponible')
  const json = (await res.json()) as {
    daily?: {
      time: string[]
      weather_code: number[]
      temperature_2m_max: (number | null)[]
      temperature_2m_min: (number | null)[]
    }
  }

  const out: MonthWeather = {}
  const d = json.daily
  if (d) {
    d.time.forEach((date, i) => {
      out[date] = {
        code: d.weather_code[i],
        tMax: d.temperature_2m_max[i],
        tMin: d.temperature_2m_min[i],
      }
    })
  }
  return out
}

/**
 * Météo journalière pour une plage de dates arbitraire (utilisée pour comparer
 * avec l'an dernier : AR-1 / AA-1). Les dates demandées étant passées, on
 * interroge l'API « archive » (historique réel). Renvoie un map par date ISO.
 */
export async function getWeatherRange(
  latitude: number,
  longitude: number,
  startIso: string,
  endIso: string,
): Promise<MonthWeather> {
  // L'archive s'arrête ~5 j avant aujourd'hui : on borne la fin si besoin.
  const archiveMax = toIso(addDays(new Date(), -5))
  const end = endIso > archiveMax ? archiveMax : endIso
  if (startIso > end) return {}

  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&start_date=${startIso}&end_date=${end}`

  const res = await fetch(url)
  if (!res.ok) throw new Error('Météo indisponible')
  const json = (await res.json()) as {
    daily?: {
      time: string[]
      weather_code: number[]
      temperature_2m_max: (number | null)[]
      temperature_2m_min: (number | null)[]
    }
  }
  const out: MonthWeather = {}
  const d = json.daily
  if (d) {
    d.time.forEach((date, i) => {
      out[date] = { code: d.weather_code[i], tMax: d.temperature_2m_max[i], tMin: d.temperature_2m_min[i] }
    })
  }
  return out
}

/** Emoji + libellé pour un code météo WMO (Open-Meteo). */
export function weatherIcon(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: 'Ciel dégagé' }
  if (code <= 2) return { emoji: '🌤️', label: 'Peu nuageux' }
  if (code === 3) return { emoji: '☁️', label: 'Couvert' }
  if (code <= 48) return { emoji: '🌫️', label: 'Brouillard' }
  if (code <= 57) return { emoji: '🌦️', label: 'Bruine' }
  if (code <= 67) return { emoji: '🌧️', label: 'Pluie' }
  if (code <= 77) return { emoji: '🌨️', label: 'Neige' }
  if (code <= 82) return { emoji: '🌦️', label: 'Averses' }
  if (code <= 86) return { emoji: '🌨️', label: 'Averses de neige' }
  return { emoji: '⛈️', label: 'Orage' }
}

/** Météo d'une heure précise. */
export interface HourWeather {
  hour: number // 0..23
  temp: number | null
  code: number
  precipProb: number | null // probabilité de précipitation (%) — absente sur l'archive
}

/** Détail horaire d'UNE journée (archive si passée, sinon prévision). */
export async function getHourlyWeather(
  latitude: number,
  longitude: number,
  dateIso: string,
): Promise<HourWeather[]> {
  const today = new Date()
  const day = new Date(dateIso + 'T00:00:00')
  const isPast = day < addDays(today, -5)
  const base = isPast
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast'
  const url =
    `${base}?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&timezone=auto&start_date=${dateIso}&end_date=${dateIso}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Météo horaire indisponible')
  const json = (await res.json()) as {
    hourly?: {
      time: string[]
      temperature_2m: (number | null)[]
      weather_code: number[]
      precipitation_probability?: (number | null)[]
    }
  }
  const h = json.hourly
  if (!h) return []
  return h.time.map((t, i) => ({
    hour: Number(t.slice(11, 13)),
    temp: h.temperature_2m[i],
    code: h.weather_code[i],
    precipProb: h.precipitation_probability?.[i] ?? null,
  }))
}

/** Résumé compact par tranches (matin/midi/après-midi/soir) pour le prompt IA. */
export function summarizeHourly(hours: HourWeather[]): string {
  if (hours.length === 0) return ''
  const slots = [
    { label: 'matin (6-11h)', from: 6, to: 11 },
    { label: 'midi (11-14h)', from: 11, to: 14 },
    { label: 'après-midi (14-18h)', from: 14, to: 18 },
    { label: 'soir (18-22h)', from: 18, to: 22 },
  ]
  const parts: string[] = []
  for (const s of slots) {
    const hs = hours.filter((h) => h.hour >= s.from && h.hour < s.to)
    if (hs.length === 0) continue
    // Condition « dominante » = code le plus défavorable (pluie/orage prioritaire).
    const worst = hs.reduce((a, b) => (b.code > a.code ? b : a), hs[0])
    const temps = hs.map((h) => h.temp).filter((t): t is number => t != null)
    const avg = temps.length ? Math.round(temps.reduce((x, y) => x + y, 0) / temps.length) : null
    const precip = hs.map((h) => h.precipProb).filter((p): p is number => p != null)
    const maxPrecip = precip.length ? Math.max(...precip) : null
    const cond = weatherIcon(worst.code).label.toLowerCase()
    parts.push(
      `${s.label} : ${cond}${avg != null ? ` ~${avg}°` : ''}` +
        (maxPrecip != null && maxPrecip >= 30 ? ` (pluie ${maxPrecip}%)` : ''),
    )
  }
  return parts.join(' ; ')
}
