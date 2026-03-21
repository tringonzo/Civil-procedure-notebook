/**
 * Keyword search across loaded source chunks.
 * Returns scored results with highlight positions.
 */

// Common words excluded from individual term scoring so they don't inflate results
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'not', 'no', 'nor', 'so',
  'if', 'as', 'up', 'it', 'its', 'that', 'this', 'which', 'who', 'whom'
])

export function search(query, chunks, options = {}) {
  const { source = 'both', limit = 10 } = options

  if (!query.trim() || !chunks.length) return []

  const phrase = query.toLowerCase().trim()
  const isMultiWord = phrase.includes(' ')

  // All tokens for fallback word matching
  const allTerms = phrase
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9§]/g, ''))
    .filter(t => t.length >= 2)

  // Filter stop words so common words don't inflate individual word scores
  const meaningfulTerms = allTerms.filter(t => !STOP_WORDS.has(t))
  const scoringTerms = meaningfulTerms.length ? meaningfulTerms : allTerms

  if (!scoringTerms.length) return []

  const pool =
    source === 'both'
      ? chunks
      : chunks.filter(c => c.source.toLowerCase() === source.toLowerCase())

  const scored = pool.map(chunk => {
    const lower = chunk.text.toLowerCase()
    let score = 0
    const positions = []

    // Exact phrase match — heavily weighted so it always outranks individual word hits
    if (isMultiWord && lower.includes(phrase)) {
      score += 100
      let idx = lower.indexOf(phrase)
      while (idx !== -1) {
        score += 10
        positions.push({ term: phrase, start: idx, end: idx + phrase.length })
        idx = lower.indexOf(phrase, idx + 1)
      }
    }

    // Individual meaningful term matching (stop words excluded)
    for (const term of scoringTerms) {
      let idx = lower.indexOf(term)
      while (idx !== -1) {
        score += 1
        positions.push({ term, start: idx, end: idx + term.length })
        idx = lower.indexOf(term, idx + 1)
      }
    }

    // Boost if rule numbers appear
    if (/rule\s+\d|§\s*\d|\b\d+\(\w+\)/i.test(chunk.text)) {
      score += 1
    }

    return { ...chunk, score, positions }
  })

  return scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Returns the most relevant chunks for a given query,
 * formatted for injection into Claude's system prompt.
 */
export function getRelevantChunks(query, chunks, options = {}) {
  const { source = 'both', limit = 6 } = options
  const results = search(query, chunks, { source, limit })
  return results.map(r => ({
    text: r.text,
    source: r.source,
    provider: r.provider,
  }))
}

/**
 * Highlight matched terms in a text string.
 * Returns HTML string with <mark> tags.
 * Pass phrase to highlight the full phrase as a unit before individual words.
 */
export function highlightText(text, terms, phrase = null) {
  if (!terms || !terms.length) return escapeHtml(text)

  const patterns = []

  // Add full phrase first so it highlights as a unit (not broken into words)
  if (phrase && phrase.includes(' ')) {
    patterns.push(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  }

  // Add individual terms after
  terms.forEach(t => patterns.push(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  return escapeHtml(text).replace(
    new RegExp(`(${patterns.join('|')})`, 'gi'),
    '<mark>$1</mark>'
  )
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Get a short excerpt around the first match.
 * Prefers centering on the full phrase match if present.
 */
export function getExcerpt(text, terms, maxLen = 300, phrase = null) {
  if (!terms.length) return text.slice(0, maxLen)

  const lower = text.toLowerCase()

  // Try to center on the full phrase first, fall back to first individual term
  const searchFor = phrase && lower.includes(phrase) ? phrase : terms[0]
  const idx = lower.indexOf(searchFor)

  if (idx === -1) return text.slice(0, maxLen)

  const start = Math.max(0, idx - 80)
  const end = Math.min(text.length, idx + maxLen - 80)
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
}
