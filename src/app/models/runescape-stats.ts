/** One OSRS skill from the Hiscores. */
export interface OsrsSkill {
  name: string;
  level: number;
  xp: number;
  /** Hiscores rank, or -1 if unranked. */
  rank: number;
}

/** A recently obtained collection-log item (from RuneProfile). */
export interface RsRecentItem {
  itemId: number;
  name?: string;
}

/**
 * A recent activity (from RuneProfile). `kind` selects which fields apply:
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
 * scripts/fetch-runescape-stats.mjs from the OSRS Hiscores API, enriched with
 * RuneProfile (collection log, recent items/activities, clan).
 */
export interface RunescapeStats {
  placeholder?: boolean;
  note?: string;
  username: string;
  updatedAt?: string;
  overall?: { level: number; xp: number; rank: number };
  combatLevel?: number;
  skills?: OsrsSkill[];
  // --- RuneProfile enrichment (optional) ---
  clan?: { name: string; title: string };
  collectionCount?: number;
  recentItems?: RsRecentItem[];
  recentActivities?: RsActivity[];
}
