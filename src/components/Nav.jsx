import React from 'react'
import { NavLink } from 'react-router-dom'
import SourceStatus from './SourceStatus'

const TABS = [
  { to: '/search',      label: 'Search' },
  { to: '/ask',         label: 'Ask' },
  { to: '/flashcards',  label: 'Flashcards' },
  { to: '/quiz',        label: 'Quiz' },
  { to: '/fact-sheets', label: 'Fact Sheets' },
]

export default function Nav({ onApiKey }) {
  return (
    <nav className="app-nav">
      {/* Row 1: Brand + controls */}
      <div className="nav-top">
        <span className="nav-brand">CIVIL PROCEDURE NOTEBOOK</span>
        <div className="nav-right">
          <SourceStatus />
          <button className="nav-api-btn" onClick={onApiKey}>
            API Key
          </button>
        </div>
      </div>

      {/* Row 2: Module tabs — scrollable */}
      <div className="nav-tabs-row">
        <div className="nav-tabs">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
