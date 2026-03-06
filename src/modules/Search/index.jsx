import React, { useState, useCallback } from 'react'
import { useApp } from '../../App'
import { search, highlightText, getExcerpt } from '../../lib/search'
import CitationBadge from '../../components/CitationBadge'

const SOURCE_FILTERS = [
  { value: 'both', label: 'Both' },
  { value: 'FRCP',  label: 'FRCP' },
  { value: 'CPLR',  label: 'CPLR' },
]

function ResultCard({ chunk, terms }) {
  const excerpt = getExcerpt(chunk.text, terms, 400)
  const highlighted = highlightText(excerpt, terms)

  return (
    <div className="search-result-card">
      <div className="result-source-tag">
        {chunk.source} — {chunk.provider}
      </div>
      <p
        className="result-text"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
      <div style={{ marginTop: '0.75rem' }}>
        <CitationBadge source={chunk.source} provider={chunk.provider} />
      </div>
    </div>
  )
}

export default function Search() {
  const { chunks, sourceStatus } = useApp()
  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('both')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9§]/g, ''))
    .filter(t => t.length >= 2)

  const doSearch = useCallback(() => {
    if (!query.trim()) return
    const found = search(query, chunks, { source: sourceFilter, limit: 15 })
    setResults(found)
    setSearched(true)
  }, [query, chunks, sourceFilter])

  function handleKeyDown(e) {
    if (e.key === 'Enter') doSearch()
  }

  const sourcesLoaded = sourceStatus.frcp.loaded || sourceStatus.cplr.loaded
  const sourcesLoading = sourceStatus.frcp.loading || sourceStatus.cplr.loading

  return (
    <div>
      <div className="page-header">
        <div className="section-label">MODULE 1</div>
        <h1 className="page-title display-title">Keyword Search</h1>
        <p className="page-desc">
          Search across FRCP and CPLR source text. Results are ranked by relevance
          with matching terms highlighted.
        </p>
        <div className="brand-divider" />
      </div>

      <div className="search-bar">
        <input
          type="text"
          className="input-text"
          placeholder="e.g. service of process, summary judgment, discovery..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sourcesLoading}
        />
        <button
          className="btn-primary"
          onClick={doSearch}
          disabled={!query.trim() || !sourcesLoaded}
        >
          Search →
        </button>
      </div>

      <div className="search-filters">
        <span className="section-label" style={{ alignSelf: 'center', marginBottom: 0 }}>
          Filter:
        </span>
        {SOURCE_FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-btn${sourceFilter === f.value ? ' active' : ''}`}
            onClick={() => setSourceFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sourcesLoading && (
        <div className="loading-spinner">
          <span>Loading sources</span>
          <span className="loading-dots" />
        </div>
      )}

      {!sourcesLoading && !sourcesLoaded && (
        <div className="error-msg">
          Sources could not be loaded. Check your internet connection and refresh.
        </div>
      )}

      {searched && !sourcesLoading && (
        <div className="search-results">
          {results.length === 0 ? (
            <div className="no-results">
              No results found for "{query}"
              {sourceFilter !== 'both' ? ` in ${sourceFilter}` : ''}.
              Try broader terms or switch to "Both" sources.
            </div>
          ) : (
            <>
              <p className="footer-body" style={{ marginBottom: '1rem' }}>
                {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
              </p>
              {results.map((chunk, i) => (
                <ResultCard key={chunk.id || i} chunk={chunk} terms={terms} />
              ))}
            </>
          )}
        </div>
      )}

      {!searched && !sourcesLoading && sourcesLoaded && (
        <div className="empty-state">
          <div className="empty-state-icon">⚖️</div>
          <div className="empty-state-title">Ready to search</div>
          <p className="empty-state-desc">
            Type a keyword or phrase above — rule numbers, legal terms, procedure names.
          </p>
        </div>
      )}
    </div>
  )
}
