import React, { useState, useMemo } from 'react'
import { useData } from '../../lib/useData'
import CitationBadge from '../../components/CitationBadge'

function FlipCard({ card, flipped, onFlip }) {
  return (
    <div
      className={`flip-card${flipped ? ' flipped' : ''}`}
      onClick={onFlip}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onFlip()}
    >
      <div className="flip-card-inner">
        <div className="flip-card-front">
          <div className="flip-label">QUESTION — Click to reveal answer</div>
          <div className="flip-question">{card.front}</div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', opacity: 0.6 }}>
            {card.source} · {card.topic}
          </div>
        </div>
        <div className="flip-card-back">
          <div className="flip-label">ANSWER</div>
          <div className="flip-question">{card.back}</div>
          <div style={{ marginTop: '1rem' }}>
            <CitationBadge
              rule={card.rule_number}
              source={card.source}
              provider={card.source === 'FRCP' ? 'Cornell LII' : 'Justia'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Flashcards() {
  const { data: allCards, loading, error } = useData('flashcards.json')

  const topics = useMemo(() => {
    if (!allCards) return []
    return [...new Set(allCards.map(c => c.topic))].sort()
  }, [allCards])

  const [topic, setTopic] = useState('')
  const [sourceFilter, setSourceFilter] = useState('both')
  const [count, setCount] = useState(10)
  const [cards, setCards] = useState([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [score, setScore] = useState({ knew: 0, missed: 0 })
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)

  function handleStart() {
    if (!allCards) return
    let pool = allCards
    if (topic) pool = pool.filter(c => c.topic === topic)
    if (sourceFilter !== 'both') pool = pool.filter(c => c.source === sourceFilter)

    // Shuffle and pick count
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, count)

    if (selected.length === 0) return

    setCards(selected)
    setCurrent(0)
    setFlipped(false)
    setScore({ knew: 0, missed: 0 })
    setDone(false)
    setStarted(true)
  }

  function next(knew) {
    setScore(s => ({ knew: s.knew + (knew ? 1 : 0), missed: s.missed + (knew ? 0 : 1) }))
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

  function newSet() {
    setStarted(false)
    setCards([])
    setDone(false)
  }

  const card = cards[current]
  const progress = cards.length > 0 ? (current / cards.length) * 100 : 0

  return (
    <div>
      <div className="page-header">
        <div className="section-label">MODULE 3</div>
        <h1 className="page-title display-title">Flashcards</h1>
        <p className="page-desc">
          Q&A flashcards from FRCP and CPLR source text. Click a card to flip it.
          Track what you know vs. what to review.
        </p>
        <div className="brand-divider" />
      </div>

      {loading && (
        <div className="loading-spinner">
          <span>Loading flashcards</span>
          <span className="loading-dots" />
        </div>
      )}

      {error && (
        <div className="error-msg">
          Could not load flashcards. Run <code>npm run generate</code> first.
        </div>
      )}

      {!loading && !error && !started && allCards && (
        <div className="controls-row">
          <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
            <label className="form-label">Topic</label>
            <select className="select-box" value={topic} onChange={e => setTopic(e.target.value)}>
              <option value="">All topics</option>
              {topics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Source</label>
            <select className="select-box" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
              <option value="both">Both</option>
              <option value="FRCP">FRCP</option>
              <option value="CPLR">CPLR</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Cards</label>
            <select className="select-box" value={count} onChange={e => setCount(Number(e.target.value))}>
              {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <button
            className="btn-primary"
            onClick={handleStart}
            style={{ alignSelf: 'flex-end' }}
          >
            Start →
          </button>
        </div>
      )}

      {started && !done && card && (
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
              <button
                className="btn-ghost"
                onClick={() => next(false)}
                style={{ color: 'var(--energia)', borderColor: 'var(--energia)' }}
              >
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
            <button className="btn-ghost" onClick={newSet}>New Set</button>
          </div>
        </div>
      )}

      {!loading && !error && !started && allCards && allCards.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🃏</div>
          <div className="empty-state-title">No flashcards found</div>
          <p className="empty-state-desc">Run <code>npm run generate</code> to generate content.</p>
        </div>
      )}
    </div>
  )
}
