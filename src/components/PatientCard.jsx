import { useState, useEffect, useRef } from 'react'
import {
  patientResourceUrl,
  parseFirstHumanName,
  getMaidenNameDisplay,
} from '../patientUtils.js'

function ExternalLinkIcon() {
  return (
    <svg
      className="patient-card__external-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg
      className="patient-card__external-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      className="patient-card__external-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function PatientCard({ patient }) {
  const [copyStatus, setCopyStatus] = useState(null)
  const copyTimeoutRef = useRef(null)

  function clearCopyTimer() {
    if (copyTimeoutRef.current != null) {
      clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = null
    }
  }

  useEffect(() => {
    setCopyStatus(null)
    clearCopyTimer()
  }, [patient?.id])

  useEffect(() => () => clearCopyTimer(), [])

  if (!patient) {
    return (
      <div className="patient-card patient-card--empty">
        <h2 className="patient-card__title">Patient profile</h2>
        <p className="patient-card__empty-text muted">
          Select someone from the search results to view their details here. This panel stays visible
          while you scroll.
        </p>
      </div>
    )
  }

  const { display, family, given } = parseFirstHumanName(patient)
  const maidenName = getMaidenNameDisplay(patient)
  const resourceUrl = patientResourceUrl(patient)
  const patientIdRaw = patient.id && String(patient.id).trim() ? String(patient.id).trim() : null

  async function copyPatientId() {
    if (!patientIdRaw) return
    clearCopyTimer()
    try {
      await navigator.clipboard.writeText(patientIdRaw)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopyStatus(null)
      copyTimeoutRef.current = null
    }, 2000)
  }

  return (
    <div className="patient-card">
      <h2 className="patient-card__title">Patient profile</h2>
      <div>
        <strong>Display name:</strong> {display}
      </div>
      <div>
        <strong>Family:</strong> {family}
      </div>
      <div>
        <strong>Given:</strong> {given}
      </div>
      {maidenName && (
        <div>
          <strong>Maiden name:</strong> {maidenName}
        </div>
      )}
      <div>
        <strong>DOB:</strong> {patient.birthDate && String(patient.birthDate).trim() ? patient.birthDate : 'Unknown'}
      </div>
      <div>
        <strong>Gender:</strong> {patient.gender && String(patient.gender).trim() ? patient.gender : 'Unknown'}
      </div>
      <div className="patient-card__id-field">
        <strong>Patient ID:</strong>
        <span className="patient-card__id-body">
          <code className="patient-card__id">{patientIdRaw ?? 'Unknown'}</code>
          {patientIdRaw && (
            <button
              type="button"
              className={[
                'patient-card__copy-icon-btn',
                copyStatus === 'copied' && 'patient-card__copy-icon-btn--success',
                copyStatus === 'failed' && 'patient-card__copy-icon-btn--error',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={copyPatientId}
              title={
                copyStatus === 'copied'
                  ? 'Copied to clipboard'
                  : copyStatus === 'failed'
                    ? 'Copy failed — try again'
                    : 'Copy patient ID to clipboard'
              }
              aria-label={
                copyStatus === 'copied'
                  ? 'Copied to clipboard'
                  : copyStatus === 'failed'
                    ? 'Copy failed'
                    : 'Copy patient ID to clipboard'
              }
            >
              {copyStatus === 'copied' ? <CheckIcon /> : <ClipboardIcon />}
            </button>
          )}
        </span>
      </div>
      <span className="visually-hidden" aria-live="polite">
        {copyStatus === 'copied' ? 'Copied to clipboard' : copyStatus === 'failed' ? 'Copy failed' : ''}
      </span>
      <hr className="patient-card__divider" aria-hidden="true" />
      <p className="patient-card__hint muted">
        Resource URL:{' '}
        {resourceUrl ? (
          <a
            href={resourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="patient-card__resource-link"
            title="Opens patient JSON on the FHIR server in a new tab"
          >
            <code className="patient-card__resource-code">{resourceUrl}</code>
            <ExternalLinkIcon />
            <span className="visually-hidden"> (opens in new tab)</span>
          </a>
        ) : (
          <code>Unknown</code>
        )}
      </p>
    </div>
  )
}
