import React from 'react'

export default function CitationBadge({ rule, source, provider }) {
  return (
    <span className="citation-badge">
      <span className="cite-icon">✓</span>
      <span>
        {rule && <>{rule} · </>}
        {source} · {provider}
      </span>
    </span>
  )
}
