import { readFileSync } from "fs";
import { join } from "path";
import Papa from "papaparse";
import { computeStats, parsePosts, type RawRow } from "../lib/analyze";

const csv = readFileSync(join(process.cwd(), "public", "sample.csv"), "utf8");
const parsed = Papa.parse<RawRow>(csv, { header: true, skipEmptyLines: true });
const { posts } = parsePosts(parsed.data);

console.log(JSON.stringify(computeStats(posts), null, 2));
