import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Nav from './components/Nav'
import Search from './modules/Search'
import QandA from './modules/QandA'
import Flashcards from './modules/Flashcards'
import Quiz from './modules/Quiz'
import FactSheets from './modules/FactSheets'
import { loadSources } from './lib/fetcher'

export const AppContext = createContext(null)

export function useApp() {
  return useContext(AppContext)
}

function ApiKeyModal({ current, onSave, onClose }) {
  const [value, setValue] = useState(current)

  function handleKeyDown(e) {
    if (e.key === 'Enter') onSave(value)
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="section-label">SETTINGS</div>
        <h2 className="modal-title">Anthropic API Key</h2>
        <p className="modal-desc">
          Get your key at{' '}
          <strong>console.anthropic.com</strong>.
          Stored only in your browser. Never shared.
        </p>
        <input
          type="password"
          className="api-key-input"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="sk-ant-api03-..."
          autoFocus
        />
        <div className="modal-actions">
          <button className="btn-primary" onClick={() => onSave(value)}>
            Save Key
          </button>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [chunks, setChunks] = useState([])
  const [sourceStatus, setSourceStatus] = useState({
    frcp: { loaded: false, loading: false, error: null },
    cplr: { loaded: false, loading: false, error: null },
  })
  const [apiKey, setApiKeyState] = useState(
    () => localStorage.getItem('cpn_api_key') || ''
  )
  const [showApiModal, setShowApiModal] = useState(false)

  const setApiKey = useCallback((key) => {
    localStorage.setItem('cpn_api_key', key.trim())
    setApiKeyState(key.trim())
  }, [])

  useEffect(() => {
    async function init() {
      setSourceStatus({
        frcp: { loaded: false, loading: true, error: null },
        cplr: { loaded: false, loading: true, error: null },
      })

      const result = await loadSources()
      setChunks(result.chunks)
      setSourceStatus({
        frcp: { loaded: result.frcpLoaded, loading: false, error: result.frcpError },
        cplr: { loaded: result.cplrLoaded, loading: false, error: result.cplrError },
      })
    }

    init()
  }, [])

  return (
    <AppContext.Provider value={{ chunks, sourceStatus, apiKey, setApiKey }}>
      <HashRouter>
        <Nav onApiKey={() => setShowApiModal(true)} />

        {!apiKey && (
          <div className="api-banner">
            <span>
              AI features require an Anthropic API key.{' '}
              <button className="api-banner-link" onClick={() => setShowApiModal(true)}>
                Add key →
              </button>
            </span>
          </div>
        )}

        {showApiModal && (
          <ApiKeyModal
            current={apiKey}
            onSave={(k) => { setApiKey(k); setShowApiModal(false) }}
            onClose={() => setShowApiModal(false)}
          />
        )}

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/search" replace />} />
            <Route path="/search" element={<Search />} />
            <Route path="/ask" element={<QandA />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/fact-sheets" element={<FactSheets />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <div className="footer-inner">
            <p className="footer-body">
              All answers sourced from FRCP (Cornell LII) and CPLR (Justia)
            </p>
            <p className="footer-mono">Never from outside sources</p>
          </div>
        </footer>
      </HashRouter>
    </AppContext.Provider>
  )
}
