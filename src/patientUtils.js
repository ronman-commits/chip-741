import { BASE_URL } from './constants.js'

export function patientResourceUrl(patient) {
  const id = patient?.id && String(patient.id).trim() ? patient.id : null
  if (!id) return null
  return `${BASE_URL}/Patient/${encodeURIComponent(id)}`
}

/** Parse one FHIR HumanName into display / family / given (FHIR R4). */
export function humanNameToDisplayParts(name) {
  if (!name) {
    return { display: 'Unknown', family: 'Unknown', given: 'Unknown' }
  }

  const givenParts = Array.isArray(name.given)
    ? name.given.filter(Boolean)
    : name.given != null && String(name.given).trim()
      ? [String(name.given).trim()]
      : []
  const given = givenParts.length ? givenParts.join(' ') : 'Unknown'

  const fam = name.family
  const family =
    typeof fam === 'string' && fam.trim() ? fam.trim() : 'Unknown'

  const text = typeof name.text === 'string' && name.text.trim() ? name.text.trim() : ''
  const display =
    text ||
    [given !== 'Unknown' ? given : '', family !== 'Unknown' ? family : '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    'Unknown'

  return { display, family, given }
}

/** First HumanName entry (Patient.name[0]). */
export function parseFirstHumanName(patient) {
  return humanNameToDisplayParts(patient?.name?.[0] ?? null)
}

/** Maiden name string when `Patient.name` includes `use: "maiden"` (FHIR R4). */
export function getMaidenNameDisplay(patient) {
  const maiden = patient?.name?.find((n) => n?.use === 'maiden')
  if (!maiden) return null
  const { display } = humanNameToDisplayParts(maiden)
  return display !== 'Unknown' ? display : null
}

/** Second line in search result rows (muted): DOB, gender (ID only on profile card) */
export function formatPatientResultSummary(patient) {
  const dob = patient?.birthDate && String(patient.birthDate).trim() ? patient.birthDate : 'Unknown'
  const gender = patient?.gender && String(patient.gender).trim() ? patient.gender : 'Unknown'
  return `${dob} · ${gender}`
}
