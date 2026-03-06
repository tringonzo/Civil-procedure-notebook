import React, { useState } from 'react'
import { useApp } from '../../App'
import { getRelevantChunks } from '../../lib/search'
import { generateFactSheet } from '../../lib/claude'

const TOPICS = [
  'Service of Process',
  'Summary Judgment',
  'Discovery Deadlines',
  'Pleading Standards',
  'Default Judgment',
  'Motions to Dismiss',
  'Appeals Process',
  'Venue & Jurisdiction',
  'Statute of Limitations',
  'Preliminary Injunctions',
]

function FactPoint({ point }) {
  return (
    <div className="fact-row">
      <div className="fact-row-label">{point.label}</div>
      <div className="fact-row-value">{point.value}</div>
      {point.rule && <div className="fact-row-rule">{point.rule}</div>}
    </div>
  )
}

function FactSheetDisplay({ sheet }) {
  return (
    <div>
      <div className="fact-sheet-header">
        <div className="section-label" style={{ color: 'rgba(240,201,122,0.8)' }}>FACT SHEET</div>
        <div className="fact-sheet-title">{sheet.title}</div>
      </div>

      <div className="fact-sheet-body">
        <div className="fact-sheet-cols">
          <div>
            <div className="fact-col-header">FEDERAL (FRCP)</div>
            {(sheet.frcp_points || []).map((p, i) => (
              <FactPoint key={i} point={p} />
            ))}
          </div>
          <div>
            <div className="fact-col-header">NEW YORK (CPLR)</div>
            {(sheet.cplr_points || []).map((p, i) => (
              <FactPoint key={i} point={p} />
            ))}
          </div>
        </div>

        {sheet.key_difference && (
          <div className="key-diff-block">
            <div className="key-diff-label">Key Difference</div>
            <div className="key-diff-text">{sheet.key_difference}</div>
          </div>
        )}

        <div className="fact-sources-row">
          {sheet.frcp_sources?.length > 0 && (
            <span>FRCP: {sheet.frcp_sources.join(' · ')}</span>
          )}
          {sheet.frcp_sources?.length > 0 && sheet.cplr_sources?.length > 0 && (
            <span> &nbsp;|&nbsp; </span>
          )}
          {sheet.cplr_sources?.length > 0 && (
            <span>CPLR: {sheet.cplr_sources.join(' · ')}</span>
          )}
          <span style={{ marginLeft: '1rem' }}>✓ All facts from loaded sources</span>
        </div>
      </div>
    </div>
  )
}

export default function FactSheets() {
  const { chunks, apiKey } = useApp()
  const [topic, setTopic] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [sheet, setSheet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const activeTopic = customTopic.trim() || topic

  async function handleGenerate() {
    if (!activeTopic) return
    setLoading(true)
    setError(null)
    setSheet(null)

    try {
      const relevantChunks = getRelevantChunks(activeTopic, chunks, { source: 'both', limit: 10 })
      const result = await generateFactSheet(activeTopic, relevantChunks, apiKey)
      if (!result || !result.title) throw new Error('Invalid fact sheet returned')
      setSheet(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
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
          Side-by-side FRCP vs. CPLR comparison generated from the loaded sources.
          Print-ready format included.
        </p>
        <div className="brand-divider" />
      </div>

      <div className="controls-row">
        <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
          <label className="form-label">Topic</label>
          <select className="select-box" value={topic} onChange={e => setTopic(e.target.value)}>
            <option value="">Select a topic…</option>
            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
          <label className="form-label">Or type a custom topic</label>
          <input
            type="text"
            className="input-text"
            placeholder="e.g. Class action requirements"
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          />
        </div>

        <button
          className="btn-primary"
          onClick={handleGenerate}
          disabled={!activeTopic || loading}
          style={{ alignSelf: 'flex-end' }}
        >
          {loading ? 'Generating…' : 'Generate →'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {loading && (
        <div className="empty-state">
          <div className="loading-spinner">
            <span>Generating fact sheet</span>
            <span className="loading-dots" />
          </div>
        </div>
      )}

      {sheet && (
        <>
          <FactSheetDisplay sheet={sheet} />
          <div className="fact-actions">
            <button className="btn-primary" onClick={handlePrint}>
              Print / Save PDF
            </button>
            <button className="btn-ghost" onClick={handleGenerate}>
              Regenerate
            </button>
            <button className="btn-ghost" onClick={() => { setSheet(null); setCustomTopic(''); setTopic('') }}>
              New Topic
            </button>
          </div>
        </>
      )}

      {!loading && !sheet && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <div className="empty-state-title">No fact sheet yet</div>
          <p className="empty-state-desc">
            Choose a topic to generate a printable FRCP vs. CPLR comparison sheet.
          </p>
        </div>
      )}
    </div>
  )
}
