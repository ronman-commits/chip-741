import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { BASE_URL } from './constants.js'

const SearchContext = createContext(null)

export function SearchProvider({ children }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [patients, setPatients] = useState([])
  /** Stable selection across route changes; resolved against `patients` below */
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchEmptyHint, setSearchEmptyHint] = useState(null)

  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return null
    return patients.find((p) => p.id === selectedPatientId) ?? null
  }, [patients, selectedPatientId])

  const setSelectedPatient = useCallback((patientOrNull) => {
    setSelectedPatientId(patientOrNull?.id ?? null)
  }, [])

  const searchPatients = useCallback(async () => {
    const term = searchTerm.trim()
    if (!term) return

    setLoading(true)
    setError('')
    setSelectedPatientId(null)
    setSearchEmptyHint(null)

    try {
      const url = `${BASE_URL}/Patient?family=${encodeURIComponent(term)}`
      const response = await fetch(url, {
        headers: {
          Accept: 'application/fhir+json',
        },
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      const data = await response.json()
      const entries = data.entry || []
      const foundPatients = entries
        .map((entry) => entry.resource)
        .filter((r) => r?.resourceType === 'Patient')

      setPatients(foundPatients)
      if (foundPatients.length === 0) {
        setSearchEmptyHint({ term })
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
      setPatients([])
      setSearchEmptyHint(null)
      setSelectedPatientId(null)
    } finally {
      setLoading(false)
    }
  }, [searchTerm])

  const value = useMemo(
    () => ({
      searchTerm,
      setSearchTerm,
      patients,
      selectedPatient,
      setSelectedPatient,
      loading,
      error,
      searchEmptyHint,
      searchPatients,
    }),
    [
      searchTerm,
      patients,
      selectedPatient,
      setSelectedPatient,
      loading,
      error,
      searchEmptyHint,
      searchPatients,
    ],
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useSearch() {
  const ctx = useContext(SearchContext)
  if (!ctx) {
    throw new Error('useSearch must be used within SearchProvider')
  }
  return ctx
}
