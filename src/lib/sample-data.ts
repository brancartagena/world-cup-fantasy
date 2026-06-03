import type { DraftPlayer } from "./draft";

export const samplePlayers: DraftPlayer[] = [
  { id: "mex-ochoa", name: "Guillermo Ochoa", team: "Mexico", position: "GK" },
  { id: "usa-pulisic", name: "Christian Pulisic", team: "USA", position: "MID" },
  { id: "usa-reyna", name: "Gio Reyna", team: "USA", position: "MID" },
  { id: "bra-vini", name: "Vinicius Junior", team: "Brazil", position: "FWD" },
  { id: "bra-alisson", name: "Alisson", team: "Brazil", position: "GK" },
  { id: "arg-messi", name: "Lionel Messi", team: "Argentina", position: "FWD" },
  { id: "arg-martinez", name: "Emiliano Martinez", team: "Argentina", position: "GK" },
  { id: "fra-mbappe", name: "Kylian Mbappe", team: "France", position: "FWD" },
  { id: "fra-maignan", name: "Mike Maignan", team: "France", position: "GK" },
  { id: "eng-kane", name: "Harry Kane", team: "England", position: "FWD" },
  { id: "eng-bellingham", name: "Jude Bellingham", team: "England", position: "MID" },
  { id: "por-ronaldo", name: "Cristiano Ronaldo", team: "Portugal", position: "FWD" },
  { id: "por-costa", name: "Diogo Costa", team: "Portugal", position: "GK" },
  { id: "esp-pedri", name: "Pedri", team: "Spain", position: "MID" },
  { id: "esp-simon", name: "Unai Simon", team: "Spain", position: "GK" },
  { id: "ger-musiala", name: "Jamal Musiala", team: "Germany", position: "MID" },
  { id: "ger-ter-stegen", name: "Marc-Andre ter Stegen", team: "Germany", position: "GK" },
  { id: "ned-van-dijk", name: "Virgil van Dijk", team: "Netherlands", position: "DEF" },
  { id: "ned-gakpo", name: "Cody Gakpo", team: "Netherlands", position: "FWD" },
  { id: "uru-valverde", name: "Federico Valverde", team: "Uruguay", position: "MID" },
  { id: "uru-nunez", name: "Darwin Nunez", team: "Uruguay", position: "FWD" },
  { id: "mar-hakimi", name: "Achraf Hakimi", team: "Morocco", position: "DEF" },
  { id: "mar-bounou", name: "Yassine Bounou", team: "Morocco", position: "GK" },
  { id: "jpn-mitoma", name: "Kaoru Mitoma", team: "Japan", position: "MID" },
  { id: "kor-son", name: "Son Heung-min", team: "South Korea", position: "FWD" },
];

export const sampleFixtures = [
  {
    id: "openfootball-2026-1",
    home: "Mexico",
    away: "South Africa",
    date: "2026-06-11",
    venue: "Mexico City",
  },
  {
    id: "openfootball-2026-19",
    home: "USA",
    away: "Paraguay",
    date: "2026-06-12",
    venue: "Los Angeles",
  },
  {
    id: "openfootball-2026-13",
    home: "Brazil",
    away: "Morocco",
    date: "2026-06-13",
    venue: "New York/New Jersey",
  },
];
