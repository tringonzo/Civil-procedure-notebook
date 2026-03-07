# Civil Procedure Notebook

A RAG-powered legal study tool for **FRCP** (Federal Rules of Civil Procedure) and **CPLR** (New York Civil Practice Law and Rules).

Built with React + Vite. Deployed on GitHub Pages. All AI answers are strictly grounded in the loaded sources — the model never invents rule numbers or case names.

---

## Features

| Module | What it does |
|--------|-------------|
| **Search** | Keyword search across both sources, results ranked by relevance |
| **Ask** | Natural language Q&A with streaming answers and source citations |
| **Flashcards** | AI-generated flip cards on any topic, with Know It / Missed It tracking |
| **Quiz** | Multiple-choice questions with feedback and score screen |
| **Fact Sheets** | Side-by-side FRCP vs. CPLR comparison, print-ready |

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:5173/civil-procedure-notebook/
```

On first load, the app fetches FRCP and CPLR source pages via a CORS proxy and caches them in `localStorage` for 24 hours.

You need an **Anthropic API key** for AI features (Ask, Flashcards, Quiz, Fact Sheets). Click **API Key** in the nav to set yours. It is stored only in your browser's localStorage.

---

## Deploy to GitHub Pages

### Step 1 — Create the repo

1. Go to [github.com](https://github.com) → **New repository**
2. Name it exactly: `civil-procedure-notebook`
3. Set to **Public**
4. Do NOT initialize with README (you have one)

### Step 2 — Push code

```bash
cd civil-procedure-notebook
git init
git add .
git commit -m "Initial commit — civil procedure notebook"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/civil-procedure-notebook.git
git push -u origin main
```

### Step 3 — Deploy

```bash
npm run deploy
```

This runs `vite build` then `gh-pages -d dist`, pushing the built site to the `gh-pages` branch.

### Step 4 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `gh-pages` → `/root` → **Save**

### Step 5 — Live at

```
https://YOUR_USERNAME.github.io/civil-procedure-notebook/
```

*GitHub Pages can take 1–2 minutes to publish after the first deploy.*

---

## Architecture

```
src/
├── lib/
│   ├── fetcher.js    # Fetch + chunk + cache source URLs
│   ├── search.js     # Keyword search across chunks
│   └── claude.js     # All AI API calls (streaming + JSON)
├── components/
│   ├── Nav.jsx
│   ├── SourceStatus.jsx
│   └── CitationBadge.jsx
└── modules/
    ├── Search/
    ├── QandA/
    ├── Flashcards/
    ├── Quiz/
    └── FactSheets/
```

**RAG flow:** On load → fetch both URLs via CORS proxy → strip HTML → chunk into ~500-word segments with 50-word overlap → cache in localStorage. On any AI request → keyword-rank chunks by relevance → inject top 8 into the system prompt → the model answers only from those excerpts.

---

## Sources

- **FRCP**: https://www.law.cornell.edu/rules/frcp (Cornell LII)
- **CPLR**: https://law.justia.com/codes/new-york/cvp/ (Justia)

Note: The fetcher loads the top-level index page of each source. For deeper coverage, you can extend `fetcher.js` with additional sub-page URLs (individual FRCP rules, specific CPLR articles).

---

