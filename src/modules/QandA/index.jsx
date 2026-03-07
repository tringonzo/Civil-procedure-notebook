import React, { useState, useMemo, useCallback } from 'react'
import { useData } from '../../lib/useData'
import { search, highlightText, getExcerpt } from '../../lib/search'
import CitationBadge from '../../components/CitationBadge'

const EXAMPLE_QUESTIONS = [
  'What is the deadline to serve a defendant under FRCP?',
  'How does CPLR define nail-and-mail service?',
  'When can a party move for summary judgment?',
  'What is the difference between FRCP and CPLR service deadlines?',
]

const SOURCE_FILTERS = [
  { value: 'both', label: 'Both' },
  { value: 'FRCP',  label: 'FRCP only' },
  { value: 'CPLR',  label: 'CPLR only' },
]

function ResultCard({ chunk, terms }) {
  const excerpt = getExcerpt(chunk.text, terms, 500)
  const highlighted = highlightText(excerpt, terms)
  const provider = chunk.source === 'FRCP' ? 'Cornell LII' : 'Justia'

  return (
    <div className="search-result-card">
      <div className="result-source-tag">
        {chunk.source}
        {chunk.section_title ? ` — ${chunk.section_title}` : ''}
        {` — ${provider}`}
      </div>
      <p
        className="result-text"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
      <div style={{ marginTop: '0.75rem' }}>
        <CitationBadge
          rule={chunk.rule_number}
          source={chunk.source}
          provider={provider}
        />
      </div>
    </div>
  )
}

export default function QandA() {
  const { data: indexData, loading, error } = useData('search-index.json')
  const chunks = useMemo(() => indexData?.chunks || [], [indexData])

  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('both')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)

  const terms = useMemo(() => query
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9§]/g, ''))
    .filter(t => t.length >= 2),
    [query]
  )

  const doSearch = useCallback(() => {
    if (!query.trim() || chunks.length === 0) return
    const found = search(query, chunks, { source: sourceFilter, limit: 8 })
    setResults(found)
    setSearched(true)
  }, [query, chunks, sourceFilter])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doSearch()
  }

  function handleExample(q) {
    setQuery(q)
    setResults([])
    setSearched(false)
  }

  return (
    <div>
      <div className="page-header">
        <div className="section-label">MODULE 2</div>
        <h1 className="page-title display-title">Search the Sources</h1>
        <p className="page-desc">
          Find relevant passages directly from the FRCP and CPLR source text.
          Results show the exact rule or section, ranked by relevance.
        </p>
        <div className="brand-divider" />
      </div>

      <div className="qa-form">
        <div className="form-group">
          <label className="form-label">Your Question or Topic</label>
          <textarea
            className="textarea-text"
            rows={3}
            placeholder="e.g. What is the time limit for service of process under FRCP Rule 4(m)?"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <p className="footer-body" style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}>
            Ctrl+Enter to search
          </p>
        </div>

        <div className="search-filters" style={{ margin: '0.75rem 0' }}>
          <span className="section-label" style={{ alignSelf: 'center', marginBottom: 0 }}>Filter:</span>
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

        <div className="qa-actions">
          <button
            className="btn-primary"
            onClick={doSearch}
            disabled={!query.trim() || loading || chunks.length === 0}
          >
            Search Sources →
          </button>
        </div>

        {!searched && !loading && (
          <div style={{ marginTop: '1.5rem' }}>
            <div className="section-label">TRY AN EXAMPLE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q}
                  className="filter-btn"
                  onClick={() => handleExample(q)}
                  style={{ borderRadius: '6px' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-spinner">
          <span>Loading sources</span>
          <span className="loading-dots" />
        </div>
      )}

      {error && (
        <div className="error-msg">
          Could not load source index. Run <code>npm run generate</code> first.
        </div>
      )}

      {searched && !loading && (
        <div className="qa-answer-card" style={{ padding: 0, background: 'none', border: 'none' }}>
          {results.length === 0 ? (
            <div className="no-results">
              No matching passages found for "{query}"
              {sourceFilter !== 'both' ? ` in ${sourceFilter}` : ''}.
              Try broader terms.
            </div>
          ) : (
            <>
              <p className="footer-body" style={{ marginBottom: '1rem' }}>
                {results.length} passage{results.length !== 1 ? 's' : ''} found — "{query}"
              </p>
              {results.map((chunk, i) => (
                <ResultCard key={chunk.id || i} chunk={chunk} terms={terms} />
              ))}
              <div className="qa-warning" style={{ marginTop: '1rem' }}>
                ⚠ Results are raw source text from FRCP (Cornell LII) and CPLR (Justia).
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
