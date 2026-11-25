# 📈 PostPulse

**Find out why your posts flop, and what to post next week.**

PostPulse turns a small creator's analytics export into plain-English advice. Upload your data, see what's working, and get a specific plan for the week ahead.

🔗 **Live demo:** coming soon (see [Deploy](#deploy) to host your own on Vercel)

---

## The Problem

Big analytics tools (Hootsuite, Sprout Social) are built for brands and priced accordingly. Small creators with 500 to 20k followers just see raw numbers and have no idea what to change.

## The Solution

Upload a CSV of your post analytics. PostPulse:

1. Computes the stats that matter (engagement, best time, best format, trends)
2. Sends only the **aggregated stats** to an AI model
3. Returns clear, actionable insights in plain English

## Features

- 📂 CSV upload, or one-click **sample data** demo
- 📊 Engagement rate by format (Reel, post, story, video)
- ⏰ Best posting hour and best weekday
- 🏆 Top 5 and bottom 5 posts (never the same post in both)
- 📉 30-day vs previous 30-day trend, for engagement and views
- 🤖 AI insights: what's working, what's not, next week's plan, caption tips
- 📋 Copy next week's plan, or save the whole report as a PDF
- 📱 Mobile-friendly UI, keyboard accessible, matches the pitch-deck branding
- 🔒 Raw data stays in your browser; only aggregated stats are sent to the AI

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| CSV parsing | PapaParse |
| AI | Anthropic API |
| Hosting | Vercel |

## Expected CSV Format

| Column | Example |
|---|---|
| `date` | 2026-10-14 |
| `format` | reel |
| `caption` | My morning routine |
| `views` | 3200 |
| `likes` | 210 |
| `comments` | 14 |
| `shares` | 9 |
| `saves` | 31 |

Headers are case-insensitive and invalid rows are skipped. A sample file is in `public/sample.csv`.

## Getting Started

### Prerequisites

- Node.js 18+
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/SatwikaGanji06/Postpulse.git
cd Postpulse

# 2. Install dependencies
npm install

# 3. Add your API key
cp .env.example .env.local
# then edit .env.local and set ANTHROPIC_API_KEY

# 4. Run the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Try sample data**.

### Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (server-side only). Without it the app runs in demo mode with rule-based tips. |
| `ANTHROPIC_MODEL` | Optional. Model id to use (default `claude-haiku-5-5`). |

## Project Structure

```
postpulse/
├── app/
│   ├── page.tsx              # Home + upload
│   ├── results/              # Results dashboard
│   └── api/insights/route.ts # AI insights endpoint
├── components/               # Shared UI, format chart, insight cards
├── lib/
│   └── analyze.ts            # Pure stats functions
├── public/
│   └── sample.csv            # Demo dataset
└── .env.example
```

## How It Works

```
CSV upload → parse in browser → compute stats (lib/analyze.ts)
          → POST aggregated stats to /api/insights
          → AI returns structured JSON → render cards + charts
```

## Deploy

1. Push to GitHub
2. Import the repo on [Vercel](https://vercel.com)
3. Add `ANTHROPIC_API_KEY` under **Environment Variables**
4. Deploy

## Roadmap

- [ ] YouTube Data API connection (no CSV needed)
- [ ] Instagram Graph API via OAuth
- [ ] Weekly email report
- [ ] Competitor comparison
- [ ] AI content calendar and caption generator
- [ ] User accounts and history
- [ ] Paid plans (free weekly report, premium for calendar and comparisons)

## Contributing

Issues and PRs are welcome. For big changes, open an issue first to discuss.

## License

MIT

---

Built by [Ganji Satwika](https://github.com/SatwikaGanji06) · Questions or feedback? [Open an issue](https://github.com/SatwikaGanji06/Postpulse/issues).
