// One-off generator for public/sample.csv.
// Uses a fixed seed so every run writes the identical file.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEED = 20261124;
const POST_COUNT = 75;
const END = new Date(2026, 10, 24);

const VIEW_RANGE = {
  reel: [2500, 2900],
  post: [830, 970],
  story: [860, 980],
  video: [560, 720],
};

// Evening is 35% above morning. Tue/Thu are a bit above weekends.
const TIME_MUL = { morning: 1, evening: 1.35, other: 1.15 };
const DOW_MUL = { boost: 1.08, weekend: 0.96, neutral: 1 };

// Rates are fractions of views, before the recent-month dip.
const RATE_RANGE = {
  reel: {
    likes: [0.078, 0.09],
    comments: [0.0055, 0.009],
    shares: [0.0012, 0.0022],
    saves: [0.003, 0.0038],
  },
  post: {
    likes: [0.046, 0.062],
    comments: [0.004, 0.007],
    shares: [0.0018, 0.004],
    saves: [0.0055, 0.01],
  },
  story: {
    likes: [0.028, 0.036],
    comments: [0.0028, 0.0038],
    shares: [0.0015, 0.0024],
    saves: [0.004, 0.0052],
  },
  video: {
    likes: [0.032, 0.048],
    comments: [0.0035, 0.006],
    shares: [0.0085, 0.01],
    saves: [0.018, 0.02],
  },
};

// Floor rates still sit inside the allowed bands after the dip scale.
const FLOP_RATES = {
  likes: 0.028,
  comments: 0.003,
  shares: 0.0026,
  saves: 0.0065,
};

const RATE_MIN = { likes: 0.02, comments: 0.002, shares: 0.001, saves: 0.003 };
const RATE_MAX = { likes: 0.09, comments: 0.01, shares: 0.01, saves: 0.02 };

const CAPTIONS = [
  "My morning routine",
  "3 mistakes I made as a beginner",
  "What I eat in a day",
  "Behind the scenes of this shoot",
  "A tip I wish I knew sooner",
  "How I plan my week",
  "The tool I use every day",
  "Unpopular opinion about growth",
  "Day in my life",
  "How I edit in 10 minutes",
  "This changed my workflow",
  "Stop doing this immediately",
  "My favorite free resource",
  "A simple habit that stuck",
  "What I learned this month",
  "Recreating my first video",
  "Honest review of my gear",
  "How I batch my content",
  "The question I get most",
  "A quiet Sunday reset",
  "Why I film in natural light",
  "My desk tour",
  "Trying a new format today",
  "The caption formula I use",
  "How I find ideas",
  "A week of outfits",
  "What actually grew my account",
  "I tested this for 30 days",
  "My nighttime routine",
  "Things I no longer buy",
  "How I stay consistent",
  "A mistake in my last video",
  "The book I keep recommending",
  "My packing list for a shoot",
  "Why I post less now",
  "A small win from this week",
  "How I write hooks",
  "Studio vs phone camera",
  "What I would tell day one me",
  "My current reading list",
  "How I repurpose one idea",
  "The app that saved me time",
  "A routine for low energy days",
  "Why this post took so long",
  "My favorite corner of the city",
  "How I price my work",
  "A template you can copy",
  "What I cut from my process",
  "Morning light vs evening light",
  "The audio I use most",
  "How I reply to comments",
  "A challenge I am running",
  "What surprised me in my analytics",
  "Building a series from scratch",
  "The shot I almost deleted",
  "How I warm up on camera",
  "A budget setup that works",
  "Why I took a rest day",
  "My three part workflow",
  "What I do after posting",
  "A trend I skipped on purpose",
  "How I choose thumbnails",
  "The email that made my week",
  "Fixing a video that flopped",
  "My go to lunch break idea",
  "What consistency looks like",
  "A before and after",
  "How I storyboard fast",
  "The habit I dropped",
  "Why short hooks work",
  "My rainy day plan",
  "A collab from last month",
  "How I track ideas",
  "The frame I am proud of",
  "Starting over with a new niche",
];

const rng = mulberry32(SEED);

const posts = buildPosts();
assignFormats(posts);
applyOutliers(posts);
const scale = chooseRecentScale(posts);
materialize(posts, scale);
checkPatterns(posts);
writeCsv(posts);
printSummary(posts);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function uniform(min, max) {
  return min + rng() * (max - min);
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    const swap = list[i];
    list[i] = list[j];
    list[j] = swap;
  }
  return list;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function stamp(date) {
  return `${ymd(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dowClass(date) {
  const day = date.getDay();
  if (day === 2 || day === 4) return "boost";
  if (day === 0 || day === 6) return "weekend";
  return "neutral";
}

function periodOf(date) {
  const key = ymd(date);
  const recentStart = ymd(addDays(END, -29));
  const previousStart = ymd(addDays(END, -59));
  const previousEnd = ymd(addDays(END, -30));
  if (key >= recentStart && key <= ymd(END)) return "recent";
  if (key >= previousStart && key <= previousEnd) return "previous";
  return "older";
}

function sampleRates(format) {
  const range = RATE_RANGE[format];
  return {
    likes: uniform(range.likes[0], range.likes[1]),
    comments: uniform(range.comments[0], range.comments[1]),
    shares: uniform(range.shares[0], range.shares[1]),
    saves: uniform(range.saves[0], range.saves[1]),
  };
}

function hourFor(bucket) {
  if (bucket === "morning") return randInt(8, 11);
  if (bucket === "evening") return randInt(18, 20);
  // Stay clear of 08:00-12:00 and 18:00-21:00 so boundary hours are not ambiguous.
  const hours = [7, 13, 14, 15, 16, 17, 22];
  return hours[randInt(0, hours.length - 1)];
}

function buildPosts() {
  const start = addDays(END, -89);
  const captions = shuffle([...CAPTIONS]);
  const rows = [];

  for (let i = 0; i < POST_COUNT; i++) {
    const offset = Math.round((i * 89) / (POST_COUNT - 1));
    const day = addDays(start, offset);
    rows.push({
      day,
      caption: captions[i],
      period: periodOf(day),
      dow: dowClass(day),
      kind: "normal",
    });
  }

  return rows;
}

// Deal each format across weekdays so Tue/Thu vs weekend is not just a mix effect.
function assignFormats(rows) {
  const classes = ["boost", "weekend", "neutral"];
  const formats = ["reel", "post", "story", "video"];
  const totals = { reel: 30, post: 23, story: 15, video: 7 };
  const groups = Object.fromEntries(
    classes.map((name) => [name, rows.filter((row) => row.dow === name)])
  );
  const plan = Object.fromEntries(classes.map((name) => [name, { reel: 0, post: 0, story: 0, video: 0 }]));
  const open = Object.fromEntries(classes.map((name) => [name, groups[name].length]));

  for (const format of formats) {
    for (let placed = 0; placed < totals[format]; placed++) {
      const choice = classes
        .filter((name) => open[name] > 0)
        .sort((a, b) => {
          const gapA = (totals[format] * groups[a].length) / rows.length - plan[a][format];
          const gapB = (totals[format] * groups[b].length) / rows.length - plan[b][format];
          return gapB - gapA;
        })[0];
      plan[choice][format] += 1;
      open[choice] -= 1;
    }
  }

  for (const name of classes) {
    const deck = [];
    for (const format of formats) deck.push(...Array(plan[name][format]).fill(format));
    if (deck.length !== groups[name].length) {
      throw new Error(`Format quotas do not fill ${name}`);
    }
    shuffle(deck);
    groups[name].forEach((row, index) => {
      row.format = deck[index];
    });
  }
}

function pick(rows, period, format) {
  let pool = rows.filter(
    (row) =>
      row.kind === "normal" &&
      row.period === period &&
      row.format === format &&
      row.dow === "neutral"
  );

  // Hits and flops sit on Mon/Wed/Fri so they do not skew Tue/Thu vs the weekend.
  if (pool.length === 0) {
    const candidate = rows.find(
      (row) => row.kind === "normal" && row.period === period && row.format === format
    );
    const donor = rows.find((row) => row.kind === "normal" && row.period === period && row.dow === "neutral");
    if (!candidate || !donor) {
      throw new Error(`No neutral ${format} row available in ${period}`);
    }
    const day = candidate.day;
    const dow = candidate.dow;
    candidate.day = donor.day;
    candidate.dow = donor.dow;
    donor.day = day;
    donor.dow = dow;
    pool = [candidate];
  }

  return pool[randInt(0, pool.length - 1)];
}

function applyOutliers(rows) {
  const hits = [
    ["older", "story"],
    ["previous", "reel"],
    ["recent", "post"],
  ];
  const flops = [
    ["older", "reel"],
    ["older", "story"],
    ["previous", "post"],
    ["recent", "post"],
  ];

  for (const [period, format] of hits) {
    const row = pick(rows, period, format);
    row.kind = "hit";
  }
  for (const [period, format] of flops) {
    const row = pick(rows, period, format);
    row.kind = "flop";
    row.baseRates = { ...FLOP_RATES };
  }

  // Same morning/evening mix inside each format and weekday, so those
  // comparisons are not an artifact of which formats landed in which hours.
  const phase = { boost: 0, weekend: 1, neutral: 2 };
  for (const format of ["reel", "post", "story", "video"]) {
    for (const dow of ["boost", "weekend", "neutral"]) {
      const group = shuffle(
        rows.filter((row) => row.kind === "normal" && row.format === format && row.dow === dow)
      );
      group.forEach((row, index) => {
        row.bucket = ["morning", "evening", "other"][(index + phase[dow]) % 3];
      });
    }
  }
  for (const row of rows) {
    if (row.kind !== "normal") row.bucket = "other";
  }

  for (const row of rows) {
    const when = new Date(
      row.day.getFullYear(),
      row.day.getMonth(),
      row.day.getDate(),
      hourFor(row.bucket),
      [0, 15, 30, 45][randInt(0, 3)]
    );
    row.timestamp = when;
    row.date = stamp(when);

    const noise = row.format === "story" ? uniform(0.99, 1.01) : uniform(0.97, 1.03);
    const [minViews, maxViews] = VIEW_RANGE[row.format];
    const base = uniform(minViews, maxViews);
    row.views = clamp(
      Math.round(base * TIME_MUL[row.bucket] * DOW_MUL[row.dow] * noise),
      300,
      15000
    );
    if (!row.baseRates) row.baseRates = sampleRates(row.format);
  }

  for (const format of ["reel", "post", "story", "video"]) {
    const typical = rows.filter((row) => row.format === format && row.kind === "normal");
    const midpoint = median(typical.map((row) => row.views));
    for (const row of rows) {
      if (row.format !== format || row.kind !== "hit") continue;
      const maxFactor = 15000 / midpoint;
      if (maxFactor < 4) throw new Error(`${format} median is too high for a 4x hit`);
      const factor = uniform(4.15, Math.min(4.85, maxFactor));
      row.views = Math.round(midpoint * factor);
      if (row.views / midpoint < 4) row.views = Math.ceil(midpoint * 4);
      if (row.views > 15000) throw new Error(`${format} hit exceeds 15000 views`);
    }
  }

  for (const row of rows) {
    if (row.kind === "flop") row.views = randInt(300, 380);
  }
}

function chooseRecentScale(rows) {
  let best = null;
  for (let step = 700; step <= 850; step += 5) {
    const scale = step / 1000;
    const ratio = windowRatio(rows, scale);
    const error = Math.abs(ratio - 0.775);
    if (!best || error < best.error) best = { scale, ratio, error };
  }
  if (best.ratio < 0.75 || best.ratio > 0.8) {
    throw new Error(
      `Recent dip landed at ${((1 - best.ratio) * 100).toFixed(1)}% (scale ${best.scale})`
    );
  }
  return best.scale;
}

function windowRatio(rows, scale) {
  const scored = rows.map((row) => score(row, scale));
  const recent = average(scored.filter((row) => row.period === "recent").map((row) => row.rate));
  const previous = average(
    scored.filter((row) => row.period === "previous").map((row) => row.rate)
  );
  return recent / previous;
}

function score(row, scale) {
  const multiplier = row.period === "recent" ? scale : 1;
  const counts = countsFor(row.views, row.baseRates, multiplier);
  const rate = (counts.likes + counts.comments + counts.shares + counts.saves) / row.views;
  return { period: row.period, rate, counts };
}

function countsFor(views, rates, multiplier) {
  const counts = {};
  for (const key of ["likes", "comments", "shares", "saves"]) {
    const target = rates[key] * multiplier;
    let count = Math.round(views * target);
    const minCount = Math.ceil(views * RATE_MIN[key] - 1e-9);
    const maxCount = Math.floor(views * RATE_MAX[key] + 1e-9);
    if (count < minCount) count = minCount;
    if (count > maxCount) count = maxCount;
    counts[key] = clamp(count, 0, views);
  }
  return counts;
}

function materialize(rows, scale) {
  for (const row of rows) {
    const scored = score(row, scale);
    row.likes = scored.counts.likes;
    row.comments = scored.counts.comments;
    row.shares = scored.counts.shares;
    row.saves = scored.counts.saves;
  }
  rows.sort((a, b) => a.timestamp - b.timestamp);
}

function checkPatterns(rows) {
  const problems = [];
  const fail = (message) => problems.push(message);
  const normals = rows.filter((row) => row.kind === "normal");
  const byFormat = groupBy(rows, (row) => row.format);

  if (rows.length !== 75) fail(`expected 75 rows, got ${rows.length}`);
  for (const [format, count] of [
    ["reel", 30],
    ["post", 23],
    ["story", 15],
    ["video", 7],
  ]) {
    if (byFormat[format].length !== count) {
      fail(`${format} count ${byFormat[format].length}, expected ${count}`);
    }
  }

  const first = ymd(addDays(END, -89));
  if (rows[0].date.slice(0, 10) !== first || rows[rows.length - 1].date.slice(0, 10) !== ymd(END)) {
    fail(`date window ${rows[0].date} .. ${rows[rows.length - 1].date}`);
  }
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].timestamp < rows[i - 1].timestamp) fail("rows are not sorted");
  }

  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(row.date)) fail(`bad date ${row.date}`);
    if (/[,"]|[^\x20-\x7E]/.test(row.caption)) fail(`bad caption ${row.caption}`);
    for (const key of ["views", "likes", "comments", "shares", "saves"]) {
      if (!Number.isInteger(row[key])) fail(`${key} is not an integer`);
    }
    if (row.views < 300 || row.views > 15000) fail(`views out of range: ${row.views}`);
    for (const key of ["likes", "comments", "shares", "saves"]) {
      if (row[key] > row.views) fail(`${key} exceeds views`);
      const rate = row[key] / row.views;
      if (rate < RATE_MIN[key] - 1e-9 || rate > RATE_MAX[key] + 1e-9) {
        fail(`${row.format} ${key} rate ${rate.toFixed(4)} on ${row.date}`);
      }
    }
  }

  const viewAvg = averageBy(rows, (row) => row.views);
  const reelToPost = viewAvg.reel / viewAvg.post;
  if (reelToPost < 2.6 || reelToPost > 3.5) fail(`reel/post views ${reelToPost.toFixed(2)}`);
  if (!(viewAvg.video < viewAvg.post && viewAvg.video < viewAvg.story && viewAvg.video < viewAvg.reel)) {
    fail(`video views are not the lowest: ${JSON.stringify(viewAvg)}`);
  }

  const rateAvg = averageBy(rows, engagement);
  if (!(rateAvg.reel > rateAvg.post && rateAvg.reel > rateAvg.story && rateAvg.reel > rateAvg.video)) {
    fail(`reels do not have the best engagement: ${JSON.stringify(rateAvg)}`);
  }

  const likeAvg = averageBy(rows, (row) => row.likes / row.views);
  const commentAvg = averageBy(rows, (row) => row.comments / row.views);
  const shareAvg = averageBy(rows, (row) => row.shares / row.views);
  const saveAvg = averageBy(rows, (row) => row.saves / row.views);
  if (!(likeAvg.story < likeAvg.post && commentAvg.story < commentAvg.post && saveAvg.story < saveAvg.post)) {
    fail("stories do not have fewer likes, comments, and saves than posts");
  }
  for (const format of ["reel", "post", "story"]) {
    if (!(shareAvg.video > shareAvg[format] && saveAvg.video > saveAvg[format])) {
      fail(`videos do not beat ${format} on share/save rate`);
    }
  }

  const shareCount = averageBy(rows, (row) => row.shares);
  const saveCount = averageBy(rows, (row) => row.saves);
  for (const format of ["reel", "post", "story"]) {
    if (!(shareCount.video > shareCount[format] && saveCount.video > saveCount[format])) {
      fail(`videos do not beat ${format} on average share/save counts`);
    }
  }

  const medians = {};
  for (const format of ["reel", "post", "story", "video"]) {
    medians[format] = median(
      normals.filter((row) => row.format === format).map((row) => row.views)
    );
  }
  const timeRatio = bucketRatio(normals, "evening", "morning", medians);
  const rawTimeRatio =
    average(normals.filter((row) => row.bucket === "evening").map((row) => row.views)) /
    average(normals.filter((row) => row.bucket === "morning").map((row) => row.views));
  if (timeRatio < 1.3 || timeRatio > 1.4) fail(`evening/morning views ${timeRatio.toFixed(3)}`);
  if (rawTimeRatio < 1.3 || rawTimeRatio > 1.4) fail(`raw evening/morning ${rawTimeRatio.toFixed(3)}`);

  const dayRatio = dowRatio(normals, medians);
  const rawDayRatio =
    average(normals.filter((row) => row.dow === "boost").map((row) => row.views)) /
    average(normals.filter((row) => row.dow === "weekend").map((row) => row.views));
  if (dayRatio < 1.06 || dayRatio > 1.18) fail(`tue-thu vs weekend ${dayRatio.toFixed(3)}`);
  if (rawDayRatio < 1.05 || rawDayRatio > 1.2) {
    fail(`raw tue-thu vs weekend ${rawDayRatio.toFixed(3)}`);
  }

  const recent = average(rows.filter((row) => row.period === "recent").map(engagement));
  const previous = average(rows.filter((row) => row.period === "previous").map(engagement));
  const dip = 1 - recent / previous;
  if (dip < 0.2 || dip > 0.25) fail(`recent dip ${(dip * 100).toFixed(1)}%`);

  const hits = rows.filter((row) => row.kind === "hit");
  const flops = rows.filter((row) => row.kind === "flop");
  if (hits.length < 2 || hits.length > 3) fail(`hit count ${hits.length}`);
  if (flops.length < 3 || flops.length > 4) fail(`flop count ${flops.length}`);
  for (const hit of hits) {
    const multiple = hit.views / medians[hit.format];
    if (multiple < 4 || multiple > 5) fail(`${hit.format} hit is ${multiple.toFixed(2)}x`);
  }
  for (const flop of flops) {
    if (flop.views > 450 || engagement(flop) > 0.045) {
      fail(`flop is not clear: ${flop.views} views, er ${engagement(flop).toFixed(3)}`);
    }
  }
  for (const row of [...hits, ...flops]) {
    if (row.dow !== "neutral") fail(`${row.kind} landed on ${row.dow}`);
  }

  // Compare views after removing the time and weekday multipliers, so "steady" means less random swing.
  const residual = (row) => row.views / (TIME_MUL[row.bucket] * DOW_MUL[row.dow]);
  const storyCv = variation(normals.filter((row) => row.format === "story").map(residual));
  const reelCv = variation(normals.filter((row) => row.format === "reel").map(residual));
  if (storyCv >= reelCv) fail(`story views are not steadier than reels (${storyCv.toFixed(3)} vs ${reelCv.toFixed(3)})`);

  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
}

function bucketRatio(rows, high, low, medians) {
  const score = (bucket) =>
    average(
      rows.filter((row) => row.bucket === bucket).map((row) => row.views / medians[row.format])
    );
  return score(high) / score(low);
}

function dowRatio(rows, medians) {
  const score = (dow) =>
    average(rows.filter((row) => row.dow === dow).map((row) => row.views / medians[row.format]));
  return score("boost") / score("weekend");
}

function variation(values) {
  const mid = average(values);
  const variance = average(values.map((value) => (value - mid) ** 2));
  return Math.sqrt(variance) / mid;
}

function engagement(row) {
  return (row.likes + row.comments + row.shares + row.saves) / row.views;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageBy(rows, read) {
  const grouped = groupBy(rows, (row) => row.format);
  const result = {};
  for (const format of Object.keys(grouped)) {
    result[format] = average(grouped[format].map(read));
  }
  return result;
}

function groupBy(rows, key) {
  const grouped = {};
  for (const row of rows) {
    const name = key(row);
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(row);
  }
  return grouped;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function writeCsv(rows) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const header = "date,format,caption,views,likes,comments,shares,saves";
  const lines = rows.map((row) =>
    [row.date, row.format, row.caption, row.views, row.likes, row.comments, row.shares, row.saves].join(
      ","
    )
  );
  writeFileSync(join(root, "public", "sample.csv"), `${header}\n${lines.join("\n")}\n`);
}

function printSummary(rows) {
  const byFormat = averageBy(rows, engagement);
  const recent = average(rows.filter((row) => row.period === "recent").map(engagement));
  const previous = average(rows.filter((row) => row.period === "previous").map(engagement));
  const percent = (rate) => `${(rate * 100).toFixed(2)}%`;

  console.log(`total rows: ${rows.length}`);
  console.log("average engagement rate by format:");
  for (const format of ["reel", "post", "story", "video"]) {
    console.log(`  ${format}: ${percent(byFormat[format])}`);
  }
  console.log(`average engagement last 30 days: ${percent(recent)}`);
  console.log(`average engagement previous 30 days: ${percent(previous)}`);
}
