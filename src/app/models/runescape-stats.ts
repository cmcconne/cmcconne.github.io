/** One OSRS skill from the Hiscores. */
export interface OsrsSkill {
  name: string;
  level: number;
  xp: number;
  /** Hiscores rank, or -1 if unranked. */
  rank: number;
}

/**
 * Shape of public/runescape-stats.json. Produced by
 * scripts/fetch-runescape-stats.mjs from the OSRS Hiscores API.
 */
export interface RunescapeStats {
  placeholder?: boolean;
  note?: string;
  username: string;
  updatedAt?: string;
  overall?: { level: number; xp: number; rank: number };
  combatLevel?: number;
  skills?: OsrsSkill[];
}
