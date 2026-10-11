import { useState } from 'react'
import type { ReactNode } from 'react'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')
  return (
    <button
      type="button"
      className="btn small quiet"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setState('done')
        } catch {
          setState('error')
        }
        window.setTimeout(() => setState('idle'), 1600)
      }}
    >
      {state === 'done' ? 'Copied' : state === 'error' ? 'Copy blocked' : label}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}
