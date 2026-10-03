import { describeOp, type Plan } from '../ai/schema'

type Props = {
  plan: Plan
  enabled: boolean[]
  repairs: number
  onToggle: (i: number) => void
  onKeep: () => void
  onDiscard: () => void
}

export default function PlanCard({ plan, enabled, repairs, onToggle, onKeep, onDiscard }: Props) {
  if (plan.unsupportedReason) {
    return (
      <div className="card unsupported">
        <b>Not supported</b>
        <div>{plan.unsupportedReason}</div>
      </div>
    )
  }
  const count = enabled.filter(Boolean).length
  return (
    <div className="card">
      <b>{plan.summary}</b>
      {repairs > 0 && <span className="badge">auto-repaired x{repairs}</span>}
      {plan.ops.map((o, i) => (
        <label className="op" key={i}>
          <input type="checkbox" checked={enabled[i]} onChange={() => onToggle(i)} />
          <span>{describeOp(o)}</span>
        </label>
      ))}
      <details><summary>Plan JSON</summary><pre>{JSON.stringify(plan, null, 2)}</pre></details>
      <div className="row">
        <button className="ok" disabled={count === 0} onClick={onKeep}>Keep ({count})</button>
        <button className="ghost" onClick={onDiscard}>Discard</button>
      </div>
      <div style={{ marginTop: 6, opacity: 0.7 }}>Type below to refine this plan.</div>
    </div>
  )
}
