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

/** A metric gain over a period (Wise Old Man). */
export interface WomGain {
  metric: string;
  gained: number;
  level?: number | null;
}

/** A boss kill count (Wise Old Man latest snapshot). */
export interface WomBoss {
  metric: string;
  kills: number;
  rank?: number;
}

/** Gains over one time period (Wise Old Man). */
export interface WomPeriod {
  startsAt: string;
  endsAt: string;
  xpGained: number;
  ehpGained: number;
  ehbGained: number;
  skills: WomGain[];
  bosses: WomGain[];
}

/** Wise Old Man data: gains over week/month/year + boss KCs + PB records. */
export interface WomData {
  updatedAt?: string;
  periods?: {
    week: WomPeriod | null;
    month: WomPeriod | null;
    year: WomPeriod | null;
  };
  bosses?: WomBoss[];
  /** Personal-best kills per period (day/week/month): { metric: value }. */
  records?: {
    day: Record<string, number>;
    week: Record<string, number>;
    month: Record<string, number>;
  };
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
  /** Recently obtained collection-log items (from RuneProfile). */
  recentItems?: RsRecentItem[];
  /** Recent activities (from RuneProfile). */
  recentActivities?: RsActivity[];
  /** Whether a self-hosted 3D player/pet model is available to render. */
  hasModel?: boolean;
  hasPet?: boolean;
}
