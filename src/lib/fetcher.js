const SOURCES = {
  frcp: {
    url: 'https://www.law.cornell.edu/rules/frcp',
    name: 'FRCP',
    fullName: 'Federal Rules of Civil Procedure',
    provider: 'Cornell LII',
    cacheKey: 'cpn_chunks_frcp_v2',
    cacheTimeKey: 'cpn_time_frcp_v2',
  },
  cplr: {
    url: 'https://law.justia.com/codes/new-york/cvp/',
    name: 'CPLR',
    fullName: 'New York Civil Practice Law and Rules',
    provider: 'Justia',
    cacheKey: 'cpn_chunks_cplr_v2',
    cacheTimeKey: 'cpn_time_cplr_v2',
  },
}

const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const CHUNK_WORDS = 500
const OVERLAP_WORDS = 50

// CORS proxy options — tried in order
const PROXY_FNS = [
  (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
]

async function fetchViaProxy(sourceUrl) {
  let lastError

  for (const proxyFn of PROXY_FNS) {
    try {
      const proxyUrl = proxyFn(sourceUrl)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 20000)

      const resp = await fetch(proxyUrl, { signal: controller.signal })
      clearTimeout(timer)

      if (!resp.ok) throw new Error(`HTTP ${resp.status} from proxy`)

      const contentType = resp.headers.get('content-type') || ''

      if (contentType.includes('application/json')) {
        const data = await resp.json()
        // allorigins format
        if (data.contents !== undefined) return String(data.contents)
        // codetabs format
        if (typeof data === 'string') return data
        throw new Error('Unknown JSON proxy format')
      }

      // corsproxy.io returns raw HTML
      return await resp.text()
    } catch (e) {
      lastError = e
      if (e.name === 'AbortError') lastError = new Error('Request timed out')
    }
  }

  throw lastError || new Error('All CORS proxies failed')
}

function extractText(html) {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Remove noise elements
    const noiseSelectors = [
      'script', 'style', 'nav', 'header', 'footer', 'noscript',
      '.advertisement', '.sidebar', '.menu', '.nav', '[role="navigation"]',
      '#cookie-banner', '.breadcrumb',
    ]
    noiseSelectors.forEach(sel => {
      doc.querySelectorAll(sel).forEach(el => el.remove())
    })

    const body = doc.body
    if (!body) throw new Error('No body')

    return (body.innerText || body.textContent || '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim()
  } catch {
    // Regex fallback
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
}

function chunkText(text, source) {
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const chunks = []
  let i = 0

  while (i < words.length) {
    const slice = words.slice(i, i + CHUNK_WORDS)
    if (slice.length < 30) break // skip tiny tails

    chunks.push({
      id: `${source.name}_${chunks.length}`,
      text: slice.join(' '),
      source: source.name,
      sourceUrl: source.url,
      provider: source.provider,
      chunkIndex: chunks.length,
    })

    i += CHUNK_WORDS - OVERLAP_WORDS
  }

  return chunks
}

async function loadSource(key) {
  const source = SOURCES[key]

  // Check cache
  const cached = localStorage.getItem(source.cacheKey)
  const cachedTime = localStorage.getItem(source.cacheTimeKey)

  if (cached && cachedTime) {
    const age = Date.now() - parseInt(cachedTime, 10)
    if (age < CACHE_TTL) {
      try {
        const chunks = JSON.parse(cached)
        if (Array.isArray(chunks) && chunks.length > 0) {
          return { chunks, fromCache: true }
        }
      } catch {
        // corrupted cache, re-fetch
      }
    }
  }

  const html = await fetchViaProxy(source.url)
  const text = extractText(html)

  if (!text || text.length < 500) {
    throw new Error(`Retrieved content too short (${text?.length || 0} chars) — source may have blocked the proxy`)
  }

  const chunks = chunkText(text, source)

  // Persist to localStorage (may fail if storage is full)
  try {
    localStorage.setItem(source.cacheKey, JSON.stringify(chunks))
    localStorage.setItem(source.cacheTimeKey, String(Date.now()))
  } catch (storageErr) {
    console.warn('Could not cache source:', storageErr)
  }

  return { chunks, fromCache: false }
}

export async function loadSources() {
  const [frcpResult, cplrResult] = await Promise.allSettled([
    loadSource('frcp'),
    loadSource('cplr'),
  ])

  const chunks = []
  const frcpLoaded = frcpResult.status === 'fulfilled'
  const cplrLoaded = cplrResult.status === 'fulfilled'
  const frcpError = frcpLoaded ? null : (frcpResult.reason?.message || 'Failed')
  const cplrError = cplrLoaded ? null : (cplrResult.reason?.message || 'Failed')

  if (frcpLoaded) chunks.push(...frcpResult.value.chunks)
  if (cplrLoaded) chunks.push(...cplrResult.value.chunks)

  return { chunks, frcpLoaded, cplrLoaded, frcpError, cplrError }
}

export function clearSourceCache() {
  Object.values(SOURCES).forEach(s => {
    localStorage.removeItem(s.cacheKey)
    localStorage.removeItem(s.cacheTimeKey)
  })
}
