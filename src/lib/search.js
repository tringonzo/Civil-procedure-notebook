/**
 * Keyword search across loaded source chunks.
 * Returns scored results with highlight positions.
 */

export function search(query, chunks, options = {}) {
  const { source = 'both', limit = 10 } = options

  if (!query.trim() || !chunks.length) return []

  // Tokenize query — keep terms 2+ chars
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9§]/g, ''))
    .filter(t => t.length >= 2)

  if (!terms.length) return []

  // Filter by source
  const pool =
    source === 'both'
      ? chunks
      : chunks.filter(c => c.source.toLowerCase() === source.toLowerCase())

  const phrase = query.toLowerCase().trim()

  const scored = pool.map(chunk => {
    const lower = chunk.text.toLowerCase()
    let score = 0
    const positions = []

    for (const term of terms) {
      let idx = lower.indexOf(term)
      while (idx !== -1) {
        score += 1
        positions.push({ term, start: idx, end: idx + term.length })
        idx = lower.indexOf(term, idx + 1)
      }
    }

    // Bonus for exact phrase match
    if (terms.length > 1 && lower.includes(phrase)) {
      score += 5
    }

    // Boost if rule numbers appear near query terms
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
 */
export function highlightText(text, terms) {
  if (!terms || !terms.length) return escapeHtml(text)

  const escaped = terms.map(t =>
    t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')

  return escapeHtml(text).replace(
    new RegExp(`(${escaped.join('|')})`, 'gi'),
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
 */
export function getExcerpt(text, terms, maxLen = 300) {
  if (!terms.length) return text.slice(0, maxLen)

  const lower = text.toLowerCase()
  const term = terms[0]
  const idx = lower.indexOf(term)

  if (idx === -1) return text.slice(0, maxLen)

  const start = Math.max(0, idx - 80)
  const end = Math.min(text.length, idx + maxLen - 80)
  const excerpt = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
  return excerpt
}
