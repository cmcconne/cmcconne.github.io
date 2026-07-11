/** One OSRS skill from the Hiscores. */
export interface OsrsSkill {
  name: string;
  level: number;
  xp: number;
  /** Hiscores rank, or -1 if unranked. */
  rank: number;
}

/**
 * A recent activity (from RuneProfile — WikiSync has no activity feed).
 * `kind` selects which fields apply:
 * - 'quest' → label
 * - 'drop'  → itemId, name, value
 * - 'xp'    → skill, xp
 */
export interface RsActivity {
  kind: 'quest' | 'drop' | 'xp';
  date: string;
  label?: string;
  itemId?: number;
  name?: string;
  value?: number;
  skill?: string;
  xp?: number;
}

/**
 * Shape of public/runescape-stats.json. Produced by
 * scripts/fetch-runescape-stats.mjs from the OSRS Hiscores API. The collection
 * log, combat achievements, and quests/diaries are separate wiki-sourced feeds
 * (osrs-clog.json / osrs-ca.json / osrs-quests-diaries.json). Only the 3D
 * character render and the latest-activities feed come from RuneProfile.
 */
export interface RunescapeStats {
  placeholder?: boolean;
  note?: string;
  username: string;
  updatedAt?: string;
  overall?: { level: number; xp: number; rank: number };
  combatLevel?: number;
  skills?: OsrsSkill[];
  /** Recent activities (from RuneProfile). */
  recentActivities?: RsActivity[];
  /** Whether a self-hosted 3D player/pet model is available to render. */
  hasModel?: boolean;
  hasPet?: boolean;
}
