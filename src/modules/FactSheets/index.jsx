import React, { useState, useMemo } from 'react'
import { useData } from '../../lib/useData'

function KeyPointList({ points }) {
  if (!points || points.length === 0) return null
  return (
    <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0 0' }}>
      {points.map((pt, i) => (
        <li key={i} style={{ marginBottom: '0.4rem', fontSize: '0.9rem' }}>{pt}</li>
      ))}
    </ul>
  )
}

function FactSheetDisplay({ sheet }) {
  const frcp = sheet.frcp || {}
  const cplr = sheet.cplr || {}

  return (
    <div>
      <div className="fact-sheet-header">
        <div className="section-label" style={{ color: 'rgba(240,201,122,0.8)' }}>FACT SHEET</div>
        <div className="fact-sheet-title">{sheet.topic}</div>
      </div>

      <div className="fact-sheet-body">
        <div className="fact-sheet-cols">
          <div>
            <div className="fact-col-header">FEDERAL (FRCP)</div>
            {frcp.summary && (
              <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem', opacity: 0.9 }}>{frcp.summary}</p>
            )}
            {frcp.rules && frcp.rules.length > 0 && (
              <div className="fact-row">
                <div className="fact-row-label">Rules</div>
                <div className="fact-row-value">{frcp.rules.join(' · ')}</div>
              </div>
            )}
            <div className="fact-row">
              <div className="fact-row-label">Key Points</div>
              <div className="fact-row-value">
                <KeyPointList points={frcp.key_points} />
              </div>
            </div>
          </div>

          <div>
            <div className="fact-col-header">NEW YORK (CPLR)</div>
            {cplr.summary && (
              <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem', opacity: 0.9 }}>{cplr.summary}</p>
            )}
            {cplr.sections && cplr.sections.length > 0 && (
              <div className="fact-row">
                <div className="fact-row-label">Sections</div>
                <div className="fact-row-value">{cplr.sections.join(' · ')}</div>
              </div>
            )}
            <div className="fact-row">
              <div className="fact-row-label">Key Points</div>
              <div className="fact-row-value">
                <KeyPointList points={cplr.key_points} />
              </div>
            </div>
          </div>
        </div>

        {sheet.key_difference && (
          <div className="key-diff-block">
            <div className="key-diff-label">Key Difference</div>
            <div className="key-diff-text">{sheet.key_difference}</div>
          </div>
        )}

        {sheet.practitioner_tip && (
          <div className="key-diff-block" style={{ marginTop: '0.75rem', borderColor: 'rgba(240,201,122,0.3)' }}>
            <div className="key-diff-label">Practitioner Tip</div>
            <div className="key-diff-text">{sheet.practitioner_tip}</div>
          </div>
        )}

        <div className="fact-sources-row">
          <span>✓ All facts sourced from FRCP (Cornell LII) and CPLR (Justia)</span>
        </div>
      </div>
    </div>
  )
}

export default function FactSheets() {
  const { data: allSheets, loading, error } = useData('factsheets.json')

  const topics = useMemo(() => {
    if (!allSheets) return []
    return allSheets.map(s => s.topic)
  }, [allSheets])

  const [selectedTopic, setSelectedTopic] = useState('')
  const [sheet, setSheet] = useState(null)

  function handleSelect(topicName) {
    setSelectedTopic(topicName)
    if (!allSheets || !topicName) { setSheet(null); return }
    const found = allSheets.find(s => s.topic === topicName)
    setSheet(found || null)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div>
      <div className="page-header">
        <div className="section-label">MODULE 5</div>
        <h1 className="page-title display-title">Fact Sheets</h1>
        <p className="page-desc">
          Side-by-side FRCP vs. CPLR comparisons. Print-ready format included.
        </p>
        <div className="brand-divider" />
      </div>

      {loading && (
        <div className="loading-spinner">
          <span>Loading fact sheets</span>
          <span className="loading-dots" />
        </div>
      )}

      {error && (
        <div className="error-msg">
          Could not load fact sheets. Run <code>npm run generate</code> first.
        </div>
      )}

      {!loading && !error && allSheets && (
        <div className="controls-row">
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '220px' }}>
            <label className="form-label">Select Topic</label>
            <select
              className="select-box"
              value={selectedTopic}
              onChange={e => handleSelect(e.target.value)}
            >
              <option value="">Choose a topic…</option>
              {topics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {sheet && (
            <button
              className="btn-primary"
              onClick={handlePrint}
              style={{ alignSelf: 'flex-end' }}
            >
              Print / Save PDF
            </button>
          )}
        </div>
      )}

      {sheet && <FactSheetDisplay sheet={sheet} />}

      {!loading && !error && !sheet && allSheets && (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <div className="empty-state-title">
            {topics.length === 0 ? 'No fact sheets yet' : 'Select a topic above'}
          </div>
          <p className="empty-state-desc">
            {topics.length === 0
              ? 'Run npm run generate to generate content.'
              : `${topics.length} topics available — choose one to view the comparison.`}
          </p>
        </div>
      )}
    </div>
  )
}
