// The AI export as an Excel workbook: one sheet per kind of record, one row per set, run, food entry,
// activity or weigh-in, so an AI (or the owner) can sort, filter and total it. Headers are English,
// names are kept as logged, and photos are never included.

import { db } from '../db/db'
import { activitySec } from '../db/activities'
import type { RunLog } from '../db/types'
import type { AIExportOptions } from './backup'
import { formatDuration } from './numbers'
import { paceSecPerKm } from './running'
import { formatPace, round } from './units'
import { xlsxBlob, type Cell, type Sheet } from './xlsx'

const hms = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const SURFACE: Record<string, string> = { treadmill: 'Treadmill', outdoor: 'Outdoor' }
const RUN_TYPE: Record<string, string> = { easy: 'Easy', lsd: 'LSD', tempo: 'Tempo', interval: 'Interval' }

/** "6 × 400 m @ 4:30, rest 90 s | 1:50, 1:48, ..." for an interval run; empty otherwise. */
function intervalsText(r: RunLog): string {
  const p = r.plan
  if (!p || !p.reps) return ''
  const per = p.distanceM ? `${p.distanceM} m` : p.durationSec ? formatDuration(p.durationSec) : '?'
  const plan = `${p.reps} × ${per}${p.targetPaceSecPerKm ? ` @ ${formatPace(p.targetPaceSecPerKm)}/km` : ''}${p.restSec ? `, rest ${p.restSec} s` : ''}`
  const reps = (r.repResults ?? [])
    .map((x) => (p.durationSec ? (x.distanceM ? `${x.distanceM} m` : '—') : (x.durationSec ? formatDuration(x.durationSec) : '—')) +
      (x.paceSecPerKm ? ` (${formatPace(x.paceSecPerKm)}/km)` : ''))
    .join(', ')
  return reps ? `${plan} | ${reps}` : plan
}

export async function aiExportSheets({ from, to, categories }: AIExportOptions): Promise<Sheet[]> {
  const sheets: Sheet[] = []
  const inRange = <T extends { date: string }>(rows: T[]) => rows.filter((r) => r.date >= from && r.date <= to)
  const settings = await db.settings.get('app')

  if (categories.has('weights')) {
    const sessions = (await db.sessions.where('date').between(from, to, true, true).filter((s) => s.finishedAt != null).toArray())
      .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt || a.id! - b.id!)
    const ses = await db.sessionExercises.where('sessionId').anyOf(sessions.map((s) => s.id!)).toArray()
    const [sets, exercises] = await Promise.all([
      db.sets.where('sessionExerciseId').anyOf(ses.map((x) => x.id!)).toArray(),
      db.exercises.toArray()
    ])
    const exMap = new Map(exercises.map((e) => [e.id!, e]))
    const rows: Cell[][] = []
    for (const s of sessions) {
      const list = ses.filter((x) => x.sessionId === s.id).sort((a, b) => a.order - b.order || a.id! - b.id!)
      list.forEach((se, i) => {
        const ex = exMap.get(se.exerciseId)
        const target = se.targetSets && se.repMax ? `${se.targetSets} × ${se.repMin}–${se.repMax}${se.timed ? ' s' : ''}` : ''
        let working = 0
        sets.filter((x) => x.sessionExerciseId === se.id)
          .sort((a, b) => a.setNumber - b.setNumber || a.id! - b.id!)
          .forEach((set) => {
            const label = set.type === 'working' ? String(++working) : 'W'
            rows.push([
              s.date, s.dayName ?? '', i + 1, se.name, se.equipment, ex?.primaryMuscles.join(', ') ?? '',
              label, set.type === 'working' ? 'Working' : 'Warm-up',
              set.weightKg, set.reps, set.repsLeft, set.repsRight,
              set.durationSec ?? (set.durationLeftSec !== undefined || set.durationRightSec !== undefined
                ? Math.min(set.durationLeftSec ?? Infinity, set.durationRightSec ?? Infinity) : undefined),
              set.toFailure ? 'Yes' : 'No', set.goodForm ? 'Yes' : 'No', target, se.note ?? ''
            ])
          })
      })
    }
    sheets.push({
      name: 'Weights',
      header: ['Date', 'Session', 'Exercise #', 'Exercise', 'Equipment', 'Primary muscles', 'Set', 'Set type',
        'Weight (kg)', 'Reps', 'Reps left', 'Reps right', 'Time (s)', 'To failure', 'Good form', 'Target (sets × reps)', 'Note'],
      widths: [11, 14, 10, 28, 11, 22, 5, 9, 11, 6, 9, 10, 9, 10, 10, 18, 24],
      rows
    })
  }

  if (categories.has('running')) {
    const [runs, shoes] = await Promise.all([db.runs.where('date').between(from, to, true, true).toArray(), db.shoes.toArray()])
    const shoeName = new Map(shoes.map((s) => [s.id!, s.name]))
    runs.sort((a, b) => a.date.localeCompare(b.date) || a.id! - b.id!)
    sheets.push({
      name: 'Running',
      header: ['Date', 'Type', 'Distance (km)', 'Duration', 'Duration (min)', 'Pace (min/km)', 'Avg HR (bpm)', 'Max HR (bpm)',
        'Treadmill or outdoor', 'Shoe', 'Intervals', 'Note'],
      widths: [11, 9, 13, 10, 14, 13, 12, 12, 19, 16, 40, 24],
      rows: runs.map((r) => {
        const pace = paceSecPerKm(r.distanceKm, r.durationSec)
        return [
          r.date, r.type ? RUN_TYPE[r.type] : '', round(r.distanceKm, 2), hms(r.durationSec), round(r.durationSec / 60, 1),
          pace ? formatPace(pace) : '', r.avgHr, r.maxHr, r.surface ? SURFACE[r.surface] : '',
          r.shoeId ? shoeName.get(r.shoeId) ?? '' : '', intervalsText(r), r.note ?? ''
        ]
      })
    })
  }

  if (categories.has('activities')) {
    const acts = inRange(await db.activities.where('date').between(from, to, true, true).toArray())
      .sort((a, b) => a.date.localeCompare(b.date) || a.id! - b.id!)
    sheets.push({
      name: 'Other activities',
      header: ['Date', 'Activity', 'Duration', 'Duration (min)', 'Effort (1–10)', 'Note'],
      widths: [11, 22, 10, 14, 13, 30],
      rows: acts.map((a) => [a.date, a.sport, hms(activitySec(a)), round(activitySec(a) / 60, 1), a.effort, a.note ?? ''])
    })
  }

  if (categories.has('food')) {
    const entries = (await db.foodEntries.where('date').between(from, to, true, true).toArray())
      .sort((a, b) => a.date.localeCompare(b.date) || a.time - b.time || a.id! - b.id!)
    sheets.push({
      name: 'Food',
      header: ['Date', 'Time', 'Food', 'Portion', 'kcal', 'Protein (g)'],
      widths: [11, 7, 30, 8, 8, 11],
      rows: entries.map((e) => [e.date, hhmm(e.time), e.name, e.portion, round(e.kcal, 1), round(e.proteinG, 1)])
    })
    const byDay = new Map<string, { kcal: number; protein: number; n: number }>()
    for (const e of entries) {
      const d = byDay.get(e.date) ?? { kcal: 0, protein: 0, n: 0 }
      d.kcal += e.kcal; d.protein += e.proteinG; d.n++
      byDay.set(e.date, d)
    }
    const g = settings?.goals ?? {}
    sheets.push({
      name: 'Food per day',
      header: ['Date', 'kcal', 'Protein (g)', 'Entries', 'kcal goal (min)', 'kcal goal (max)', 'Protein goal (g)'],
      widths: [11, 8, 11, 8, 15, 15, 16],
      rows: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => [date, round(d.kcal, 1), round(d.protein, 1), d.n, g.kcal, g.kcalMax, g.proteinG])
    })
  }

  if (categories.has('body')) {
    const entries = await db.bodyEntries.where('date').between(from, to, true, true).sortBy('date')
    sheets.push({ name: 'Body weight', header: ['Date', 'Weight (kg)'], widths: [11, 12], rows: entries.map((e) => [e.date, round(e.weightKg, 2)]) })
  }

  sheets.unshift({
    name: 'About',
    header: ['Item', 'Value'],
    widths: [24, 70],
    rows: [
      ['App', 'Gymboy'],
      ['Exported at', new Date().toLocaleString('en-GB')],
      ['Period', `${from} to ${to}`],
      ['Dates', 'Local dates, YYYY-MM-DD; weeks start on Monday'],
      ['Weights', 'kg. One row per set. Set "W" is a warm-up; working sets are numbered 1, 2, 3. Only finished sessions.'],
      ['Weight on bodyweight exercises', 'Added load only (empty means bodyweight)'],
      ['Good form', 'Ticked by the lifter when the set was done with good form'],
      ['To failure', 'The set ended because another rep was not possible'],
      ['Running', 'Distance in km, pace in min:sec per km, heart rate in bpm'],
      ['Food', 'One row per entry; kcal and protein already multiplied by the portion'],
      ['Bar weight', 'Barbell and Smith machine weights may not include the bar itself']
    ]
  })
  return sheets
}

export async function createAIExcel(opts: AIExportOptions): Promise<Blob> {
  return xlsxBlob(await aiExportSheets(opts))
}

export const aiExcelFilename = (from: string, to: string) => `gymboy-export-${from}-${to}.xlsx`
