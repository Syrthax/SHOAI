import { useRef, useState } from 'react'
import { useTimelineEngine } from '@elah/editor'
import { fetchPlan } from '../ai/api'
import { summarizeTimeline } from '../ai/timelineSummary'
import { validatePlan } from '../ai/validate'
import type { Plan } from '../ai/schema'
import { applyOps } from './applyPlan'
import { FPS } from '../config'
import { setAiPreviewActive } from './aiPreview'

export type Msg = { role: 'user' | 'ai' | 'err'; text: string }

export function useAiSession() {
  const engine = useTimelineEngine() as any
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [enabled, setEnabled] = useState<boolean[]>([])
  const [busy, setBusy] = useState(false)
  const [repairs, setRepairs] = useState(0)
  // The project object right after the preview was applied. Undo only if the timeline is still
  // exactly that, so a manual Ctrl+Z (or other edit) during preview can't make us undo the wrong step.
  const previewProject = useRef<unknown>(null)

  const log = (m: Msg) => setMsgs((x) => [...x, m])

  // Remove the current preview with ONE undo.
  const clearPreview = () => {
    if (previewProject.current && engine.getProject() === previewProject.current) engine.undo()
    previewProject.current = null
    setAiPreviewActive(false)
  }

  const showPreview = (p: Plan, en: boolean[]) => {
    clearPreview()
    const ops = p.ops.filter((_, i) => en[i])
    if (!ops.length) return
    applyOps(engine, ops, FPS, p.summary)
    previewProject.current = engine.getProject()
    setAiPreviewActive(true)
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
      for (const r of res.rejected ?? []) log({ role: 'err', text: `Skipped invalid ${String(r.op.op)}: ${r.reason}` })
      if (p.unsupportedReason) {
        setPlan(p)
        log({ role: 'ai', text: `I can't do that: ${p.unsupportedReason}` })
        return
      }
      if (!p.ops.length) {
        log({ role: 'ai', text: 'No valid edits to make for that request.' })
        return
      }
      setPlan(p)
      const en = p.ops.map(() => true)
      setEnabled(en)
      showPreview(p, en) // the plan card shows the summary, so no extra chat message
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

  const keep = () => {
    previewProject.current = null
    setAiPreviewActive(false)
    log({ role: 'ai', text: `Kept: ${plan?.summary ?? 'AI edit'}. Undo reverts the whole AI edit in one step.` })
    setPlan(null)
  }
  const discard = () => { clearPreview(); setPlan(null); log({ role: 'ai', text: 'Discarded - timeline restored.' }) }

  return { msgs, plan, enabled, busy, repairs, submit, toggleOp, keep, discard }
}
