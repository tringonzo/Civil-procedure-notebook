// Anthropic Claude API client — browser-side direct calls
// Get a free key (no credit card) at: console.anthropic.com

const MODEL = 'claude-sonnet-4-20250514'
const API_URL = 'https://api.anthropic.com/v1/messages'
const MAX_CONTEXT_CHUNKS = 8

const SYSTEM_CORE = `You are a legal research assistant for a civil procedure study app.
You have been provided with excerpts from two legal sources:
1. Federal Rules of Civil Procedure (FRCP) — Cornell LII
2. New York Civil Practice Law and Rules (CPLR) — Justia

STRICT RULES:
1. Answer ONLY from the provided source excerpts. Never add outside knowledge.
2. Every answer must include the exact rule number or section cited (e.g. "FRCP Rule 4(m)" or "CPLR § 306-b").
3. Quote the relevant passage briefly (under 15 words) when helpful.
4. If the answer is not found in the provided excerpts, respond exactly: "This answer is not found in the loaded sources."
5. Always identify the source: "Source: FRCP (Cornell LII)" or "Source: CPLR (Justia)".
6. Never invent case names or rule numbers.
7. All responses in English.`

function buildSystemPrompt(chunks, extra = '') {
  if (!chunks || chunks.length === 0) {
    return SYSTEM_CORE + '\n\nNOTE: No source excerpts loaded. Inform the user.' + extra
  }

  const excerpts = chunks
    .slice(0, MAX_CONTEXT_CHUNKS)
    .map(c => `[${c.source} — ${c.provider}]\n${c.text}`)
    .join('\n\n---\n\n')

  return `${SYSTEM_CORE}\n\nSOURCE EXCERPTS:\n${excerpts}${extra}`
}

function getHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

function checkApiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('No API key set. Click "API Key" in the navigation to add yours.')
  }
}

// ─── Streaming Q&A ───────────────────────────────────────────────────────────

export async function askQuestion(question, chunks, apiKey, onChunk) {
  checkApiKey(apiKey)

  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: getHeaders(apiKey),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      stream: true,
      system: buildSystemPrompt(chunks),
      messages: [{ role: 'user', content: question }],
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${resp.status}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') continue

      try {
        const ev = JSON.parse(raw)
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
          fullText += ev.delta.text
          onChunk?.(ev.delta.text, fullText)
        }
      } catch {
        // malformed SSE line — skip
      }
    }
  }

  return fullText
}

// ─── JSON-mode helper ────────────────────────────────────────────────────────

async function callClaudeJSON(userPrompt, chunks, apiKey, maxTokens = 2500) {
  checkApiKey(apiKey)

  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: getHeaders(apiKey),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: buildSystemPrompt(chunks, '\n\nIMPORTANT: Respond with valid JSON only. No markdown fences, no explanation — only raw JSON.'),
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${resp.status}`)
  }

  const data = await resp.json()
  const raw = data.content?.[0]?.text?.trim() ?? ''

  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  return JSON.parse(cleaned)
}

// ─── Flashcards ──────────────────────────────────────────────────────────────

export async function generateFlashcards(topic, sourceFilter, count, chunks, apiKey) {
  const sourceNote = sourceFilter === 'both'
    ? 'Include both FRCP and CPLR where relevant.'
    : `Focus on ${sourceFilter === 'frcp' ? 'FRCP' : 'CPLR'} only.`

  const prompt = `Generate exactly ${count} flashcards about the topic: "${topic}".
${sourceNote}
Use ONLY the provided source excerpts.

Respond with a JSON array of exactly ${count} objects:
[
  {
    "question": "Short clear question about a rule or procedure",
    "answer": "Precise answer citing the rule, e.g. 'Under FRCP Rule 4(m), a defendant must be served within 90 days after the complaint is filed.'",
    "rule": "FRCP Rule 4(m)",
    "source": "FRCP",
    "provider": "Cornell LII"
  }
]

Every item must have all five fields. Output only the JSON array.`

  return callClaudeJSON(prompt, chunks, apiKey)
}

// ─── Quiz ────────────────────────────────────────────────────────────────────

export async function generateQuiz(topic, sourceFilter, count, chunks, apiKey) {
  const sourceNote = sourceFilter === 'both'
    ? 'Mix FRCP and CPLR questions.'
    : `Focus on ${sourceFilter === 'frcp' ? 'FRCP' : 'CPLR'} only.`

  const prompt = `Generate exactly ${count} multiple-choice questions about: "${topic}".
${sourceNote}
Use ONLY the provided source excerpts. Make distractors plausible but clearly wrong per the sources.

Respond with a JSON array of exactly ${count} objects:
[
  {
    "question": "Under FRCP Rule 4(m), a defendant must be served within how many days?",
    "options": ["60 days", "90 days", "120 days", "180 days"],
    "correct": 1,
    "explanation": "FRCP Rule 4(m) states a defendant must be served within 90 days after the complaint is filed.",
    "rule": "FRCP Rule 4(m)",
    "source": "FRCP",
    "provider": "Cornell LII"
  }
]

"correct" is the zero-based index (0–3) of the correct answer. Output only the JSON array.`

  return callClaudeJSON(prompt, chunks, apiKey)
}

// ─── Fact Sheet ──────────────────────────────────────────────────────────────

export async function generateFactSheet(topic, chunks, apiKey) {
  const prompt = `Generate a comparative fact sheet about "${topic}" comparing FRCP vs CPLR.
Use ONLY the provided source excerpts.

Respond with a JSON object:
{
  "title": "Service of Process",
  "frcp_points": [
    {"label": "Time Limit", "value": "90 days after filing", "rule": "FRCP Rule 4(m)"}
  ],
  "cplr_points": [
    {"label": "Time Limit", "value": "120 days after filing", "rule": "CPLR § 306-b"}
  ],
  "key_difference": "New York provides 30 more days to serve.",
  "frcp_sources": ["FRCP Rule 4(m)"],
  "cplr_sources": ["CPLR § 306-b"]
}

Include 3–6 points per side. Output only the JSON object.`

  return callClaudeJSON(prompt, chunks, apiKey, 2000)
}
