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
  ranked?: RankedEntry[];
  matches?: Match[];
}
