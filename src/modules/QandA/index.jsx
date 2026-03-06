import React, { useState, useRef } from 'react'
import { useApp } from '../../App'
import { getRelevantChunks } from '../../lib/search'
import { askQuestion } from '../../lib/claude'
import CitationBadge from '../../components/CitationBadge'

const EXAMPLE_QUESTIONS = [
  'What is the deadline to serve a defendant under FRCP?',
  'How does CPLR define nail-and-mail service?',
  'When can a party move for summary judgment?',
  'What is the difference between FRCP and CPLR service deadlines?',
]

export default function QandA() {
  const { chunks, apiKey } = useApp()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const abortRef = useRef(false)

  async function handleAsk() {
    if (!question.trim() || streaming) return

    setAnswer('')
    setError(null)
    setDone(false)
    setStreaming(true)
    abortRef.current = false

    try {
      const relevantChunks = getRelevantChunks(question, chunks, { limit: 8 })
      await askQuestion(question, relevantChunks, apiKey, (chunk, full) => {
        if (abortRef.current) return
        setAnswer(full)
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setStreaming(false)
      setDone(true)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAsk()
  }

  function handleStop() {
    abortRef.current = true
    setStreaming(false)
    setDone(true)
  }

  function handleExample(q) {
    setQuestion(q)
    setAnswer('')
    setDone(false)
    setError(null)
  }

  return (
    <div>
      <div className="page-header">
        <div className="section-label">MODULE 2</div>
        <h1 className="page-title display-title">Ask a Question</h1>
        <p className="page-desc">
          Ask anything about civil procedure. Claude answers using only the loaded
          FRCP and CPLR sources — never outside knowledge.
        </p>
        <div className="brand-divider" />
      </div>

      <div className="qa-form">
        <div className="form-group">
          <label className="form-label">Your Question</label>
          <textarea
            className="textarea-text"
            rows={4}
            placeholder="e.g. What is the time limit for service of process under FRCP Rule 4(m)?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <p className="footer-body" style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}>
            Ctrl+Enter to submit
          </p>
        </div>

        <div className="qa-actions">
          <button
            className="btn-primary"
            onClick={handleAsk}
            disabled={!question.trim() || streaming}
          >
            {streaming ? 'Searching sources…' : 'Ask →'}
          </button>
          {streaming && (
            <button className="btn-ghost" onClick={handleStop}>
              Stop
            </button>
          )}
        </div>

        {/* Example questions */}
        {!answer && !streaming && (
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

      {error && (
        <div className="error-msg">{error}</div>
      )}

      {(answer || streaming) && (
        <div className="qa-answer-card">
          <div className="section-label" style={{ color: 'var(--apoyo)', marginBottom: '1rem' }}>
            ANSWER
          </div>
          <div className="qa-answer-text">
            {answer}
            {streaming && <span className="qa-cursor" />}
          </div>

          {done && answer && (
            <>
              <div className="qa-citation-row">
                <CitationBadge
                  source="FRCP &amp; CPLR"
                  provider="Cornell LII &amp; Justia"
                />
              </div>
              <div className="qa-warning">
                ⚠ This answer is based solely on loaded sources — FRCP (Cornell LII) and CPLR (Justia).
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
