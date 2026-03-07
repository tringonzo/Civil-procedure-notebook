import React, { createContext, useContext } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Nav from './components/Nav'
import Search from './modules/Search'
import QandA from './modules/QandA'
import Flashcards from './modules/Flashcards'
import Quiz from './modules/Quiz'
import FactSheets from './modules/FactSheets'
import { useData } from './lib/useData'

export const AppContext = createContext(null)

export function useApp() {
  return useContext(AppContext)
}

export default function App() {
  const { data: meta, error: metaError } = useData('meta.json')

  return (
    <AppContext.Provider value={{ meta, metaError }}>
      <HashRouter>
        <Nav />

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
              All content sourced from FRCP (Cornell LII) and CPLR (NY Senate)
            </p>
            {meta && (
              <p className="footer-mono">Generated {meta.generated_date}</p>
            )}
          </div>
        </footer>
      </HashRouter>
    </AppContext.Provider>
  )
}
