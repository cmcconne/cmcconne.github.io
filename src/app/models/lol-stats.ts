/** One ranked-queue entry from Riot's league-v4 API. */
export interface RankedEntry {
  /** Raw queue id, e.g. "RANKED_SOLO_5x5" */
  queue: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  /** Win rate as a whole percentage (0–100) */
  winRate: number;
}

/** One coaching note, tagged so recurring themes can be counted. */
export interface Insight {
  tag: string;
  text: string;
}

export interface MatchInsights {
  good: Insight[];
  bad: Insight[];
}

/** Objective counts for one team in a match. */
export interface ObjectiveCounts {
  dragons: number;
  barons: number;
  towers: number;
  heralds: number;
  grubs: number;
  inhibs: number;
}

/** Keystone + secondary-tree rune icon URLs for a match. */
export interface MatchRunes {
  keystone: string | null;
  secondary: string | null;
}

/** A single recent match from Riot's match-v5 API. */
export interface Match {
  matchId: string;
  /** Data Dragon champion key, e.g. "Ahri" */
  champion: string;
  championId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  /** Numeric queue id, e.g. 420 for Ranked Solo/Duo */
  queueId: number;
  durationSec: number;
  /** Epoch milliseconds of when the game ended */
  endTimestamp: number;
  // --- deeper stats (present on newer feeds) ---
  /** TOP / JUNGLE / MIDDLE / BOTTOM / UTILITY */
  position?: string | null;
  cs?: number;
  csPerMin?: number;
  goldPerMin?: number;
  damage?: number;
  /** Whole percentage of team damage. */
  damageShare?: number | null;
  visionScore?: number;
  visionPerMin?: number;
  /** Whole percentage. */
  killParticipation?: number | null;
  soloKills?: number;
  controlWards?: number;
  wardsPlaced?: number;
  largestMultiKill?: number;
  firstBlood?: boolean;
  /** Max CS lead over lane opponent. */
  csLead?: number | null;
  /** Item ids (final build + trinket). */
  items?: number[];
  /** Player's team vs enemy objective counts. */
  objectives?: { team: ObjectiveCounts; enemy: ObjectiveCounts };
  /** Keystone + secondary-tree rune icon URLs. */
  runes?: MatchRunes;
  /** Summoner-spell icon URLs (2). */
  spells?: (string | null)[];
  remake?: boolean;
  insights?: MatchInsights;
}

/** Current game info from spectator-v5 (present only while in a game). */
export interface LiveGame {
  queueId: number | null;
  championId: number | null;
  champion: string | null;
  gameLength: number;
  startTime: number | null;
}

/** One champion-mastery entry from Riot's champion-mastery-v4 API. */
export interface ChampionMastery {
  championId: number;
  name: string | null;
  level: number;
  points: number;
  chest: boolean;
  tokens: number;
  lastPlay: number | null;
}

/** Aggregate over the recent matches — the improvement dashboard. */
export interface LolSummary {
  games: number;
  wins: number;
  avgKda: number;
  avgDeaths: number;
  avgCsPerMin: number | null;
  avgKp: number;
  avgVisionPerMin: number;
  strengths: { tag: string; count: number }[];
  focusAreas: { tag: string; count: number }[];
}

/**
 * Shape of public/lol-stats.json. Produced by scripts/fetch-lol-stats.mjs.
 * While no Riot API key is connected, a placeholder version is served.
 */
export interface LolStats {
  /** True when this is the pre-key placeholder (no real data yet). */
  placeholder?: boolean;
  note?: string;
  riotId: string;
  /** ISO timestamp of when the data was fetched. */
  updatedAt?: string;
  summonerLevel?: number;
  profileIconId?: number;
  /** Data Dragon version for item icons. */
  ddragonVersion?: string | null;
  ranked?: RankedEntry[];
  championMastery?: ChampionMastery[];
  /** Total mastery score across all champions. */
  masteryScore?: number | null;
  /** Present only while in a game. */
  liveGame?: LiveGame | null;
  matches?: Match[];
  summary?: LolSummary | null;
}

/** Aggregated per-champion performance over the recent matches. */
export interface ChampionPoolEntry {
  champion: string;
  championId: number;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  csPerMin: number;
  winRate: number;
}

/** Games played in one role over the recent matches. */
export interface RoleStat {
  role: string;
  label: string;
  games: number;
  wins: number;
  pct: number;
}
