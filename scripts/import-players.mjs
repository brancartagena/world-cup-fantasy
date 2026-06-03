import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const [csvPath] = process.argv.slice(2);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!csvPath) {
  console.error("Usage: node scripts/import-players.mjs path/to/players.csv");
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const csv = await readFile(csvPath, "utf8");
const rows = parseCsv(csv);

const requiredColumns = ["name", "team", "position"];
for (const column of requiredColumns) {
  if (!rows[0] || !(column in rows[0])) {
    console.error(`Missing required CSV column: ${column}`);
    process.exit(1);
  }
}

const teamsByName = new Map();

for (const row of rows) {
  const teamName = row.team.trim();
  if (!teamName || teamsByName.has(teamName)) {
    continue;
  }

  const { data, error } = await supabase
    .from("teams")
    .upsert(
      {
        fifa_code: row.fifa_code?.trim() || null,
        group_name: row.group_name?.trim() || null,
        name: teamName,
      },
      { onConflict: "name" },
    )
    .select("id,name")
    .single();

  if (error) {
    throw error;
  }

  teamsByName.set(data.name, data.id);
}

let imported = 0;

for (const row of rows) {
  const name = row.name.trim();
  const teamName = row.team.trim();
  const teamId = teamsByName.get(teamName);

  if (!name || !teamId) {
    continue;
  }

  const { error } = await supabase.from("players").insert({
    api_football_id: row.api_football_id?.trim() || null,
    balldontlie_id: row.balldontlie_id?.trim() || null,
    name,
    position: normalizePosition(row.position),
    team_id: teamId,
  });

  if (error) {
    throw error;
  }

  imported += 1;
}

console.log(`Imported ${imported} players across ${teamsByName.size} teams.`);

function normalizePosition(value) {
  const normalized = value.trim().toUpperCase();

  if (["GK", "DEF", "MID", "FWD"].includes(normalized)) {
    return normalized;
  }

  if (normalized.includes("GOAL")) return "GK";
  if (normalized.includes("DEF")) return "DEF";
  if (normalized.includes("MID")) return "MID";
  return "FWD";
}

function parseCsv(input) {
  const lines = input.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines.shift()).map((header) => header.trim());

  return lines
    .filter((line) => line.trim())
    .map((line) => {
      const values = splitCsvLine(line);
      return Object.fromEntries(
        headers.map((header, index) => [header, values[index]?.trim() ?? ""]),
      );
    });
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}
