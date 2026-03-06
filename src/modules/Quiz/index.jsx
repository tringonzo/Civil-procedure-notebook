import React, { useState } from 'react'
import { useApp } from '../../App'
import { getRelevantChunks } from '../../lib/search'
import { generateQuiz } from '../../lib/claude'
import CitationBadge from '../../components/CitationBadge'

const TOPICS = [
  'Service of Process',
  'Pleadings & Complaints',
  'Discovery Rules',
  'Summary Judgment',
  'Motions Practice',
  'Jurisdiction & Venue',
  'Default Judgment',
  'Appeals',
]

const LETTERS = ['A', 'B', 'C', 'D']

function QuizQuestion({ question, index, total, onAnswer }) {
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const isCorrect = submitted && selected === question.correct
  const isWrong = submitted && selected !== null && selected !== question.correct

  function handleSubmit() {
    if (selected === null || submitted) return
    setSubmitted(true)
  }

  function handleNext() {
    onAnswer(selected === question.correct)
  }

  return (
    <div>
      <div className="quiz-progress">
        <div className="quiz-progress-label mono">
          Question {index + 1} of {total}
        </div>
        <div className="quiz-progress-bar">
          <div className="quiz-progress-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
      </div>

      <div className="quiz-question-card">
        <div className="section-label">QUESTION {index + 1}</div>
        <div className="quiz-q-text">{question.question}</div>

        <div className="quiz-options">
          {question.options.map((opt, i) => {
            let cls = 'quiz-option'
            if (submitted) {
              if (i === question.correct) cls += ' correct'
              else if (i === selected) cls += ' wrong'
            } else if (i === selected) {
              cls += ' selected'
            }
            return (
              <button
                key={i}
                className={cls}
                onClick={() => !submitted && setSelected(i)}
                disabled={submitted}
              >
                <span className="quiz-option-letter">{LETTERS[i]}.</span>
                <span className="quiz-option-text">{opt}</span>
              </button>
            )
          })}
        </div>
      </div>

      {submitted ? (
        <div>
          <div className={`quiz-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
            <div className="quiz-feedback-label">
              {isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}
            </div>
            <div className="quiz-feedback-text">{question.explanation}</div>
            <div style={{ marginTop: '0.75rem' }}>
              <CitationBadge
                rule={question.rule}
                source={question.source}
                provider={question.provider || (question.source === 'FRCP' ? 'Cornell LII' : 'Justia')}
              />
            </div>
          </div>
          <button className="btn-primary" onClick={handleNext}>
            {index + 1 < total ? 'Next Question →' : 'See Results →'}
          </button>
        </div>
      ) : (
        <div className="quiz-submit-row">
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={selected === null}
          >
            Submit Answer
          </button>
          <span className="footer-body" style={{ fontSize: '0.8rem' }}>
            {selected === null ? 'Select an option first' : 'Ready to submit'}
          </span>
        </div>
      )}
    </div>
  )
}

function ScoreScreen({ score, total, onRestart, onNewQuiz }) {
  const pct = Math.round((score / total) * 100)
  const grade = pct >= 90 ? 'Excellent' : pct >= 70 ? 'Good' : pct >= 50 ? 'Keep Studying' : 'Review Sources'

  return (
    <div className="quiz-score-screen">
      <div className="section-label">QUIZ COMPLETE</div>
      <h2 className="display-title" style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
        {grade}
      </h2>
      <div className="quiz-score-circle">
        <div className="quiz-score-pct">{pct}%</div>
        <div className="quiz-score-label">SCORE</div>
      </div>
      <p className="quiz-score-detail">
        {score} correct · {total - score} wrong · {total} questions
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
        <button className="btn-primary" onClick={onRestart}>Retry Quiz</button>
        <button className="btn-ghost" onClick={onNewQuiz}>New Quiz</button>
      </div>
      <p className="footer-body" style={{ marginTop: '1.5rem', fontSize: '0.8rem' }}>
        ✓ All questions sourced from FRCP (Cornell LII) and CPLR (Justia)
      </p>
    </div>
  )
}

export default function Quiz() {
  const { chunks, apiKey } = useApp()
  const [topic, setTopic] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [sourceFilter, setSourceFilter] = useState('both')
  const [count, setCount] = useState(5)
  const [questions, setQuestions] = useState([])
  const [current, setCurrent] = useState(0)
  const [score, setScore] = useState(0)
  const [showScore, setShowScore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const activeTopic = customTopic.trim() || topic

  async function handleGenerate() {
    if (!activeTopic) return
    setLoading(true)
    setError(null)
    setQuestions([])
    setShowScore(false)

    try {
      const relevantChunks = getRelevantChunks(activeTopic, chunks, { source: sourceFilter, limit: 8 })
      const result = await generateQuiz(activeTopic, sourceFilter, count, relevantChunks, apiKey)
      if (!Array.isArray(result) || result.length === 0) throw new Error('No questions returned')
      setQuestions(result)
      setCurrent(0)
      setScore(0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleAnswer(correct) {
    if (correct) setScore(s => s + 1)
    if (current + 1 >= questions.length) {
      setShowScore(true)
    } else {
      setCurrent(c => c + 1)
    }
  }

  function handleRestart() {
    setCurrent(0)
    setScore(0)
    setShowScore(false)
  }

  function handleNewQuiz() {
    setQuestions([])
    setShowScore(false)
    setCurrent(0)
    setScore(0)
  }

  return (
    <div>
      <div className="page-header">
        <div className="section-label">MODULE 4</div>
        <h1 className="page-title display-title">Quiz</h1>
        <p className="page-desc">
          Multiple-choice questions generated from the loaded sources. Every correct
          answer includes the exact rule or section.
        </p>
        <div className="brand-divider" />
      </div>

      {!questions.length && !loading && !showScore && (
        <div className="controls-row">
          <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
            <label className="form-label">Topic</label>
            <select className="select-box" value={topic} onChange={e => setTopic(e.target.value)}>
              <option value="">Select a topic…</option>
              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '180px' }}>
            <label className="form-label">Or custom topic</label>
            <input
              type="text"
              className="input-text"
              placeholder="e.g. Venue transfer under FRCP"
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
            <label className="form-label">Questions</label>
            <select className="select-box" value={count} onChange={e => setCount(Number(e.target.value))}>
              {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={!activeTopic || loading}
            style={{ alignSelf: 'flex-end' }}
          >
            Start Quiz →
          </button>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {loading && (
        <div className="empty-state">
          <div className="loading-spinner">
            <span>Generating quiz questions</span>
            <span className="loading-dots" />
          </div>
        </div>
      )}

      {questions.length > 0 && !showScore && (
        <QuizQuestion
          key={current}
          question={questions[current]}
          index={current}
          total={questions.length}
          onAnswer={handleAnswer}
        />
      )}

      {showScore && (
        <ScoreScreen
          score={score}
          total={questions.length}
          onRestart={handleRestart}
          onNewQuiz={handleNewQuiz}
        />
      )}

      {!questions.length && !loading && !showScore && !error && (
        <div className="empty-state" style={{ paddingTop: '2rem' }}>
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">Ready to quiz</div>
          <p className="empty-state-desc">
            Choose a topic, set your options, and click Start Quiz.
          </p>
        </div>
      )}
    </div>
  )
}
