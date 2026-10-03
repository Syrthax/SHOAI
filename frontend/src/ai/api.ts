import type { Plan, TimelineSummary } from './schema'

export async function fetchPlan(body: {
  request: string
  timeline: TimelineSummary
  previousPlan?: Plan | null
  validationErrors?: string[]
}): Promise<{ plan: Plan; repairs: number }> {
  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.detail ?? `Request failed (${res.status})`)
  }
  return res.json()
}
