import { useNavigate } from 'react-router-dom'
import { PatientCard } from '../components/PatientCard.jsx'
import { parseFirstHumanName, formatPatientResultSummary } from '../patientUtils.js'
import { useSearch } from '../SearchContext.jsx'

export function SearchPage() {
  const navigate = useNavigate()
  const {
    searchTerm,
    setSearchTerm,
    patients,
    selectedPatient,
    setSelectedPatient,
    loading,
    error,
    searchEmptyHint,
    searchPatients,
  } = useSearch()

  return (
    <main className="main main--wide">
      <div className="dashboard-layout">
        <div className="dashboard-layout__search">
          <h2 className="dashboard-title">FHIR patient search</h2>
          <p className="dashboard-lead muted">
            Search the public sandbox by <strong>last name</strong> (<code>Patient?family</code>). Click a{' '}
            <strong>result</strong> to show that patient in the profile panel; use <strong>Open dashboard</strong> when
            you want the full patient page.
          </p>

          <label className="search-field-label" htmlFor="patient-last-name">
            Last name
          </label>
          <div className="search-row">
            <input
              id="patient-last-name"
              type="search"
              className="patient-input"
              placeholder="Search patient by last name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') searchPatients()
              }}
              aria-label="Search patient by last name"
            />
            <button type="button" className="patient-search-btn" onClick={searchPatients}>
              Search
            </button>
          </div>

          {loading && <p className="muted">Loading patients…</p>}
          {error && <p className="error-text" role="alert">{error}</p>}
        </div>

        <aside className="dashboard-layout__profile" aria-label="Selected patient profile">
          <div className="patient-profile-sticky">
            <PatientCard patient={selectedPatient} />
          </div>
        </aside>

        <div className="dashboard-layout__results">
          {searchEmptyHint && (
            <div className="results-section results-section--empty" role="status">
              <p className="muted">
                No patients found for <strong>{searchEmptyHint.term}</strong>. Try a different spelling.
              </p>
            </div>
          )}
          {patients.length > 0 && (
            <div className="results-section">
              <h3 className="results-heading">Search results</h3>
              <ul className="patient-list">
                {patients.map((patient) => (
                  <li key={patient.id}>
                    <div
                      className={`patient-result-card${
                        selectedPatient?.id === patient.id ? ' patient-result-card--selected' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="patient-item-select"
                        aria-current={selectedPatient?.id === patient.id ? 'true' : undefined}
                        onClick={() => setSelectedPatient(patient)}
                      >
                        <span className="patient-item-select__name">
                          {parseFirstHumanName(patient).display}
                        </span>
                        <span className="patient-item-select__meta muted">
                          {formatPatientResultSummary(patient)}
                        </span>
                      </button>
                      <div className="patient-result-card__actions">
                        <button
                          type="button"
                          className="patient-item-dashboard-btn"
                          onClick={() => {
                            setSelectedPatient(patient)
                            navigate(`/patient/${encodeURIComponent(patient.id)}`)
                          }}
                        >
                          Open dashboard
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
