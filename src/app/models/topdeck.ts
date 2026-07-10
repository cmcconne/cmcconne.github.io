/** A single tournament result from TopDeck. */
export interface TopdeckEvent {
  name: string;
  date: string;
  record: string;
  placement: string;
  placementNumber: number;
  size: number;
  bracketLink?: string;
  topCut?: number;
}

/** Shape of public/topdeck-stats.json (from TopDeck's public profile stats). */
export interface TopdeckStats {
  updatedAt?: string;
  profileUrl?: string;
  elo?: number | null;
  eloGames?: number | null;
  tdcsPoints?: number | null;
  totals?: {
    tournaments: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
  };
  events?: TopdeckEvent[];
}
