import React from 'react'
import { useApp } from '../App'

function StatusDot({ status }) {
  const cls = status.loading ? 'loading' : status.loaded ? 'loaded' : 'error'
  return <span className={`source-dot ${cls}`} />
}

export default function SourceStatus() {
  const { sourceStatus } = useApp()
  const { frcp, cplr } = sourceStatus

  return (
    <div className="source-badges">
      <span className="source-badge">
        <StatusDot status={frcp} />
        FRCP{frcp.loaded ? ' ✓' : frcp.loading ? '…' : ' ✗'}
      </span>
      <span className="source-badge">
        <StatusDot status={cplr} />
        CPLR{cplr.loaded ? ' ✓' : cplr.loading ? '…' : ' ✗'}
      </span>
    </div>
  )
}
