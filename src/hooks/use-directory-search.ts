import { useEffect, useState } from 'react'
import { searchDirectory, type SearchMissionary, type SearchProject } from '@/app/dashboard/feed/search-actions'

const DEBOUNCE_MS = 300

export interface DirectorySearchResults {
  missionaries: SearchMissionary[]
  projects: SearchProject[]
}

const EMPTY_RESULTS: DirectorySearchResults = { missionaries: [], projects: [] }

// Debounce + busca num único effect: o setState só roda dentro do
// callback do setTimeout/then (assíncrono), nunca síncrono no corpo do
// effect — evita o "cascading render" que a regra set-state-in-effect
// do eslint pega quando dispara updates direto na execução do effect.
export function useDirectorySearch(query: string) {
  const [results, setResults] = useState<DirectorySearchResults>(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) { setResults(EMPTY_RESULTS); return }
    let cancelled = false
    const id = setTimeout(() => {
      setLoading(true)
      searchDirectory(trimmed).then((data) => {
        if (!cancelled) {
          setResults(data)
          setLoading(false)
        }
      })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [query])

  const trimmedQuery = query.trim()
  const displayResults = trimmedQuery.length >= 2 ? results : EMPTY_RESULTS
  const hasResults = displayResults.missionaries.length > 0 || displayResults.projects.length > 0

  return { results: displayResults, loading, hasResults, trimmedQuery }
}
