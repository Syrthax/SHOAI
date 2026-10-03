import { useRef, useState } from 'react'
import { useTimelineEngine } from '@elah/editor'
import { fetchPlan } from '../ai/api'
import { summarizeTimeline } from '../ai/timelineSummary'
import { validatePlan } from '../ai/validate'
import type { Plan } from '../ai/schema'
import { applyOps } from './applyPlan'
import { FPS } from '../config'

export type Msg = { role: 'user' | 'ai' | 'err'; text: string }

export function useAiSession() {
  const engine = useTimelineEngine() as any
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [enabled, setEnabled] = useState<boolean[]>([])
  const [busy, setBusy] = useState(false)
  const [repairs, setRepairs] = useState(0)
  const applied = useRef(false) // is a preview currently applied?

  const log = (m: Msg) => setMsgs((x) => [...x, m])

  // Remove the current preview with ONE undo.
  const clearPreview = () => {
    if (applied.current) { engine.undo(); applied.current = false }
  }

  const showPreview = (p: Plan, en: boolean[]) => {
    clearPreview()
    const ops = p.ops.filter((_, i) => en[i])
    if (!ops.length) return
    applyOps(engine, ops, FPS, p.summary)
    applied.current = true
  }

  async function submit(text: string, refine = false) {
    const previous = refine ? plan : null
    clearPreview()           // always plan against the ORIGINAL timeline
    setPlan(null)
    setBusy(true)
    log({ role: 'user', text })
    try {
      const tl = summarizeTimeline(FPS)
      let res = await fetchPlan({ request: text, timeline: tl, previousPlan: previous })
      let p = res.plan
      let rep = res.repairs
      const errs = p.unsupportedReason ? [] : validatePlan(p, tl)
      if (errs.length) { // semantic auto-repair, once
        res = await fetchPlan({ request: text, timeline: tl, previousPlan: p, validationErrors: errs })
        p = res.plan
        rep += 1 + res.repairs
        const again = p.unsupportedReason ? [] : validatePlan(p, tl)
        if (again.length) throw new Error('Plan still invalid after repair:\n' + again.join('\n'))
      }
      setRepairs(rep)
      setPlan(p)
      if (p.unsupportedReason) {
        log({ role: 'ai', text: `I can't do that: ${p.unsupportedReason}` })
        return
      }
      const en = p.ops.map(() => true)
      setEnabled(en)
      showPreview(p, en)
      log({ role: 'ai', text: p.summary })
    } catch (e: any) {
      log({ role: 'err', text: e.message ?? String(e) })
    } finally {
      setBusy(false)
    }
  }

  const toggleOp = (i: number) => {
    if (!plan) return
    const en = enabled.map((v, j) => (j === i ? !v : v))
    setEnabled(en)
    showPreview(plan, en)
  }

  const keep = () => { applied.current = false; setPlan(null); log({ role: 'ai', text: 'Kept. Use Undo (Ctrl+Z) to revert the whole AI edit.' }) }
  const discard = () => { clearPreview(); setPlan(null); log({ role: 'ai', text: 'Discarded - timeline restored.' }) }

  return { msgs, plan, enabled, busy, repairs, submit, toggleOp, keep, discard }
}
