/** A tracked casual deck on playgroup.gg. */
export interface PlaygroupDeck {
  name: string;
  commander: string | null;
  partner?: string | null;
  art?: string | null;
  partnerArt?: string | null;
  colors: string[];
  winRate: number | null;
  wins: number;
  losses: number;
  powerLevel?: number | null;
  /** Commander bracket 1–5 (5 = cEDH), when set by the owner. */
  bracket?: number | null;
  wincon?: string | null;
  url?: string | null;
  decklistUrl?: string | null;
  elo?: number | null;
}

/** A recent game within a playgroup. */
export interface PlaygroupGame {
  endedAt: string;
  rounds: number | null;
  winCon: string | null;
  players: number;
  winnerName: string | null;
  winnerDeck: string | null;
  wonByMe: boolean;
  myDeck: string | null;
}

export interface Playgroup {
  name: string;
  gameCount: number;
  memberCount: number;
  recentGames: PlaygroupGame[];
}

/** Shape of public/playgroup-stats.json. */
export interface PlaygroupStats {
  placeholder?: boolean;
  note?: string;
  updatedAt?: string;
  username?: string;
  profileUrl?: string;
  totals?: {
    games: number;
    wins: number;
    losses: number;
    winRate: number;
  };
  decks?: PlaygroupDeck[];
  playgroups?: Playgroup[];
}
