import React, { useState } from 'react'
import { useApp } from '../../App'
import { getRelevantChunks } from '../../lib/search'
import { generateFlashcards } from '../../lib/claude'
import CitationBadge from '../../components/CitationBadge'

const TOPICS = [
  'Service of Process',
  'Pleadings',
  'Discovery',
  'Summary Judgment',
  'Jurisdiction',
  'Appeals',
  'Default Judgment',
  'Motions to Dismiss',
]

function FlipCard({ card, flipped, onFlip }) {
  return (
    <div className={`flip-card${flipped ? ' flipped' : ''}`} onClick={onFlip} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onFlip()}>
      <div className="flip-card-inner">
        <div className="flip-card-front">
          <div className="flip-label">QUESTION — Click to reveal answer</div>
          <div className="flip-question">{card.question}</div>
        </div>
        <div className="flip-card-back">
          <div className="flip-label">ANSWER</div>
          <div className="flip-question">{card.answer}</div>
          <div style={{ marginTop: '1rem' }}>
            <CitationBadge rule={card.rule} source={card.source} provider={card.provider || (card.source === 'FRCP' ? 'Cornell LII' : 'Justia')} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Flashcards() {
  const { chunks, apiKey } = useApp()
  const [topic, setTopic] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [sourceFilter, setSourceFilter] = useState('both')
  const [count, setCount] = useState(5)
  const [cards, setCards] = useState([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [score, setScore] = useState({ knew: 0, missed: 0 })
  const [done, setDone] = useState(false)

  const activeTopic = customTopic.trim() || topic

  async function handleGenerate() {
    if (!activeTopic) return
    setLoading(true)
    setError(null)
    setCards([])
    setDone(false)

    try {
      const relevantChunks = getRelevantChunks(activeTopic, chunks, { source: sourceFilter, limit: 8 })
      const result = await generateFlashcards(activeTopic, sourceFilter, count, relevantChunks, apiKey)
      if (!Array.isArray(result) || result.length === 0) throw new Error('No flashcards returned')
      setCards(result)
      setCurrent(0)
      setFlipped(false)
      setScore({ knew: 0, missed: 0 })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function next(knew) {
    setScore(s => ({ ...s, knew: s.knew + (knew ? 1 : 0), missed: s.missed + (knew ? 0 : 1) }))
    if (current + 1 >= cards.length) {
      setDone(true)
    } else {
      setCurrent(c => c + 1)
      setFlipped(false)
    }
  }

  function restart() {
    setCurrent(0)
    setFlipped(false)
    setScore({ knew: 0, missed: 0 })
    setDone(false)
  }

  const card = cards[current]
  const progress = cards.length > 0 ? ((current) / cards.length) * 100 : 0

  return (
    <div>
      <div className="page-header">
        <div className="section-label">MODULE 3</div>
        <h1 className="page-title display-title">Flashcards</h1>
        <p className="page-desc">
          Claude generates Q&amp;A flashcards from the loaded sources. Click a card to flip it.
        </p>
        <div className="brand-divider" />
      </div>

      <div className="controls-row">
        <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
          <label className="form-label">Topic</label>
          <select className="select-box" value={topic} onChange={e => setTopic(e.target.value)}>
            <option value="">Select a topic…</option>
            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '180px' }}>
          <label className="form-label">Or type a custom topic</label>
          <input
            type="text"
            className="input-text"
            placeholder="e.g. Default judgment under CPLR"
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Source</label>
          <select className="select-box" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
            <option value="both">Both</option>
            <option value="frcp">FRCP</option>
            <option value="cplr">CPLR</option>
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Cards</label>
          <select className="select-box" value={count} onChange={e => setCount(Number(e.target.value))}>
            {[3,5,8,10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
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
            <span>Generating flashcards</span>
            <span className="loading-dots" />
          </div>
        </div>
      )}

      {cards.length > 0 && !done && (
        <div className="fc-arena">
          <div className="fc-progress-bar">
            <div className="fc-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="fc-counter mono">
            Card {current + 1} of {cards.length}
          </div>

          <FlipCard
            card={card}
            flipped={flipped}
            onFlip={() => setFlipped(f => !f)}
          />

          {flipped && (
            <div className="fc-nav">
              <button className="btn-ghost" onClick={() => next(false)} style={{ color: 'var(--energia)', borderColor: 'var(--energia)' }}>
                ✗ Missed
              </button>
              <button className="btn-primary" onClick={() => next(true)}>
                ✓ Knew it
              </button>
            </div>
          )}

          <div className="fc-score">
            <span className="fc-score-knew">✓ {score.knew} knew</span>
            <span className="fc-score-missed">✗ {score.missed} missed</span>
          </div>
        </div>
      )}

      {done && (
        <div className="quiz-score-screen">
          <div className="section-label">SESSION COMPLETE</div>
          <h2 className="display-title" style={{ fontSize: '1.75rem' }}>Flashcard Session Done</h2>
          <div className="quiz-score-circle">
            <div className="quiz-score-pct">{score.knew}</div>
            <div className="quiz-score-label">KNEW</div>
          </div>
          <p className="quiz-score-detail">
            {score.knew} knew · {score.missed} missed · {cards.length} total
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={restart}>Restart</button>
            <button className="btn-ghost" onClick={handleGenerate}>New Set</button>
          </div>
        </div>
      )}

      {!loading && cards.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">🃏</div>
          <div className="empty-state-title">No cards yet</div>
          <p className="empty-state-desc">
            Choose a topic and click Generate to create flashcards from the source material.
          </p>
        </div>
      )}
    </div>
  )
}
