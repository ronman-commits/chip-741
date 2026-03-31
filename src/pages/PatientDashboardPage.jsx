import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from 'recharts'
import { PatientCard } from '../components/PatientCard.jsx'
import { BASE_URL } from '../constants.js'

function ExternalLinkIcon() {
  return (
    <svg
      className="patient-dashboard__external-icon"
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

const LOINC_CODES = {
  bmi: 'http://loinc.org|39156-5',
  bloodPressure: 'http://loinc.org|55284-4',
  weight: 'http://loinc.org|29463-7',
  heartRate: 'http://loinc.org|8867-4',
  temperature: 'http://loinc.org|8310-5',
}

function getObservationUrl(patientId, loincCode) {
  const id = patientId && String(patientId).trim() ? String(patientId).trim() : ''
  if (!id || !loincCode) return null
  return `${BASE_URL}/Observation?patient=${encodeURIComponent(id)}&category=vital-signs&code=${encodeURIComponent(loincCode)}&_sort=date`
}

function bmiObservationUrl(patientId) {
  return getObservationUrl(patientId, LOINC_CODES.bmi)
}

function bloodPressureObservationUrl(patientId) {
  return getObservationUrl(patientId, LOINC_CODES.bloodPressure)
}

function weightObservationUrl(patientId) {
  return getObservationUrl(patientId, LOINC_CODES.weight)
}

function heartRateObservationUrl(patientId) {
  return getObservationUrl(patientId, LOINC_CODES.heartRate)
}

function temperatureObservationUrl(patientId) {
  return getObservationUrl(patientId, LOINC_CODES.temperature)
}

function getComponentValue(components, loincCode) {
  const match = components.find((component) =>
    Array.isArray(component?.code?.coding) &&
    component.code.coding.some((coding) => coding?.code === loincCode),
  )
  const value = Number(match?.valueQuantity?.value)
  return Number.isFinite(value) ? value : null
}

function transformBloodPressureObservations(bundle) {
  const entries = Array.isArray(bundle?.entry) ? bundle.entry : []
  const points = entries
    .map((entry) => entry?.resource)
    .filter((resource) => resource?.resourceType === 'Observation')
    .map((resource) => {
      const effectiveDate = resource?.effectiveDateTime
      if (!effectiveDate) return null
      const parsedDate = new Date(effectiveDate)
      if (Number.isNaN(parsedDate.getTime())) return null

      const components = Array.isArray(resource?.component) ? resource.component : []
      const systolic = getComponentValue(components, '8480-6')
      const diastolic = getComponentValue(components, '8462-4')
      if (systolic == null || diastolic == null) return null

      return {
        date: parsedDate.toISOString().slice(0, 10),
        systolic,
        diastolic,
      }
    })
    .filter(Boolean)

  points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return points
}

function sortByDateAsc(points) {
  points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return points
}

function transformSimpleObservationSeries(bundle, { seriesKey, getDate, getUnit, normalizeValue }) {
  const entries = Array.isArray(bundle?.entry) ? bundle.entry : []
  const points = entries
    .map((entry) => entry?.resource)
    .filter((resource) => resource?.resourceType === 'Observation')
    .map((resource) => {
      const rawValue = resource?.valueQuantity?.value
      const numericValue = Number(rawValue)
      if (!Number.isFinite(numericValue)) return null

      const effectiveDate = getDate(resource)
      if (!effectiveDate) return null
      const parsedDate = new Date(effectiveDate)
      if (Number.isNaN(parsedDate.getTime())) return null

      const value = normalizeValue ? normalizeValue(numericValue, resource) : numericValue
      if (!Number.isFinite(value)) return null
      const unit = getUnit ? getUnit(resource) : null

      return {
        date: parsedDate.toISOString().slice(0, 10),
        [seriesKey]: value,
        ...(unit ? { unit } : {}),
      }
    })
    .filter(Boolean)

  return sortByDateAsc(points)
}

function transformBmiObservations(bundle) {
  return transformSimpleObservationSeries(bundle, {
    seriesKey: 'bmi',
    getDate: (resource) => resource?.effectiveDateTime ?? resource?.effectivePeriod?.start ?? resource?.issued ?? null,
  })
}

function transformWeightObservations(bundle) {
  return transformSimpleObservationSeries(bundle, {
    seriesKey: 'weight',
    getDate: (resource) => resource?.effectiveDateTime ?? null,
    getUnit: () => 'lb',
    normalizeValue: (value, resource) => {
      const unitRaw = resource?.valueQuantity?.unit
      const unit = unitRaw && String(unitRaw).trim() ? String(unitRaw).trim().toLowerCase() : ''
      const code = resource?.valueQuantity?.code && String(resource.valueQuantity.code).trim()
        ? String(resource.valueQuantity.code).trim().toLowerCase()
        : ''
      const system = resource?.valueQuantity?.system && String(resource.valueQuantity.system).trim()
        ? String(resource.valueQuantity.system).trim().toLowerCase()
        : ''
      const isKg =
        unit === 'kg' ||
        unit === 'kgs' ||
        unit === 'kilogram' ||
        unit === 'kilograms' ||
        code === 'kg' ||
        code === 'kilogram' ||
        (system === 'http://unitsofmeasure.org' && code === 'kg')
      return isKg ? value * 2.2046226218 : value
    },
  })
}

function transformHeartRateObservations(bundle) {
  return transformSimpleObservationSeries(bundle, {
    seriesKey: 'heartRate',
    getDate: (resource) => resource?.effectiveDateTime ?? null,
    getUnit: (resource) => {
      const unitRaw = resource?.valueQuantity?.unit
      return unitRaw && String(unitRaw).trim() ? String(unitRaw).trim() : 'bpm'
    },
  })
}

function transformTemperatureObservations(bundle) {
  return transformSimpleObservationSeries(bundle, {
    seriesKey: 'temperature',
    getDate: (resource) => resource?.effectiveDateTime ?? null,
    getUnit: () => '°F',
    normalizeValue: (value, resource) => {
      const unitRaw = resource?.valueQuantity?.unit
      const unit = unitRaw && String(unitRaw).trim() ? String(unitRaw).trim().toLowerCase() : ''
      const code = resource?.valueQuantity?.code && String(resource.valueQuantity.code).trim()
        ? String(resource.valueQuantity.code).trim().toLowerCase()
        : ''
      const system = resource?.valueQuantity?.system && String(resource.valueQuantity.system).trim()
        ? String(resource.valueQuantity.system).trim().toLowerCase()
        : ''
      const isCelsius =
        unit === 'c' ||
        unit === '°c' ||
        unit === 'degc' ||
        unit === 'celsius' ||
        code === 'cel' ||
        code === 'degc' ||
        (system === 'http://unitsofmeasure.org' && code === 'cel')
      return isCelsius ? (value * 9) / 5 + 32 : value
    },
  })
}

function useSimpleVitalSeries(patientId, { getUrl, transform, missingIdError, fetchErrorLabel }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState([])
  const resourceUrl = getUrl(patientId)

  useEffect(() => {
    if (!patientId) {
      setData([])
      setError('')
      setLoading(false)
      return
    }

    let cancelled = false
    async function fetchSeries() {
      setLoading(true)
      setError('')

      if (!resourceUrl) {
        setData([])
        setError(missingIdError)
        setLoading(false)
        return
      }

      try {
        const response = await fetch(resourceUrl, {
          headers: { Accept: 'application/fhir+json' },
        })
        if (!response.ok) {
          throw new Error(`${fetchErrorLabel}: ${response.status}`)
        }
        const bundle = await response.json()
        const transformed = transform(bundle)
        if (!cancelled) setData(transformed)
      } catch (err) {
        if (!cancelled) {
          setData([])
          setError(err.message || `Could not load ${fetchErrorLabel.toLowerCase().replace(' request failed', '')}.`)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSeries()
    return () => {
      cancelled = true
    }
  }, [patientId, resourceUrl, transform, missingIdError, fetchErrorLabel])

  return { loading, error, data, resourceUrl }
}

function getLatestBmiStatus(data) {
  if (!Array.isArray(data) || data.length === 0) return null
  const latest = data[data.length - 1]
  const bmi = Number(latest?.bmi)
  if (!Number.isFinite(bmi)) return null
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25) return 'Healthy'
  if (bmi < 30) return 'Overweight'
  return 'Obesity'
}

function getLatestBloodPressureStatus(data) {
  if (!Array.isArray(data) || data.length === 0) return null
  const latest = data[data.length - 1]
  const systolic = Number(latest?.systolic)
  const diastolic = Number(latest?.diastolic)
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null

  if (systolic >= 140 || diastolic >= 90) return 'Stage 2 Hypertension'
  if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) return 'Stage 1 Hypertension'
  if (systolic >= 120 && systolic <= 129 && diastolic < 80) return 'Elevated'
  if (systolic < 120 && diastolic < 80) return 'Normal'
  return null
}

function getLatestBloodPressureValue(data) {
  if (!Array.isArray(data) || data.length === 0) return null
  const latest = data[data.length - 1]
  const systolic = Number(latest?.systolic)
  const diastolic = Number(latest?.diastolic)
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null
  return { systolic, diastolic }
}

function getLatestDataPoint(data) {
  return Array.isArray(data) && data.length > 0 ? data[data.length - 1] : null
}

function getLatestNumericValue(data, key) {
  const latest = getLatestDataPoint(data)
  const value = Number(latest?.[key])
  return Number.isFinite(value) ? value : null
}

function getLatestNumericWithUnit(data, key, defaultUnit = null) {
  const latest = getLatestDataPoint(data)
  const value = Number(latest?.[key])
  if (!Number.isFinite(value)) return null
  const rawUnit = latest?.unit
  const unit = rawUnit && String(rawUnit).trim() ? String(rawUnit).trim() : defaultUnit
  return { value, unit }
}

function getLatestDate(data) {
  const latest = getLatestDataPoint(data)
  const value = latest?.date
  return value && String(value).trim() ? String(value) : null
}

function getLatestVitalsAsOfDate(...dates) {
  const validDates = dates
    .filter((d) => d && String(d).trim())
    .map((d) => String(d).trim())
    .filter((d) => !Number.isNaN(new Date(d).getTime()))
  if (validDates.length === 0) return null
  return validDates.reduce((latest, current) =>
    new Date(current).getTime() > new Date(latest).getTime() ? current : latest,
  )
}

function getLatestWeightValue(data) {
  const latest = getLatestNumericWithUnit(data, 'weight')
  return latest ? { weight: latest.value, unit: latest.unit } : null
}

function getLatestHeartRateValue(data) {
  const latest = getLatestNumericWithUnit(data, 'heartRate', 'bpm')
  return latest ? { heartRate: latest.value, unit: latest.unit } : null
}

function getLatestTemperatureValue(data) {
  const latest = getLatestNumericWithUnit(data, 'temperature')
  return latest ? { temperature: latest.value, unit: latest.unit } : null
}

export function PatientDashboardPage() {
  const { patientId } = useParams()
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bpLoading, setBpLoading] = useState(false)
  const [bpError, setBpError] = useState('')
  const [bpData, setBpData] = useState([])

  useEffect(() => {
    let cancelled = false
    setPatient(null)
    setError('')
    setLoading(true)

    const id = patientId ? decodeURIComponent(patientId) : ''
    if (!id.trim()) {
      setLoading(false)
      setError('Missing patient ID.')
      return () => {
        cancelled = true
      }
    }

    const url = `${BASE_URL}/Patient/${encodeURIComponent(id.trim())}`

    fetch(url, {
      headers: { Accept: 'application/fhir+json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Patient request failed: ${response.status}`)
        }
        return response.json()
      })
      .then((resource) => {
        if (cancelled) return
        if (resource?.resourceType !== 'Patient') {
          setError('Response was not a Patient resource.')
          setPatient(null)
          return
        }
        setPatient(resource)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not load patient.')
          setPatient(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [patientId])

  useEffect(() => {
    const id = patient?.id
    if (!id) {
      setBpData([])
      setBpError('')
      setBpLoading(false)
      return
    }

    let cancelled = false
    async function fetchBloodPressureObservations() {
      setBpLoading(true)
      setBpError('')

      const url = bloodPressureObservationUrl(id)
      if (!url) {
        setBpData([])
        setBpError('Missing patient ID for blood pressure query.')
        setBpLoading(false)
        return
      }

      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/fhir+json' },
        })
        if (!response.ok) {
          throw new Error(`Blood pressure request failed: ${response.status}`)
        }

        const bundle = await response.json()
        const transformed = transformBloodPressureObservations(bundle)
        if (!cancelled) setBpData(transformed)
      } catch (err) {
        if (!cancelled) {
          setBpData([])
          setBpError(err.message || 'Could not load blood pressure observations.')
        }
      } finally {
        if (!cancelled) setBpLoading(false)
      }
    }

    fetchBloodPressureObservations()
    return () => {
      cancelled = true
    }
  }, [patient?.id])

  const {
    loading: bmiLoading,
    error: bmiError,
    data: bmiData,
    resourceUrl: bmiResourceUrl,
  } = useSimpleVitalSeries(patient?.id, {
    getUrl: bmiObservationUrl,
    transform: transformBmiObservations,
    missingIdError: 'Missing patient ID for BMI query.',
    fetchErrorLabel: 'BMI request failed',
  })

  const {
    loading: weightLoading,
    error: weightError,
    data: weightData,
    resourceUrl: weightResourceUrl,
  } = useSimpleVitalSeries(patient?.id, {
    getUrl: weightObservationUrl,
    transform: transformWeightObservations,
    missingIdError: 'Missing patient ID for weight query.',
    fetchErrorLabel: 'Weight request failed',
  })

  const {
    loading: heartRateLoading,
    error: heartRateError,
    data: heartRateData,
    resourceUrl: heartRateResourceUrl,
  } = useSimpleVitalSeries(patient?.id, {
    getUrl: heartRateObservationUrl,
    transform: transformHeartRateObservations,
    missingIdError: 'Missing patient ID for heart rate query.',
    fetchErrorLabel: 'Heart rate request failed',
  })

  const {
    loading: temperatureLoading,
    error: temperatureError,
    data: temperatureData,
    resourceUrl: temperatureResourceUrl,
  } = useSimpleVitalSeries(patient?.id, {
    getUrl: temperatureObservationUrl,
    transform: transformTemperatureObservations,
    missingIdError: 'Missing patient ID for temperature query.',
    fetchErrorLabel: 'Temperature request failed',
  })

  const bpResourceUrl = bloodPressureObservationUrl(patient?.id)
  const latestBmiStatus = getLatestBmiStatus(bmiData)
  const latestBpStatus = getLatestBloodPressureStatus(bpData)
  const latestBmiValue = getLatestNumericValue(bmiData, 'bmi')
  const latestBpValue = getLatestBloodPressureValue(bpData)
  const latestWeightValue = getLatestWeightValue(weightData)
  const latestHeartRateValue = getLatestHeartRateValue(heartRateData)
  const latestTemperatureValue = getLatestTemperatureValue(temperatureData)
  const latestBmiDate = getLatestDate(bmiData)
  const latestBpDate = getLatestDate(bpData)
  const latestWeightDate = getLatestDate(weightData)
  const latestHeartRateDate = getLatestDate(heartRateData)
  const latestTemperatureDate = getLatestDate(temperatureData)
  const latestVitalsAsOfDate = getLatestVitalsAsOfDate(
    latestBmiDate,
    latestBpDate,
    latestWeightDate,
    latestHeartRateDate,
    latestTemperatureDate,
  )
  const rowDates = [latestBmiDate, latestBpDate, latestWeightDate, latestHeartRateDate, latestTemperatureDate].filter(Boolean)
  const shouldShowRowDates = rowDates.some((date) => date !== latestVitalsAsOfDate)

  return (
    <main className="main main--wide patient-dashboard-main">
      <nav className="patient-dashboard__nav" aria-label="Breadcrumb">
        <Link to="/" className="patient-dashboard__back-link">
          ← Back to search
        </Link>
      </nav>

      <h2 className="dashboard-title">Patient dashboard</h2>
      <p className="dashboard-lead muted">
        Loaded with <code>GET {BASE_URL}/Patient/{patientId ?? '…'}</code>
      </p>

      {loading && <p className="muted">Loading patient…</p>}
      {error && !loading && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && patient && (
        <>
          <section className="patient-dashboard__profile" aria-label="Patient profile">
            <PatientCard patient={patient} />
          </section>

          <section className="patient-dashboard__latest-vitals" aria-labelledby="latest-vitals-heading">
            <h3 id="latest-vitals-heading" className="patient-dashboard__section-title">
              Latest Vitals{latestVitalsAsOfDate ? ` (as of ${latestVitalsAsOfDate})` : ''}
            </h3>
            <dl className="latest-vitals-list">
              <div className="latest-vitals-item">
                <dt>BMI:</dt>
                <dd>
                  {latestBmiValue != null
                    ? `${latestBmiValue.toFixed(1)}${
                        shouldShowRowDates && latestBmiDate ? ` (${latestBmiDate})` : ''
                      }`
                    : 'No data'}
                </dd>
              </div>
              <div className="latest-vitals-item">
                <dt>Blood Pressure:</dt>
                <dd>
                  {latestBpValue
                    ? `${Math.round(latestBpValue.systolic)}/${Math.round(latestBpValue.diastolic)}${
                        shouldShowRowDates && latestBpDate ? ` (${latestBpDate})` : ''
                      }`
                    : 'No data'}
                </dd>
              </div>
              <div className="latest-vitals-item">
                <dt>Weight:</dt>
                <dd>
                  {latestWeightValue
                    ? `${latestWeightValue.weight.toFixed(1)}${latestWeightValue.unit ? ` ${latestWeightValue.unit}` : ''}${
                        shouldShowRowDates && latestWeightDate ? ` (${latestWeightDate})` : ''
                      }`
                    : 'No data'}
                </dd>
              </div>
              <div className="latest-vitals-item">
                <dt>Heart Rate:</dt>
                <dd>
                  {latestHeartRateValue
                    ? `${Math.round(latestHeartRateValue.heartRate)}${
                        latestHeartRateValue.unit ? ` ${latestHeartRateValue.unit}` : ''
                      }${shouldShowRowDates && latestHeartRateDate ? ` (${latestHeartRateDate})` : ''}`
                    : 'No data'}
                </dd>
              </div>
              <div className="latest-vitals-item">
                <dt>Temperature:</dt>
                <dd>
                  {latestTemperatureValue
                    ? `${latestTemperatureValue.temperature.toFixed(1)}${
                        latestTemperatureValue.unit ? ` ${latestTemperatureValue.unit}` : ''
                      }${shouldShowRowDates && latestTemperatureDate ? ` (${latestTemperatureDate})` : ''}`
                    : 'No data'}
                </dd>
              </div>
            </dl>
            {shouldShowRowDates && (
              <p className="latest-vitals-note muted">Some vitals are from different dates.</p>
            )}
          </section>

          <section className="patient-dashboard__section" aria-labelledby="bp-heading">
            <h3 id="bp-heading" className="patient-dashboard__section-title">
              Blood Pressure
            </h3>
            <p className="patient-dashboard__context muted">
              Blood pressure measures the force of blood against artery walls. Systolic is the pressure when the heart
              beats, and diastolic is the pressure between beats. Hypertension means blood pressure is persistently
              elevated over time, which can increase cardiovascular risk.
            </p>
            {latestBpStatus && !bpLoading && !bpError && (
              <p className="patient-dashboard__status">
                Current Blood Pressure status:{' '}
                <span className="patient-dashboard__status-badge">{latestBpStatus}</span>
              </p>
            )}
            {bpLoading && <p className="muted">Loading blood pressure observations…</p>}
            {bpError && (
              <p className="error-text" role="alert">
                {bpError}
              </p>
            )}
            {!bpLoading && !bpError && bpData.length === 0 && (
              <div className="patient-dashboard__placeholder muted">
                No blood pressure observations were found for this patient.
              </div>
            )}
            {!bpLoading && !bpError && bpData.length > 0 && (
              <>
                <div className="bmi-chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={bpData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <ReferenceArea
                        y1={0}
                        y2={79.999}
                        fill="var(--range-neutral-fill)"
                        stroke="var(--range-neutral-stroke)"
                        strokeOpacity={0.6}
                        strokeWidth={1}
                        ifOverflow="extendDomain"
                      />
                      <ReferenceArea
                        y1={80}
                        y2={89.999}
                        fill="var(--range-warn-fill)"
                        stroke="var(--range-warn-stroke)"
                        strokeOpacity={0.65}
                        strokeWidth={1}
                        ifOverflow="extendDomain"
                      />
                      <ReferenceArea
                        y1={90}
                        y2={240}
                        fill="var(--range-danger-fill)"
                        stroke="var(--range-danger-stroke)"
                        strokeOpacity={0.65}
                        strokeWidth={1}
                        ifOverflow="extendDomain"
                      />
                      <ReferenceArea
                        y1={120}
                        y2={129.999}
                        fill="var(--range-warn-soft-fill)"
                        stroke="var(--range-warn-stroke)"
                        strokeOpacity={0.5}
                        strokeWidth={1}
                        ifOverflow="extendDomain"
                      />
                      <ReferenceArea
                        y1={130}
                        y2={240}
                        fill="var(--range-danger-soft-fill)"
                        stroke="var(--range-danger-stroke)"
                        strokeOpacity={0.5}
                        strokeWidth={1}
                        ifOverflow="extendDomain"
                      />
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="systolic" stroke="#c81e1e" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="diastolic" stroke="#155eef" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="chart-legend" aria-label="Blood pressure chart legend">
                  <span className="chart-legend__item">
                    <span className="chart-legend__swatch chart-legend__swatch--systolic" aria-hidden="true" />
                    Systolic line
                  </span>
                  <span className="chart-legend__item">
                    <span className="chart-legend__swatch chart-legend__swatch--diastolic" aria-hidden="true" />
                    Diastolic line
                  </span>
                  <span className="chart-legend__item">
                    <span className="chart-legend__swatch chart-legend__swatch--normal" aria-hidden="true" />
                    Normal zone
                  </span>
                  <span className="chart-legend__item">
                    <span className="chart-legend__swatch chart-legend__swatch--elevated" aria-hidden="true" />
                    Elevated / Stage 1 zone
                  </span>
                  <span className="chart-legend__item">
                    <span className="chart-legend__swatch chart-legend__swatch--stage2" aria-hidden="true" />
                    Stage 2 zone
                  </span>
                </p>
                <p className="patient-dashboard__hint muted">
                  Blood Pressure Observation URL:{' '}
                  {bpResourceUrl ? (
                    <a
                      href={bpResourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="patient-dashboard__resource-link"
                      title="Opens blood pressure Observation bundle on the FHIR server in a new tab"
                    >
                      <code className="patient-dashboard__resource-code">{bpResourceUrl}</code>
                      <ExternalLinkIcon />
                      <span className="visually-hidden"> (opens in new tab)</span>
                    </a>
                  ) : (
                    <code>Unknown</code>
                  )}
                </p>
              </>
            )}
          </section>

          <section className="patient-dashboard__section" aria-labelledby="bmi-heading">
            <h3 id="bmi-heading" className="patient-dashboard__section-title">
              BMI
            </h3>
            <p className="patient-dashboard__context muted">
              Body Mass Index (BMI) is a screening measure based on weight relative to height. It is useful for
              tracking general weight-related trends over time.
            </p>
            {latestBmiStatus && !bmiLoading && !bmiError && (
              <p className="patient-dashboard__status">
                Current BMI status: <span className="patient-dashboard__status-badge">{latestBmiStatus}</span>
              </p>
            )}
            {bmiLoading && <p className="muted">Loading BMI observations…</p>}
            {bmiError && (
              <p className="error-text" role="alert">
                {bmiError}
              </p>
            )}
            {!bmiLoading && !bmiError && bmiData.length === 0 && (
              <div className="patient-dashboard__placeholder muted">
                No BMI observations were found for this patient.
              </div>
            )}
            {!bmiLoading && !bmiError && bmiData.length > 0 && (
              <>
                <div className="bmi-chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={bmiData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <ReferenceArea
                        y1={0}
                        y2={18.499}
                        fill="var(--range-neutral-fill)"
                        stroke="var(--range-neutral-stroke)"
                        strokeOpacity={0.6}
                        strokeWidth={1}
                        ifOverflow="extendDomain"
                      />
                      <ReferenceArea
                        y1={18.5}
                        y2={24.999}
                        fill="var(--range-neutral-soft-fill)"
                        stroke="var(--range-neutral-stroke)"
                        strokeOpacity={0.45}
                        strokeWidth={1}
                        ifOverflow="extendDomain"
                      />
                      <ReferenceArea
                        y1={25}
                        y2={29.999}
                        fill="var(--range-warn-fill)"
                        stroke="var(--range-warn-stroke)"
                        strokeOpacity={0.65}
                        strokeWidth={1}
                        ifOverflow="extendDomain"
                      />
                      <ReferenceArea
                        y1={30}
                        y2={80}
                        fill="var(--range-danger-fill)"
                        stroke="var(--range-danger-stroke)"
                        strokeOpacity={0.65}
                        strokeWidth={1}
                        ifOverflow="extendDomain"
                      />
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis dataKey="bmi" />
                      <Tooltip />
                      <Line type="monotone" dataKey="bmi" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="chart-legend" aria-label="BMI chart legend">
                  <span className="chart-legend__item">
                    <span className="chart-legend__swatch chart-legend__swatch--bmi" aria-hidden="true" />
                    BMI line
                  </span>
                  <span className="chart-legend__item">
                    <span className="chart-legend__swatch chart-legend__swatch--normal" aria-hidden="true" />
                    Underweight / Healthy zone
                  </span>
                  <span className="chart-legend__item">
                    <span className="chart-legend__swatch chart-legend__swatch--elevated" aria-hidden="true" />
                    Overweight zone
                  </span>
                  <span className="chart-legend__item">
                    <span className="chart-legend__swatch chart-legend__swatch--stage2" aria-hidden="true" />
                    Obesity zone
                  </span>
                </p>
                <p className="patient-dashboard__hint muted">
                  BMI Observation URL:{' '}
                  {bmiResourceUrl ? (
                    <a
                      href={bmiResourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="patient-dashboard__resource-link"
                      title="Opens BMI Observation bundle on the FHIR server in a new tab"
                    >
                      <code className="patient-dashboard__resource-code">{bmiResourceUrl}</code>
                      <ExternalLinkIcon />
                      <span className="visually-hidden"> (opens in new tab)</span>
                    </a>
                  ) : (
                    <code>Unknown</code>
                  )}
                </p>
              </>
            )}
          </section>

          <section className="patient-dashboard__section" aria-labelledby="weight-heading">
            <h3 id="weight-heading" className="patient-dashboard__section-title">
              Weight
            </h3>
            <p className="patient-dashboard__context muted">
              Body weight tracks changes over time and can help show broader health trends, especially when viewed
              alongside BMI.
            </p>
            <p className="patient-dashboard__context muted">
              Weight should be interpreted in context, including height, body composition, and overall trend.
            </p>
            {latestWeightValue && !weightLoading && !weightError && (
              <p className="patient-dashboard__status">
                Current weight:{' '}
                <span className="patient-dashboard__status-badge">
                  {latestWeightValue.weight.toFixed(1)}
                  {latestWeightValue.unit ? ` ${latestWeightValue.unit}` : ''}
                </span>
              </p>
            )}
            {weightLoading && <p className="muted">Loading weight observations…</p>}
            {weightError && (
              <p className="error-text" role="alert">
                {weightError}
              </p>
            )}
            {!weightLoading && !weightError && weightData.length === 0 && (
              <div className="patient-dashboard__placeholder muted">
                No weight observations were found for this patient.
              </div>
            )}
            {!weightLoading && !weightError && weightData.length > 0 && (
              <>
                <div className="bmi-chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={weightData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis dataKey="weight" />
                      <Tooltip
                        formatter={(value, _name, props) => {
                          const numeric = Number(value)
                          const unit = props?.payload?.unit
                          if (!Number.isFinite(numeric)) return [String(value), 'Weight']
                          return [
                            `${numeric.toFixed(1)}${unit && String(unit).trim() ? ` ${String(unit).trim()}` : ''}`,
                            'Weight',
                          ]
                        }}
                      />
                      <Line type="monotone" dataKey="weight" stroke="#0a7f5a" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="chart-legend" aria-label="Weight chart legend">
                  <span className="chart-legend__item">
                    <span className="chart-legend__swatch chart-legend__swatch--weight" aria-hidden="true" />
                    Weight line
                  </span>
                </p>
                <p className="patient-dashboard__hint muted">
                  Weight Observation URL:{' '}
                  {weightResourceUrl ? (
                    <a
                      href={weightResourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="patient-dashboard__resource-link"
                      title="Opens weight Observation bundle on the FHIR server in a new tab"
                    >
                      <code className="patient-dashboard__resource-code">{weightResourceUrl}</code>
                      <ExternalLinkIcon />
                      <span className="visually-hidden"> (opens in new tab)</span>
                    </a>
                  ) : (
                    <code>Unknown</code>
                  )}
                </p>
              </>
            )}
          </section>

          <section className="patient-dashboard__section" aria-labelledby="heart-rate-heading">
            <h3 id="heart-rate-heading" className="patient-dashboard__section-title">
              Heart Rate
            </h3>
            <p className="patient-dashboard__context muted">
              Heart rate measures how many times the heart beats per minute. Tracking it over time can help show
              changes in cardiovascular status and overall physiological condition.
            </p>
            <p className="patient-dashboard__context muted">
              Typical adult resting heart rate is often around 60-100 bpm, but interpretation depends on activity,
              health status, and context.
            </p>
            {latestHeartRateValue && !heartRateLoading && !heartRateError && (
              <p className="patient-dashboard__status">
                Current heart rate:{' '}
                <span className="patient-dashboard__status-badge">
                  {Math.round(latestHeartRateValue.heartRate)}
                  {latestHeartRateValue.unit ? ` ${latestHeartRateValue.unit}` : ''}
                </span>
              </p>
            )}
            {heartRateLoading && <p className="muted">Loading heart rate observations…</p>}
            {heartRateError && (
              <p className="error-text" role="alert">
                {heartRateError}
              </p>
            )}
            {!heartRateLoading && !heartRateError && heartRateData.length === 0 && (
              <div className="patient-dashboard__placeholder muted">
                No heart rate observations were found for this patient.
              </div>
            )}
            {!heartRateLoading && !heartRateError && heartRateData.length > 0 && (
              <>
                <div className="bmi-chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={heartRateData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis dataKey="heartRate" />
                      <Tooltip
                        formatter={(value, _name, props) => {
                          const numeric = Number(value)
                          const unit = props?.payload?.unit
                          if (!Number.isFinite(numeric)) return [String(value), 'Heart Rate']
                          return [
                            `${Math.round(numeric)}${unit && String(unit).trim() ? ` ${String(unit).trim()}` : ''}`,
                            'Heart Rate',
                          ]
                        }}
                      />
                      <Line type="monotone" dataKey="heartRate" stroke="#be185d" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="chart-legend" aria-label="Heart rate chart legend">
                  <span className="chart-legend__item">
                    <span className="chart-legend__swatch chart-legend__swatch--heart-rate" aria-hidden="true" />
                    Heart rate line
                  </span>
                </p>
                <p className="patient-dashboard__hint muted">
                  Heart Rate Observation URL:{' '}
                  {heartRateResourceUrl ? (
                    <a
                      href={heartRateResourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="patient-dashboard__resource-link"
                      title="Opens heart rate Observation bundle on the FHIR server in a new tab"
                    >
                      <code className="patient-dashboard__resource-code">{heartRateResourceUrl}</code>
                      <ExternalLinkIcon />
                      <span className="visually-hidden"> (opens in new tab)</span>
                    </a>
                  ) : (
                    <code>Unknown</code>
                  )}
                </p>
              </>
            )}
          </section>

          <section className="patient-dashboard__section" aria-labelledby="temperature-heading">
            <h3 id="temperature-heading" className="patient-dashboard__section-title">
              Temperature
            </h3>
            <p className="patient-dashboard__context muted">
              Body temperature helps show whether a patient is within a typical range or may have signs of fever or
              other physiological change.
            </p>
            <p className="patient-dashboard__context muted">
              Typical adult temperature is often around 97°F to 99°F, though interpretation depends on method, timing,
              and clinical context.
            </p>
            {latestTemperatureValue && !temperatureLoading && !temperatureError && (
              <p className="patient-dashboard__status">
                Current temperature:{' '}
                <span className="patient-dashboard__status-badge">
                  {latestTemperatureValue.temperature.toFixed(1)}
                  {latestTemperatureValue.unit ? ` ${latestTemperatureValue.unit}` : ''}
                </span>
              </p>
            )}
            {temperatureLoading && <p className="muted">Loading temperature observations…</p>}
            {temperatureError && (
              <p className="error-text" role="alert">
                {temperatureError}
              </p>
            )}
            {!temperatureLoading && !temperatureError && temperatureData.length === 0 && (
              <div className="patient-dashboard__placeholder muted">
                No temperature observations were found for this patient.
              </div>
            )}
            {!temperatureLoading && !temperatureError && temperatureData.length > 0 && (
              <>
                <div className="bmi-chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={temperatureData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis dataKey="temperature" />
                      <Tooltip
                        formatter={(value, _name, props) => {
                          const numeric = Number(value)
                          const unit = props?.payload?.unit
                          if (!Number.isFinite(numeric)) return [String(value), 'Temperature']
                          return [
                            `${numeric.toFixed(1)}${unit && String(unit).trim() ? ` ${String(unit).trim()}` : ''}`,
                            'Temperature',
                          ]
                        }}
                      />
                      <Line type="monotone" dataKey="temperature" stroke="#ea580c" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="chart-legend" aria-label="Temperature chart legend">
                  <span className="chart-legend__item">
                    <span className="chart-legend__swatch chart-legend__swatch--temperature" aria-hidden="true" />
                    Temperature line
                  </span>
                </p>
                <p className="patient-dashboard__hint muted">
                  Temperature Observation URL:{' '}
                  {temperatureResourceUrl ? (
                    <a
                      href={temperatureResourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="patient-dashboard__resource-link"
                      title="Opens temperature Observation bundle on the FHIR server in a new tab"
                    >
                      <code className="patient-dashboard__resource-code">{temperatureResourceUrl}</code>
                      <ExternalLinkIcon />
                      <span className="visually-hidden"> (opens in new tab)</span>
                    </a>
                  ) : (
                    <code>Unknown</code>
                  )}
                </p>
              </>
            )}
          </section>
        </>
      )}
    </main>
  )
}
