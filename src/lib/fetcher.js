// Key FRCP rule pages from Cornell LII
const FRCP_PAGES = [
  'rule_1',  // Scope and Purpose
  'rule_3',  // Commencing an Action
  'rule_4',  // Summons — 90-day service deadline
  'rule_7',  // Pleadings Allowed
  'rule_8',  // General Rules of Pleading
  'rule_9',  // Pleading Special Matters
  'rule_11', // Signing; Sanctions
  'rule_12', // Defenses and Objections (12(b)(6), 12(b)(1))
  'rule_13', // Counterclaim and Crossclaim
  'rule_14', // Third-Party Practice (Impleader)
  'rule_15', // Amended and Supplemental Pleadings
  'rule_17', // Plaintiff and Defendant
  'rule_18', // Joinder of Claims
  'rule_19', // Required Joinder of Parties
  'rule_20', // Permissive Joinder
  'rule_21', // Misjoinder
  'rule_22', // Interpleader
  'rule_23', // Class Actions
  'rule_24', // Intervention
  'rule_26', // Duty to Disclose; Discovery Scope
  'rule_30', // Depositions by Oral Examination
  'rule_33', // Interrogatories
  'rule_34', // Documents and Electronically Stored Information
  'rule_36', // Admissions
  'rule_37', // Failure to Make Disclosures
  'rule_38', // Right to Jury Trial
  'rule_41', // Dismissal of Actions
  'rule_45', // Subpoena
  'rule_50', // Judgment as a Matter of Law (JMOL)
  'rule_52', // Findings by the Court
  'rule_54', // Judgment; Costs
  'rule_55', // Default; Default Judgment
  'rule_56', // Summary Judgment
  'rule_59', // New Trial
  'rule_60', // Relief from Judgment
  'rule_65', // Injunctions
  'rule_68', // Offer of Judgment
].map(r => `https://www.law.cornell.edu/rules/frcp/${r}`)

// Key CPLR sections from Justia
const CPLR_PAGES = [
  'section-301',   // General Jurisdiction
  'section-302',   // Long-Arm Jurisdiction
  'section-306-b', // Service of Process — 120-day deadline
  'section-308',   // Personal Service
  'section-313',   // Service Outside State
  'section-901',   // Class Actions — Prerequisites
  'section-902',   // Order Allowing Class Action
  'section-907',   // Class Action — Notice
  'section-1001',  // Necessary Joinder
  'section-1002',  // Permissive Joinder
  'section-1007',  // Third-Party Practice
  'section-2101',  // Form of Papers
  'section-3001',  // Declaratory Judgment
  'section-3012',  // Service of Pleadings
  'section-3013',  // Specificity of Pleadings
  'section-3014',  // Paragraphs; Causes of Action
  'section-3016',  // Particularity in Specific Actions
  'section-3018',  // Responsive Pleadings; Denials
  'section-3019',  // Counterclaims and Cross-Claims
  'section-3025',  // Amended and Supplemental Pleadings
  'section-3101',  // Scope of Disclosure
  'section-3102',  // Disclosure Devices
  'section-3106',  // Priority of Depositions
  'section-3107',  // Notice of Taking Oral Deposition
  'section-3120',  // Discovery and Inspection of Documents
  'section-3123',  // Admissions
  'section-3126',  // Penalties for Refusal to Disclose
  'section-3211',  // Motion to Dismiss
  'section-3212',  // Summary Judgment
  'section-3215',  // Default Judgment
  'section-3217',  // Discontinuance of Action
  'section-4401',  // Motion for Judgment During Trial
  'section-4404',  // Post-Trial Motion
  'section-5011',  // Judgment
  'section-5015',  // Relief from Judgment
  'section-6301',  // Preliminary Injunction
].map(s => `https://law.justia.com/codes/new-york/cvp/${s}/`)

const SOURCES = {
  frcp: {
    url: 'https://www.law.cornell.edu/rules/frcp',
    name: 'FRCP',
    fullName: 'Federal Rules of Civil Procedure',
    provider: 'Cornell LII',
    cacheKey: 'cpn_chunks_frcp_v3',
    cacheTimeKey: 'cpn_time_frcp_v3',
    // Auto-discover any rule pages found in index, plus always include the list above
    subPagePattern: /^https:\/\/www\.law\.cornell\.edu\/rules\/frcp\/rule_/,
    fixedSubPages: FRCP_PAGES,
    maxSubPages: 10, // additional auto-discovered pages beyond the fixed list
  },
  cplr: {
    url: 'https://law.justia.com/codes/new-york/cvp/',
    name: 'CPLR',
    fullName: 'New York Civil Practice Law and Rules',
    provider: 'Justia',
    cacheKey: 'cpn_chunks_cplr_v3',
    cacheTimeKey: 'cpn_time_cplr_v3',
    subPagePattern: /^https:\/\/law\.justia\.com\/codes\/new-york\/cvp\/.+/,
    fixedSubPages: CPLR_PAGES,
    maxSubPages: 10,
  },
}

const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const CHUNK_WORDS = 500
const OVERLAP_WORDS = 50

// CORS proxy options — tried in order for index pages
const PROXY_FNS = [
  (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
]

// Full proxy chain with fallbacks — for index pages
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
        if (data.contents !== undefined) return String(data.contents)
        if (typeof data === 'string') return data
        throw new Error('Unknown JSON proxy format')
      }

      return await resp.text()
    } catch (e) {
      lastError = e
      if (e.name === 'AbortError') lastError = new Error('Request timed out')
    }
  }

  throw lastError || new Error('All CORS proxies failed')
}

// Fast single-proxy fetch for sub-pages — returns empty string on any failure
async function fetchSubPage(sourceUrl) {
  try {
    const proxyUrl = PROXY_FNS[0](sourceUrl) // allorigins only
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)

    const resp = await fetch(proxyUrl, { signal: controller.signal })
    clearTimeout(timer)

    if (!resp.ok) return ''

    const contentType = resp.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await resp.json()
      return data.contents !== undefined ? String(data.contents) : ''
    }
    return await resp.text()
  } catch {
    return ''
  }
}

// Extract links from raw HTML that match a given URL pattern
function extractSubPageLinks(html, baseUrl, pattern, max) {
  const links = new Set()
  const matches = html.matchAll(/href="([^"#?]+)"/gi)

  for (const [, href] of matches) {
    try {
      const fullUrl = new URL(href, baseUrl).href
      // Must match pattern and must not be the base URL itself
      if (pattern.test(fullUrl) && fullUrl !== baseUrl) {
        links.add(fullUrl)
      }
    } catch {
      // invalid URL, skip
    }
    if (links.size >= max) break
  }

  return [...links]
}

function extractText(html) {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

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
    if (slice.length < 30) break

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
        // corrupted cache — re-fetch
      }
    }
  }

  // Step 1: Fetch index page (need raw HTML for link discovery)
  const indexHtml = await fetchViaProxy(source.url)

  // Step 2: Combine fixed known pages + auto-discovered links from index HTML
  const fixedPages = source.fixedSubPages || []
  const discovered = extractSubPageLinks(
    indexHtml,
    source.url,
    source.subPagePattern,
    source.maxSubPages
  )
  // Merge: fixed pages first, then any auto-discovered ones not already in the list
  const fixedSet = new Set(fixedPages)
  const subPageUrls = [
    ...fixedPages,
    ...discovered.filter(u => !fixedSet.has(u)),
  ]

  // Step 3: Fetch all sub-pages in parallel (failures silently return '')
  const subPageHtmls = await Promise.all(
    subPageUrls.map(url => fetchSubPage(url))
  )

  // Step 4: Extract text from index + all successful sub-pages
  const allTexts = [extractText(indexHtml)]
  for (const html of subPageHtmls) {
    if (html.length > 200) {
      const text = extractText(html)
      if (text.length > 200) allTexts.push(text)
    }
  }

  const combinedText = allTexts.join('\n\n---\n\n')

  if (!combinedText || combinedText.length < 500) {
    throw new Error(`Retrieved content too short — source may have blocked the proxy`)
  }

  const chunks = chunkText(combinedText, source)

  try {
    localStorage.setItem(source.cacheKey, JSON.stringify(chunks))
    localStorage.setItem(source.cacheTimeKey, String(Date.now()))
  } catch (storageErr) {
    console.warn('Could not cache source:', storageErr)
  }

  return { chunks, fromCache: false }
}

export async function loadSources() {
  // Clean up old v2 cache keys to free localStorage space
  const legacyKeys = [
    'cpn_chunks_frcp_v2', 'cpn_time_frcp_v2',
    'cpn_chunks_cplr_v2', 'cpn_time_cplr_v2',
  ]
  legacyKeys.forEach(k => localStorage.removeItem(k))

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
  const legacyKeys = [
    'cpn_chunks_frcp_v2', 'cpn_time_frcp_v2',
    'cpn_chunks_cplr_v2', 'cpn_time_cplr_v2',
  ]
  legacyKeys.forEach(k => localStorage.removeItem(k))
  Object.values(SOURCES).forEach(s => {
    localStorage.removeItem(s.cacheKey)
    localStorage.removeItem(s.cacheTimeKey)
  })
}
