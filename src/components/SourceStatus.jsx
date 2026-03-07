import React from 'react'
import { useApp } from '../App'

export default function SourceStatus() {
  const { meta, metaError } = useApp()

  if (metaError) {
    return (
      <div className="source-badges">
        <span className="source-badge error">Content not loaded</span>
      </div>
    )
  }

  if (!meta) return null

  return (
    <div className="source-badges">
      <span className="source-badge">
        <span className="source-dot loaded" />
        FRCP ✓
      </span>
      <span className="source-badge">
        <span className="source-dot loaded" />
        CPLR ✓
      </span>
      <span className="source-badge source-date">
        {meta.generated_date}
      </span>
    </div>
  )
}
