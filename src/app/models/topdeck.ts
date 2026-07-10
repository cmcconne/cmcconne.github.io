/** A single tournament result from TopDeck. */
export interface TopdeckEvent {
  id: string;
  name: string;
  date: string;
  record: string;
  placement: string;
  placementNumber: number;
  size: number;
  bracketLink?: string;
  topCut?: number;
  // --- present only when enriched via the authenticated TopDeck API ---
  /** Commander(s) piloted at this event. */
  commanders?: string[];
  /** Link to the submitted decklist (usually Moxfield). */
  decklistUrl?: string;
  /** Per-event win rate as a whole percentage. */
  winRatePct?: number;
  byes?: number;
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
  /** Commander name -> Scryfall art_crop URL (when enriched). */
  commanderArts?: Record<string, string>;
}
