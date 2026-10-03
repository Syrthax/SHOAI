import { useState } from 'react'
import { useAiSession } from '../editor/useAiSession'
import PlanCard from './PlanCard'

export default function ChatPanel() {
  const s = useAiSession()
  const [text, setText] = useState('')
  const hasPlan = !!s.plan && !s.plan.unsupportedReason

  const send = () => {
    const t = text.trim()
    if (!t || s.busy) return
    setText('')
    s.submit(t, hasPlan) // if a plan is on screen, typing = refine
  }

  return (
    <aside className="chat">
      <h3>AI Copilot</h3>
      <div className="msgs">
        {s.msgs.length === 0 && (
          <div className="msg">Try: "Remove the first 3 seconds and add my name as a lower third at the start"</div>
        )}
        {s.msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'user' : m.role === 'err' ? 'err' : ''}`}>{m.text}</div>
        ))}
        {s.busy && <div className="msg">Planning...</div>}
        {s.plan && (
          <PlanCard
            plan={s.plan}
            enabled={s.enabled}
            repairs={s.repairs}
            onToggle={s.toggleOp}
            onKeep={s.keep}
            onDiscard={s.discard}
          />
        )}
      </div>
      <div className="input">
        <input
          value={text}
          placeholder={hasPlan ? 'Refine the plan...' : 'Describe an edit...'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button onClick={send} disabled={s.busy}>{hasPlan ? 'Refine' : 'Send'}</button>
      </div>
    </aside>
  )
}
