#!/usr/bin/env node
/**
 * Civil Procedure Notebook — Content Generator
 * Scrapes FRCP + CPLR source pages, then generates all static JSON content
 * using the Anthropic API.
 *
 * Usage:
 *   node scripts/generate-content.js            — scrape + generate everything
 *   node scripts/generate-content.js --scrape   — scrape only (save raw text)
 *   node scripts/generate-content.js --content  — generate from saved raw text
 *
 * Requires: ANTHROPIC_API_KEY in .env.local
 * Output:   public/data/*.json
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import * as cheerio from 'cheerio'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RAW_DIR = path.join(__dirname, 'raw')
const OUT_DIR = path.join(ROOT, 'public', 'data')

const args = process.argv.slice(2)
const SCRAPE_ONLY = args.includes('--scrape')
const CONTENT_ONLY = args.includes('--content')

// ─── Anthropic client ────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-6'

// ─── Source definitions ──────────────────────────────────────────────────────

const FRCP_PAGES = [
  'rule_1',  // Scope and Purpose
  'rule_3',  // Commencing an Action
  'rule_4',  // Summons
  'rule_7',  // Pleadings Allowed
  'rule_8',  // General Rules of Pleading
  'rule_9',  // Pleading Special Matters
  'rule_11', // Signing; Sanctions
  'rule_12', // Defenses and Objections
  'rule_13', // Counterclaim and Crossclaim
  'rule_14', // Third-Party Practice
  'rule_15', // Amended and Supplemental Pleadings
  'rule_17', // Plaintiff and Defendant
  'rule_18', // Joinder of Claims
  'rule_19', // Required Joinder
  'rule_20', // Permissive Joinder
  'rule_21', // Misjoinder
  'rule_22', // Interpleader
  'rule_23', // Class Actions
  'rule_24', // Intervention
  'rule_26', // Discovery Scope
  'rule_30', // Depositions
  'rule_33', // Interrogatories
  'rule_34', // Documents and ESI
  'rule_36', // Admissions
  'rule_37', // Failure to Disclose
  'rule_38', // Jury Trial
  'rule_41', // Dismissal
  'rule_45', // Subpoena
  'rule_50', // JMOL
  'rule_52', // Findings by Court
  'rule_54', // Judgment; Costs
  'rule_55', // Default Judgment
  'rule_56', // Summary Judgment
  'rule_59', // New Trial
  'rule_60', // Relief from Judgment
  'rule_65', // Injunctions
  'rule_68', // Offer of Judgment
].map(r => `https://www.law.cornell.edu/rules/frcp/${r}`)

const CPLR_PAGES = [
  '301',    // General Jurisdiction
  '302',    // Long-Arm Jurisdiction
  '306-B',  // Service of Process — 120-day deadline
  '308',    // Personal Service
  '313',    // Service Outside State
  '901',    // Class Actions Prerequisites
  '902',    // Order Allowing Class Action
  '907',    // Class Action Notice
  '1001',   // Necessary Joinder
  '1002',   // Permissive Joinder
  '1007',   // Third-Party Practice
  '2101',   // Form of Papers
  '3001',   // Declaratory Judgment
  '3012',   // Service of Pleadings
  '3013',   // Specificity of Pleadings
  '3014',   // Paragraphs; Causes of Action
  '3016',   // Particularity
  '3018',   // Responsive Pleadings; Denials
  '3019',   // Counterclaims and Cross-Claims
  '3025',   // Amended and Supplemental Pleadings
  '3101',   // Scope of Disclosure
  '3102',   // Disclosure Devices
  '3106',   // Priority of Depositions
  '3107',   // Notice of Oral Deposition
  '3120',   // Discovery and Inspection
  '3123',   // Admissions
  '3126',   // Penalties for Refusal to Disclose
  '3211',   // Motion to Dismiss
  '3212',   // Summary Judgment
  '3215',   // Default Judgment
  '3217',   // Discontinuance of Action
  '4401',   // Motion for Judgment During Trial
  '4404',   // Post-Trial Motion
  '5011',   // Judgment
  '5015',   // Relief from Judgment
  '6301',   // Preliminary Injunction
].map(s => `https://www.nysenate.gov/legislation/laws/CVP/${s}`)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function writeJSON(filename, data) {
  const filePath = path.join(OUT_DIR, filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  log(`  Wrote ${filePath}`)
}

/**
 * Fetch a URL with retries. Returns the page HTML or empty string on failure.
 */
async function fetchPage(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CivilProcedureNotebook/1.0)' },
      })
      return resp.data
    } catch (err) {
      if (attempt < retries) {
        await sleep(2000 * (attempt + 1))
      }
    }
  }
  return ''
}

/**
 * Extract readable text from HTML, stripping nav/scripts/ads.
 */
function extractText(html, url) {
  if (!html) return ''
  const $ = cheerio.load(html)

  // Remove noise
  $('script, style, nav, header, footer, noscript, .advertisement, .sidebar, .menu, .nav, [role="navigation"], #cookie-banner, .breadcrumb, .social-share, .ads').remove()

  // For Cornell LII, the rule text lives in specific containers
  if (url.includes('cornell.edu')) {
    const main = $('#main-content, .field-items, article, main').first()
    if (main.length) return cleanText(main.text())
  }

  // For NYSenate.gov, the law text is in the main content area
  if (url.includes('nysenate.gov')) {
    const main = $('.nys-body-content, .view-content, .field-items, article, main, #content').first()
    if (main.length) return cleanText(main.text())
  }

  // For Justia, the section text is in the content area
  if (url.includes('justia.com')) {
    const main = $('[class*="content"], article, main, #main').first()
    if (main.length) return cleanText(main.text())
  }

  return cleanText($('body').text())
}

function cleanText(text) {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .trim()
}

/**
 * Select the most relevant portion of a large text based on keywords.
 * Returns up to maxWords words centered around the best-matching section.
 */
function selectRelevantText(text, keywords, maxWords = 2000) {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text

  // Score each window of maxWords
  const windowSize = maxWords
  let bestScore = -1
  let bestStart = 0

  const kws = keywords.map(k => k.toLowerCase())

  for (let i = 0; i <= words.length - windowSize; i += Math.floor(windowSize / 4)) {
    const window = words.slice(i, i + windowSize).join(' ').toLowerCase()
    const score = kws.reduce((s, kw) => s + (window.split(kw).length - 1), 0)
    if (score > bestScore) {
      bestScore = score
      bestStart = i
    }
  }

  return words.slice(bestStart, bestStart + windowSize).join(' ')
}

/**
 * Call Claude and return parsed JSON. Retries on parse failure.
 */
async function callClaude(prompt, retries = 2, maxTokens = 4000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = resp.content[0]?.text?.trim() ?? ''
      // Strip markdown fences if present
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()

      return JSON.parse(cleaned)
    } catch (err) {
      if (attempt < retries) {
        log(`  Retry ${attempt + 1} after parse/API error: ${err.message}`)
        await sleep(3000 * (attempt + 1))
      } else {
        throw err
      }
    }
  }
}

// ─── PHASE 1: SCRAPE ─────────────────────────────────────────────────────────

async function scrape() {
  log('=== PHASE 1: SCRAPING ===')
  ensureDir(RAW_DIR)

  // Scrape FRCP
  log(`Fetching ${FRCP_PAGES.length} FRCP pages...`)
  const frcpTexts = []
  for (let i = 0; i < FRCP_PAGES.length; i++) {
    const url = FRCP_PAGES[i]
    const ruleName = url.split('/').pop()
    process.stdout.write(`  [${i + 1}/${FRCP_PAGES.length}] ${ruleName}...`)
    const html = await fetchPage(url)
    const text = extractText(html, url)
    if (text.length > 100) {
      frcpTexts.push(`=== ${url} ===\n${text}`)
      process.stdout.write(' ok\n')
    } else {
      process.stdout.write(' EMPTY\n')
    }
    await sleep(500) // polite delay
  }

  const frcpRaw = frcpTexts.join('\n\n---\n\n')
  fs.writeFileSync(path.join(RAW_DIR, 'frcp.txt'), frcpRaw, 'utf8')
  log(`Saved FRCP raw text (${Math.round(frcpRaw.length / 1000)}KB)`)

  // Scrape CPLR
  log(`Fetching ${CPLR_PAGES.length} CPLR pages...`)
  const cplrTexts = []
  for (let i = 0; i < CPLR_PAGES.length; i++) {
    const url = CPLR_PAGES[i]
    const sectionName = url.split('/').filter(Boolean).pop()
    process.stdout.write(`  [${i + 1}/${CPLR_PAGES.length}] ${sectionName}...`)
    const html = await fetchPage(url)
    const text = extractText(html, url)
    if (text.length > 100) {
      cplrTexts.push(`=== ${url} ===\n${text}`)
      process.stdout.write(' ok\n')
    } else {
      process.stdout.write(' EMPTY\n')
    }
    await sleep(500)
  }

  const cplrRaw = cplrTexts.join('\n\n---\n\n')
  fs.writeFileSync(path.join(RAW_DIR, 'cplr.txt'), cplrRaw, 'utf8')
  log(`Saved CPLR raw text (${Math.round(cplrRaw.length / 1000)}KB)`)

  log('Scraping complete.')
  return { frcpRaw, cplrRaw }
}

// ─── PHASE 2: GENERATE ───────────────────────────────────────────────────────

// Topic lists for generation
const FLASHCARD_TOPICS = [
  { topic: 'Service of Process', keywords: ['service', 'summons', 'process', '4(m)', '306-b'] },
  { topic: 'Pleading Standards', keywords: ['pleading', 'complaint', 'notice', 'specific', 'Rule 8', '3013'] },
  { topic: 'Motion to Dismiss', keywords: ['dismiss', '12(b)', '3211', 'failure to state', 'jurisdiction'] },
  { topic: 'Summary Judgment', keywords: ['summary judgment', 'genuine dispute', 'Rule 56', '3212', 'material fact'] },
  { topic: 'Discovery', keywords: ['discovery', 'disclosure', 'deposition', 'interrogatory', 'Rule 26', '3101'] },
  { topic: 'Class Actions', keywords: ['class action', 'Rule 23', 'certification', '901', 'numerosity'] },
  { topic: 'Joinder of Parties', keywords: ['joinder', 'Rule 19', 'Rule 20', '1001', '1002', 'necessary'] },
  { topic: 'Default Judgment', keywords: ['default', 'Rule 55', '3215', 'entry of default'] },
  { topic: 'Amended Pleadings', keywords: ['amended', 'Rule 15', '3025', 'supplemental', 'leave'] },
  { topic: 'Post-Trial Motions', keywords: ['new trial', 'JMOL', 'Rule 50', 'Rule 59', '4401', '4404', 'judgment matter of law'] },
]

const QUIZ_TOPICS = [
  { topic: 'Service of Process', keywords: ['service', 'summons', '4(m)', '306-b', 'days'] },
  { topic: 'Pleading and Motions', keywords: ['pleading', 'dismiss', '12(b)', '3211', 'Rule 8'] },
  { topic: 'Discovery Rules', keywords: ['discovery', 'deposition', 'interrogatory', 'Rule 26', '3101'] },
  { topic: 'Judgment and Trial', keywords: ['summary judgment', 'default', 'JMOL', 'new trial', 'Rule 56'] },
  { topic: 'Parties and Class Actions', keywords: ['joinder', 'class action', 'intervention', 'Rule 23', '901'] },
]

const FACTSHEET_TOPICS = [
  'Service of Process',
  'Pleading Standards',
  'Motion to Dismiss',
  'Summary Judgment',
  'Default Judgment',
  'Discovery Scope and Devices',
  'Depositions',
  'Admissions',
  'Class Actions',
  'Joinder of Parties',
  'Third-Party Practice (Impleader)',
  'Amended Pleadings',
  'Intervention',
  'Interpleader',
  'Counterclaims and Cross-Claims',
  'Jury Trial Rights',
  'Injunctions and Preliminary Relief',
  'Offer of Judgment',
  'Dismissal of Actions',
  'Post-Trial Motions',
  'New Trial',
  'Relief from Judgment',
  'Sanctions',
  'Subpoenas',
  'Judgment as a Matter of Law',
  'Jurisdiction — Personal',
  'Long-Arm Jurisdiction',
  'Class Action Notice',
  'Penalties for Discovery Failures',
  'Declaratory Judgment',
]

const SUMMARY_TOPICS = [
  { topic: 'Service of Process', keywords: ['service', 'summons', '4(m)', '306-b'] },
  { topic: 'Pleadings and Motions to Dismiss', keywords: ['pleading', 'dismiss', 'Rule 8', 'Rule 12'] },
  { topic: 'Discovery Rules', keywords: ['discovery', 'deposition', 'Rule 26', '3101'] },
  { topic: 'Summary Judgment and Default', keywords: ['summary judgment', 'default', 'Rule 56', 'Rule 55'] },
  { topic: 'Class Actions and Party Joinder', keywords: ['class action', 'joinder', 'Rule 23', '901'] },
]

const COMPARISON_TOPICS = [
  'Service of Process — Time Limits',
  'Pleading Standards',
  'Class Action Requirements',
  'Summary Judgment Standards',
  'Discovery Scope',
  'Motion to Dismiss Grounds',
  'Default Judgment Procedures',
  'Amended Pleadings',
  'Joinder of Parties',
  'Post-Trial Motions',
  'Preliminary Injunctions',
  'Personal Jurisdiction',
  'Counterclaims and Cross-Claims',
  'Sanctions and Penalties',
  'Relief from Judgment',
]

// ─── Generators ──────────────────────────────────────────────────────────────

async function generateFlashcards(frcpText, cplrText) {
  log('Generating flashcards...')
  const allCards = []
  let id = 1
  const cplrFromKnowledge = cplrText.length < 500

  for (const { topic, keywords } of FLASHCARD_TOPICS) {
    log(`  Topic: ${topic}`)

    // Generate FRCP cards
    const frcpSection = selectRelevantText(frcpText, keywords, 2500)
    const frcpPrompt = `You are a civil procedure study expert. Using ONLY the FRCP source text below, generate 10 flashcards about "${topic}".

SOURCE TEXT (FRCP — Cornell LII):
${frcpSection}

Return a JSON array of exactly 10 objects. Each object must have ALL these fields:
{
  "topic": "${topic}",
  "source": "FRCP",
  "front": "A clear, specific question about an FRCP rule or requirement",
  "back": "A precise answer citing the specific rule number (e.g. 'Under FRCP Rule 4(m)...')",
  "citation": "FRCP Rule X",
  "rule_number": "Rule X"
}

Only output the JSON array. No markdown, no explanation.`

    // Generate CPLR cards — from source text or from training knowledge
    const cplrSection = cplrFromKnowledge ? '' : selectRelevantText(cplrText, keywords, 2500)
    const cplrPrompt = cplrFromKnowledge
      ? `You are a civil procedure expert with comprehensive knowledge of the New York CPLR. Generate 10 accurate flashcards about "${topic}" under the CPLR, citing specific section numbers.

Return a JSON array of exactly 10 objects. Each object must have ALL these fields:
{
  "topic": "${topic}",
  "source": "CPLR",
  "front": "A clear, specific question about a CPLR section or requirement",
  "back": "A precise answer citing the specific section number (e.g. 'Under CPLR § 306-b...')",
  "citation": "CPLR § X",
  "rule_number": "§ X"
}

Only output the JSON array. No markdown, no explanation.`
      : `You are a civil procedure study expert. Using ONLY the CPLR source text below, generate 10 flashcards about "${topic}".

SOURCE TEXT (CPLR — NY Senate):
${cplrSection}

Return a JSON array of exactly 10 objects. Each object must have ALL these fields:
{
  "topic": "${topic}",
  "source": "CPLR",
  "front": "A clear, specific question about a CPLR section or requirement",
  "back": "A precise answer citing the specific section number (e.g. 'Under CPLR § 306-b...')",
  "citation": "CPLR § X",
  "rule_number": "§ X"
}

Only output the JSON array. No markdown, no explanation.`

    try {
      const [frcpCards, cplrCards] = await Promise.all([
        callClaude(frcpPrompt),
        callClaude(cplrPrompt),
      ])

      const addCards = (cards, source) => {
        for (const c of cards) {
          allCards.push({ id: id++, ...c, source })
        }
      }

      if (Array.isArray(frcpCards)) addCards(frcpCards, 'FRCP')
      if (Array.isArray(cplrCards)) addCards(cplrCards, 'CPLR')

      log(`    +${Array.isArray(frcpCards) ? frcpCards.length : 0} FRCP, +${Array.isArray(cplrCards) ? cplrCards.length : 0} CPLR cards`)
    } catch (err) {
      log(`    ERROR for ${topic}: ${err.message}`)
    }

    await sleep(1500)
  }

  writeJSON('flashcards.json', allCards)
  log(`Flashcards done: ${allCards.length} total`)
  return allCards
}

async function generateQuiz(frcpText, cplrText) {
  log('Generating quiz questions...')
  const allQuestions = []
  let id = 1
  const cplrFromKnowledge = cplrText.length < 500

  for (const { topic, keywords } of QUIZ_TOPICS) {
    log(`  Topic: ${topic}`)

    const frcpSection = selectRelevantText(frcpText, keywords, 2000)
    const cplrSection = cplrFromKnowledge ? '' : selectRelevantText(cplrText, keywords, 2000)

    const cplrBlock = cplrFromKnowledge
      ? `CPLR KNOWLEDGE: Use your comprehensive training knowledge of the New York CPLR to write CPLR questions, citing accurate section numbers.`
      : `CPLR SOURCE TEXT:\n${cplrSection}`

    const prompt = `You are a civil procedure exam expert. Generate 10 multiple-choice questions about "${topic}". Include both FRCP and CPLR questions.

FRCP SOURCE TEXT (use for FRCP questions):
${frcpSection}

${cplrBlock}

Return a JSON array of exactly 10 objects. Each object must have ALL these fields:
{
  "topic": "${topic}",
  "source": "FRCP" or "CPLR",
  "question": "A specific, unambiguous question testing knowledge of the rule/section",
  "choices": {
    "A": "First option",
    "B": "Second option",
    "C": "Third option",
    "D": "Fourth option"
  },
  "correct": "A" (the letter of the correct answer),
  "explanation": "Explanation citing the specific rule/section number",
  "citation": "FRCP Rule X or CPLR § X"
}

Make distractors plausible but clearly wrong based on the source text.
Only output the JSON array. No markdown, no explanation.`

    try {
      const questions = await callClaude(prompt, 2, 6000)
      if (Array.isArray(questions)) {
        for (const q of questions) {
          allQuestions.push({ id: id++, ...q })
        }
        log(`    +${questions.length} questions`)
      }
    } catch (err) {
      log(`    ERROR for ${topic}: ${err.message}`)
    }

    await sleep(2000)
  }

  writeJSON('quiz.json', allQuestions)
  log(`Quiz done: ${allQuestions.length} total`)
  return allQuestions
}

async function generateFactSheets(frcpText, cplrText) {
  log('Generating fact sheets...')
  const allSheets = []
  let id = 1
  const cplrFromKnowledge = cplrText.length < 500

  for (const topic of FACTSHEET_TOPICS) {
    log(`  Topic: ${topic}`)

    const keywords = topic.toLowerCase().split(/\s+/)
    const frcpSection = selectRelevantText(frcpText, keywords, 2000)
    const cplrSection = cplrFromKnowledge ? '' : selectRelevantText(cplrText, keywords, 2000)

    const cplrBlock = cplrFromKnowledge
      ? `CPLR KNOWLEDGE: Use your comprehensive training knowledge of the New York CPLR for the CPLR side of this fact sheet, citing accurate section numbers.`
      : `CPLR SOURCE TEXT:\n${cplrSection}`

    const prompt = `You are a civil procedure expert. Generate a comparative fact sheet about "${topic}" contrasting FRCP vs CPLR.

FRCP SOURCE TEXT (use for FRCP side):
${frcpSection}

${cplrBlock}

Return a single JSON object with ALL these fields:
{
  "topic": "${topic}",
  "frcp": {
    "summary": "1-2 sentence overview of the FRCP approach",
    "rules": ["FRCP Rule X", "FRCP Rule Y"],
    "key_points": [
      "Specific rule requirement with citation",
      "Another key point with citation",
      "Third key point"
    ]
  },
  "cplr": {
    "summary": "1-2 sentence overview of the CPLR approach",
    "sections": ["CPLR § X", "CPLR § Y"],
    "key_points": [
      "Specific section requirement with citation",
      "Another key point with citation",
      "Third key point"
    ]
  },
  "key_difference": "The most important practical difference between FRCP and CPLR on this topic",
  "practitioner_tip": "One concrete tip for a practitioner dealing with both systems"
}

Include 3-5 key_points per side. Only output the JSON object. No markdown, no explanation.`

    try {
      const sheet = await callClaude(prompt)
      if (sheet && sheet.topic) {
        allSheets.push({ id: id++, ...sheet })
        log(`    ok`)
      }
    } catch (err) {
      log(`    ERROR for ${topic}: ${err.message}`)
    }

    await sleep(2000)
  }

  writeJSON('factsheets.json', allSheets)
  log(`Fact sheets done: ${allSheets.length} total`)
  return allSheets
}

async function generateSummaries(frcpText, cplrText) {
  log('Generating plain-English summaries...')
  const allSummaries = []
  let id = 1
  const cplrFromKnowledge = cplrText.length < 500

  for (const { topic, keywords } of SUMMARY_TOPICS) {
    log(`  Topic: ${topic}`)

    for (const [source, text, label] of [['FRCP', frcpText, 'Cornell LII'], ['CPLR', cplrText, 'NY Senate']]) {
      const isCplrKnowledge = source === 'CPLR' && cplrFromKnowledge
      const section = isCplrKnowledge ? '' : selectRelevantText(text, keywords, 2000)

      const sourceBlock = isCplrKnowledge
        ? `CPLR KNOWLEDGE: Use your comprehensive training knowledge of the New York CPLR, citing accurate section numbers.`
        : `SOURCE TEXT (${source} — ${label}):\n${section}`

      const prompt = `You are a plain-English legal writer. Write a plain-English summary of "${topic}" under ${source}.

${sourceBlock}

Return a single JSON object:
{
  "topic": "${topic}",
  "source": "${source}",
  "plain_english_summary": "2-3 paragraph plain-English explanation of the rules, written for a law student",
  "key_rules": [
    "The most important rule/requirement (with citation)",
    "Second key rule (with citation)",
    "Third key rule (with citation)"
  ],
  "citations": ["${source} Rule/§ X", "${source} Rule/§ Y"]
}

Only output the JSON object. No markdown, no explanation.`

      try {
        const summary = await callClaude(prompt)
        if (summary && summary.topic) {
          allSummaries.push({ id: id++, ...summary })
          log(`    +1 ${source} summary`)
        }
      } catch (err) {
        log(`    ERROR ${source} ${topic}: ${err.message}`)
      }

      await sleep(1500)
    }
  }

  writeJSON('summaries.json', allSummaries)
  log(`Summaries done: ${allSummaries.length} total`)
  return allSummaries
}

async function generateComparisons(frcpText, cplrText) {
  log('Generating comparison tables...')
  const allComparisons = []
  let id = 1
  const cplrFromKnowledge = cplrText.length < 500

  for (const topic of COMPARISON_TOPICS) {
    log(`  Topic: ${topic}`)

    const keywords = topic.toLowerCase().split(/[\s—]+/)
    const frcpSection = selectRelevantText(frcpText, keywords, 1500)
    const cplrSection = cplrFromKnowledge ? '' : selectRelevantText(cplrText, keywords, 1500)

    const cplrBlock = cplrFromKnowledge
      ? `CPLR KNOWLEDGE: Use your comprehensive training knowledge of the New York CPLR for CPLR columns, citing accurate section numbers.`
      : `CPLR SOURCE TEXT:\n${cplrSection}`

    const prompt = `You are a civil procedure expert. Generate a detailed comparison table for "${topic}" between FRCP and CPLR.

FRCP SOURCE TEXT (use for FRCP columns):
${frcpSection}

${cplrBlock}

Return a single JSON object:
{
  "topic": "${topic}",
  "rows": [
    {
      "aspect": "Time limit / deadline",
      "frcp": "Specific FRCP requirement",
      "cplr": "Specific CPLR requirement",
      "citation_frcp": "FRCP Rule X",
      "citation_cplr": "CPLR § X"
    }
  ]
}

Include 4-6 rows covering the most important differences.
Only output the JSON object. No markdown, no explanation.`

    try {
      const comparison = await callClaude(prompt)
      if (comparison && Array.isArray(comparison.rows)) {
        allComparisons.push({ id: id++, ...comparison })
        log(`    +${comparison.rows.length} rows`)
      }
    } catch (err) {
      log(`    ERROR for ${topic}: ${err.message}`)
    }

    await sleep(2000)
  }

  writeJSON('comparisons.json', allComparisons)
  log(`Comparisons done: ${allComparisons.length} total`)
  return allComparisons
}

function buildSearchIndex(frcpText, cplrText) {
  log('Building search index...')
  const CHUNK_WORDS = 400
  const OVERLAP_WORDS = 50
  const chunks = []
  let id = 0

  function chunkSource(fullText, sourceLabel, baseUrl) {
    // Split by page separator
    const pages = fullText.split('\n\n---\n\n')

    for (const page of pages) {
      // Extract URL from first line
      const lines = page.trim().split('\n')
      const urlLine = lines[0]
      const url = urlLine.replace(/^===\s*/, '').replace(/\s*===$/, '').trim()
      const pageText = lines.slice(1).join('\n').trim()

      if (pageText.length < 100) continue

      // Extract rule/section number from URL
      const urlPart = url.split('/').pop() || ''
      const ruleNumber = urlPart
        .replace('rule_', 'Rule ')
        .replace('section-', '§ ')
        .replace(/-/g, '.')

      const words = pageText.split(/\s+/).filter(w => w.length > 0)
      let i = 0

      while (i < words.length) {
        const slice = words.slice(i, i + CHUNK_WORDS)
        if (slice.length < 30) break

        chunks.push({
          id: `${sourceLabel}_${id++}`,
          source: sourceLabel,
          rule_number: ruleNumber,
          section_title: `${sourceLabel} ${ruleNumber}`,
          text: slice.join(' '),
          url: url || baseUrl,
        })

        i += CHUNK_WORDS - OVERLAP_WORDS
      }
    }
  }

  chunkSource(frcpText, 'FRCP', 'https://www.law.cornell.edu/rules/frcp')
  chunkSource(cplrText, 'CPLR', 'https://www.nysenate.gov/legislation/laws/CVP')

  writeJSON('search-index.json', { chunks })
  log(`Search index done: ${chunks.length} chunks`)
  return { chunks }
}

function writeMeta(startTime) {
  const meta = {
    generated_at: new Date().toISOString(),
    generated_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    duration_seconds: Math.round((Date.now() - startTime) / 1000),
    sources: {
      frcp: { name: 'FRCP', full_name: 'Federal Rules of Civil Procedure', provider: 'Cornell LII', url: 'https://www.law.cornell.edu/rules/frcp', pages_scraped: FRCP_PAGES.length },
      cplr: { name: 'CPLR', full_name: 'New York Civil Practice Law and Rules', provider: 'NY Senate', url: 'https://www.nysenate.gov/legislation/laws/CVP', pages_scraped: CPLR_PAGES.length },
    },
    files: ['flashcards.json', 'quiz.json', 'factsheets.json', 'summaries.json', 'comparisons.json', 'search-index.json'],
  }

  writeJSON('meta.json', meta)
  log('Meta written.')
  return meta
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now()

  if (!process.env.ANTHROPIC_API_KEY && !SCRAPE_ONLY) {
    console.error('ERROR: ANTHROPIC_API_KEY not found. Create .env.local with your key.')
    process.exit(1)
  }

  ensureDir(OUT_DIR)
  ensureDir(RAW_DIR)

  let frcpText, cplrText

  if (CONTENT_ONLY) {
    // Load from saved raw files
    const frcpPath = path.join(RAW_DIR, 'frcp.txt')
    const cplrPath = path.join(RAW_DIR, 'cplr.txt')
    if (!fs.existsSync(frcpPath) || !fs.existsSync(cplrPath)) {
      console.error('ERROR: raw/frcp.txt or raw/cplr.txt not found. Run scrape first.')
      process.exit(1)
    }
    frcpText = fs.readFileSync(frcpPath, 'utf8')
    cplrText = fs.readFileSync(cplrPath, 'utf8')
    log(`Loaded raw text: FRCP ${Math.round(frcpText.length / 1000)}KB, CPLR ${Math.round(cplrText.length / 1000)}KB`)
  } else {
    // Scrape
    const result = await scrape()
    frcpText = result.frcpRaw
    cplrText = result.cplrRaw
  }

  if (SCRAPE_ONLY) {
    log('Scrape-only mode — done.')
    return
  }

  // Generate all content
  log('\n=== PHASE 2: GENERATING CONTENT ===')
  log(`Model: ${MODEL}`)

  await generateFlashcards(frcpText, cplrText)
  await sleep(2000)
  await generateQuiz(frcpText, cplrText)
  await sleep(2000)
  await generateFactSheets(frcpText, cplrText)
  await sleep(2000)
  await generateSummaries(frcpText, cplrText)
  await sleep(2000)
  await generateComparisons(frcpText, cplrText)

  buildSearchIndex(frcpText, cplrText)
  writeMeta(startTime)

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  log(`\n=== DONE in ${elapsed}s ===`)
  log(`Output files in: ${OUT_DIR}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
