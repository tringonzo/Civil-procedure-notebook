import React, { useState, useMemo } from 'react'
import { useData } from '../../lib/useData'
import CitationBadge from '../../components/CitationBadge'

const LETTERS = ['A', 'B', 'C', 'D']

function QuizQuestion({ question, index, total, onAnswer }) {
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const isCorrect = submitted && selected === question.correct
  const choices = question.choices

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
        <div className="section-label">
          QUESTION {index + 1} · {question.source}
        </div>
        <div className="quiz-q-text">{question.question}</div>

        <div className="quiz-options">
          {LETTERS.map(letter => {
            const opt = choices?.[letter]
            if (!opt) return null
            let cls = 'quiz-option'
            if (submitted) {
              if (letter === question.correct) cls += ' correct'
              else if (letter === selected) cls += ' wrong'
            } else if (letter === selected) {
              cls += ' selected'
            }
            return (
              <button
                key={letter}
                className={cls}
                onClick={() => !submitted && setSelected(letter)}
                disabled={submitted}
              >
                <span className="quiz-option-letter">{letter}.</span>
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
            {question.citation && (
              <div style={{ marginTop: '0.75rem' }}>
                <CitationBadge
                  rule={question.citation}
                  source={question.source}
                  provider={question.source === 'FRCP' ? 'Cornell LII' : 'NY Senate'}
                />
              </div>
            )}
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
        ✓ All questions sourced from FRCP (Cornell LII) and CPLR (NY Senate)
      </p>
    </div>
  )
}

export default function Quiz() {
  const { data: allQuestions, loading, error } = useData('quiz.json')

  const topics = useMemo(() => {
    if (!allQuestions) return []
    return [...new Set(allQuestions.map(q => q.topic))].sort()
  }, [allQuestions])

  const [topic, setTopic] = useState('')
  const [sourceFilter, setSourceFilter] = useState('both')
  const [count, setCount] = useState(5)
  const [questions, setQuestions] = useState([])
  const [current, setCurrent] = useState(0)
  const [score, setScore] = useState(0)
  const [showScore, setShowScore] = useState(false)
  const [started, setStarted] = useState(false)

  function handleStart() {
    if (!allQuestions) return
    let pool = allQuestions
    if (topic) pool = pool.filter(q => q.topic === topic)
    if (sourceFilter !== 'both') pool = pool.filter(q => q.source === sourceFilter)

    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, count)

    if (selected.length === 0) return

    setQuestions(selected)
    setCurrent(0)
    setScore(0)
    setShowScore(false)
    setStarted(true)
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
    setStarted(false)
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
          Multiple-choice questions from FRCP and CPLR. Every correct answer
          includes the exact rule or section citation.
        </p>
        <div className="brand-divider" />
      </div>

      {loading && (
        <div className="loading-spinner">
          <span>Loading quiz</span>
          <span className="loading-dots" />
        </div>
      )}

      {error && (
        <div className="error-msg">
          Could not load quiz. Run <code>npm run generate</code> first.
        </div>
      )}

      {!loading && !error && !started && allQuestions && (
        <div className="controls-row">
          <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
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
            <label className="form-label">Questions</label>
            <select className="select-box" value={count} onChange={e => setCount(Number(e.target.value))}>
              {[3, 5, 10, 15].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <button
            className="btn-primary"
            onClick={handleStart}
            style={{ alignSelf: 'flex-end' }}
          >
            Start Quiz →
          </button>
        </div>
      )}

      {started && !showScore && questions.length > 0 && (
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

      {!loading && !error && !started && allQuestions && allQuestions.length === 0 && (
        <div className="empty-state" style={{ paddingTop: '2rem' }}>
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">No questions yet</div>
          <p className="empty-state-desc">Run <code>npm run generate</code> to generate content.</p>
        </div>
      )}
    </div>
  )
}
