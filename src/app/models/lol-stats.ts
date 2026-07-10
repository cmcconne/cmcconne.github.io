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
}
