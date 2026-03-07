import { useState, useEffect } from 'react'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

/**
 * Load a pre-generated JSON file from public/data/.
 * Returns { data, loading, error }.
 */
export function useData(filename) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${BASE}/data/${filename}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading ${filename}`)
        return r.json()
      })
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })

    return () => { cancelled = true }
  }, [filename])

  return { data, loading, error }
}
