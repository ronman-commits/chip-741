import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import { SearchProvider } from './SearchContext.jsx'
import { SearchPage } from './pages/SearchPage.jsx'
import { PatientDashboardPage } from './pages/PatientDashboardPage.jsx'

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <HashRouter>
      <SearchProvider>
        <div className="app app--dashboard">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <header className="header">
            <h1>CHIP 741</h1>
            <p className="tagline">App Development with JS and FHIR</p>
          </header>
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/patient/:patientId" element={<PatientDashboardPage />} />
          </Routes>
        </div>
      </SearchProvider>
    </HashRouter>
  )
}
