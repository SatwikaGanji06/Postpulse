# 📈 PostPulse

**Find out why your posts flop, and what to post next week.**

PostPulse turns a small creator's analytics export into plain-English advice. Upload your data, see what's working, and get a specific plan for the week ahead.

🔗 **Live demo:** [your-vercel-link-here](https://your-vercel-link-here)

![PostPulse demo](docs/demo.gif)

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
- 🏆 Top 5 and bottom 5 posts
- 📉 30-day vs previous 30-day trend
- 🤖 AI insights: what's working, what's not, next week's plan, caption tips
- 📱 Mobile-friendly UI
- 🔒 Raw data stays in your browser; only aggregated stats are sent to the AI

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
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
git clone https://github.com/your-username/postpulse.git
cd postpulse

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
| `ANTHROPIC_API_KEY` | Your Anthropic API key (server-side only) |

## Project Structure

```
postpulse/
├── app/
│   ├── page.tsx              # Home + upload
│   ├── results/              # Results dashboard
│   └── api/insights/route.ts # AI insights endpoint
├── components/               # Stat cards, charts, insight cards
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

Built by [your-name](https://github.com/your-username) · Questions or feedback? Open an issue or reach out on [LinkedIn](https://linkedin.com/in/your-profile)
