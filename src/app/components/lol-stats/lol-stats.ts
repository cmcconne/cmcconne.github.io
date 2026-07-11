import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChampionMastery,
  ChampionPoolEntry,
  LolStats,
  Match,
  RankedEntry,
  RoleStat,
} from '../../models/lol-stats';

const QUEUE_NAMES: Record<string, string> = {
  RANKED_SOLO_5x5: 'Ranked Solo/Duo',
  RANKED_FLEX_SR: 'Ranked Flex',
  RANKED_PREMADE_5x5: 'Ranked 5v5',
  RANKED_TFT: 'Teamfight Tactics',
};

// match-v5 numeric queue ids -> display names.
const QUEUE_IDS: Record<number, string> = {
  400: 'Normal Draft',
  420: 'Ranked Solo/Duo',
  430: 'Normal Blind',
  440: 'Ranked Flex',
  450: 'ARAM',
  490: 'Quickplay',
  700: 'Clash',
  720: 'ARAM Clash',
  830: 'Co-op vs AI',
  840: 'Co-op vs AI',
  850: 'Co-op vs AI',
  900: 'ARURF',
  1700: 'Arena',
  1900: 'URF',
};

// Human labels for insight tags (used in the improvement summary chips).
const TAG_LABELS: Record<string, string> = {
  deaths: 'Deaths',
  discipline: 'Low deaths',
  kda: 'Strong KDA',
  kp: 'Kill participation',
  cs: 'CS / farming',
  laning: 'Lane dominance',
  vision: 'Vision control',
  'control-wards': 'Control wards',
  damage: 'Damage output',
  'solo-kills': 'Solo kills',
  'first-blood': 'First bloods',
  multikill: 'Multikills',
};

const POSITION_LABELS: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'ADC',
  UTILITY: 'Support',
};

@Component({
  selector: 'app-lol-stats',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './lol-stats.html',
  styleUrl: './lol-stats.scss',
})
export class LolStatsComponent {
  private readonly http = inject(HttpClient);

  /** Path to the stats JSON feed. */
  readonly feed = input.required<string>();

  /** Optional external match-history link (e.g. u.gg). */
  readonly historyUrl = input<string>();

  /** null = not loaded/failed; otherwise the fetched feed. */
  protected readonly stats = signal<LolStats | null>(null);
  protected readonly statsLoaded = signal(false);

  /** Which match row is expanded (matchId), if any. */
  protected readonly expandedId = signal<string | null>(null);

  /** Real (non-remake) recent matches. */
  private readonly realMatches = computed<Match[]>(() =>
    (this.stats()?.matches ?? []).filter((m) => !m.remake),
  );

  /** Per-champion performance aggregated from the recent matches. */
  protected readonly championPool = computed<ChampionPoolEntry[]>(() => {
    const acc = new Map<
      string,
      {
        champion: string;
        championId: number;
        games: number;
        wins: number;
        kills: number;
        deaths: number;
        assists: number;
        csSum: number;
        csGames: number;
      }
    >();
    for (const m of this.realMatches()) {
      let e = acc.get(m.champion);
      if (!e) {
        e = {
          champion: m.champion,
          championId: m.championId,
          games: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          csSum: 0,
          csGames: 0,
        };
        acc.set(m.champion, e);
      }
      e.games++;
      if (m.win) e.wins++;
      e.kills += m.kills;
      e.deaths += m.deaths;
      e.assists += m.assists;
      if (m.csPerMin != null && m.position !== 'UTILITY') {
        e.csSum += m.csPerMin;
        e.csGames++;
      }
    }
    return [...acc.values()]
      .map((e) => ({
        champion: e.champion,
        championId: e.championId,
        games: e.games,
        wins: e.wins,
        kills: e.kills,
        deaths: e.deaths,
        assists: e.assists,
        kda: +((e.kills + e.assists) / Math.max(1, e.deaths)).toFixed(2),
        csPerMin: e.csGames ? +(e.csSum / e.csGames).toFixed(1) : 0,
        winRate: Math.round((e.wins / e.games) * 100),
      }))
      .sort((a, b) => b.games - a.games || b.winRate - a.winRate);
  });

  /** Games played per role across the recent matches. */
  protected readonly roleStats = computed<RoleStat[]>(() => {
    const ms = this.realMatches().filter((m) => m.position);
    const total = ms.length;
    const acc = new Map<string, { games: number; wins: number }>();
    for (const m of ms) {
      const e = acc.get(m.position!) ?? { games: 0, wins: 0 };
      e.games++;
      if (m.win) e.wins++;
      acc.set(m.position!, e);
    }
    return [...acc.entries()]
      .map(([role, e]) => ({
        role,
        label: POSITION_LABELS[role] ?? role,
        games: e.games,
        wins: e.wins,
        pct: total ? Math.round((e.games / total) * 100) : 0,
      }))
      .sort((a, b) => b.games - a.games);
  });

  /** Recent win/loss sequence (most recent first). */
  protected readonly recentForm = computed(() =>
    this.realMatches()
      .slice(0, 15)
      .map((m) => ({ win: m.win, champion: m.champion, id: m.matchId })),
  );

  /** Headline aggregate over the recent matches. */
  protected readonly overall = computed(() => {
    const ms = this.realMatches();
    if (!ms.length) return null;
    const wins = ms.filter((m) => m.win).length;
    const kills = ms.reduce((s, m) => s + m.kills, 0);
    const deaths = ms.reduce((s, m) => s + m.deaths, 0);
    const assists = ms.reduce((s, m) => s + m.assists, 0);
    return {
      games: ms.length,
      wins,
      losses: ms.length - wins,
      winRate: Math.round((wins / ms.length) * 100),
      kda: +((kills + assists) / Math.max(1, deaths)).toFixed(2),
      kills,
      deaths,
      assists,
      favChampion: this.championPool()[0] ?? null,
      favRole: this.roleStats()[0] ?? null,
      pentakills: ms.filter((m) => (m.largestMultiKill ?? 0) >= 5).length,
    };
  });

  constructor() {
    effect(() => {
      const feed = this.feed();
      this.stats.set(null);
      this.statsLoaded.set(false);
      // Cache-bust so visitors always get the latest deployed stats.
      this.http.get<LolStats>(`${feed}?t=${Date.now()}`).subscribe({
        next: (data) => {
          this.stats.set(data);
          this.statsLoaded.set(true);
        },
        error: () => this.statsLoaded.set(true),
      });
    });
  }

  protected queueName(entry: RankedEntry): string {
    if (QUEUE_NAMES[entry.queue]) {
      return QUEUE_NAMES[entry.queue];
    }
    // Fallback: "RANKED_PREMADE_5x5" -> "Premade 5x5"
    return entry.queue
      .replace(/^RANKED_/, '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** "GOLD" + "II" -> "Gold II" */
  protected rankLabel(entry: RankedEntry): string {
    const tier = entry.tier
      ? entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase()
      : '';
    return `${tier} ${entry.rank}`.trim();
  }

  /** Ranked emblem image for a tier (Iron … Challenger). Self-hosted, trimmed. */
  protected rankEmblem(entry: RankedEntry): string {
    return `/images/ranks/${entry.tier.toLowerCase()}.png`;
  }

  /** Summoner profile icon image. */
  protected profileIcon(stats: LolStats): string {
    return (
      'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/' +
      `global/default/v1/profile-icons/${stats.profileIconId}.jpg`
    );
  }

  protected matchQueue(m: Match): string {
    return QUEUE_IDS[m.queueId] ?? 'Custom';
  }

  /** Reliable champion square icon by numeric id (no version/name mapping). */
  protected champSquare(championId: number): string {
    return (
      'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/' +
      `global/default/v1/champion-icons/${championId}.png`
    );
  }

  protected championIcon(m: Match): string {
    return this.champSquare(m.championId);
  }

  /** Centred splash art for a champion key (used as the header backdrop). */
  protected splashUrl(championKey: string): string {
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championKey}_0.jpg`;
  }

  /** 1_234_567 -> "1.2M", 45_300 -> "45.3K". */
  protected masteryPoints(points: number): string {
    if (points >= 1e6) return (points / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (points >= 1e3) return (points / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(points);
  }

  /** Colour tier for a mastery crest badge. */
  protected masteryClass(level: number): string {
    if (level >= 10) return 'm-gold';
    if (level >= 8) return 'm-purple';
    if (level >= 7) return 'm-teal';
    if (level >= 5) return 'm-red';
    return 'm-grey';
  }

  protected kda(m: Match): string {
    return `${m.kills} / ${m.deaths} / ${m.assists}`;
  }

  protected kdaRatio(m: Match): string {
    return ((m.kills + m.assists) / Math.max(1, m.deaths)).toFixed(2);
  }

  /** 1830s -> "30:30" */
  protected duration(m: Match): string {
    const mins = Math.floor(m.durationSec / 60);
    const secs = m.durationSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /** Compact relative time, e.g. "3h ago", "2d ago". */
  protected timeAgo(m: Match): string {
    const diff = Date.now() - m.endTimestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${Math.max(mins, 0)}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // --- Improvement tracker helpers -----------------------------------------

  protected toggle(matchId: string): void {
    this.expandedId.set(this.expandedId() === matchId ? null : matchId);
  }

  /** Whether this match has the deeper stats (newer feeds only). */
  protected hasDetail(m: Match): boolean {
    return m.csPerMin !== undefined;
  }

  protected positionLabel(m: Match): string | null {
    return m.position ? (POSITION_LABELS[m.position] ?? m.position) : null;
  }

  protected tagLabel(tag: string): string {
    return TAG_LABELS[tag] ?? tag;
  }

  /** Item icon via Data Dragon (needs the feed's ddragonVersion). */
  protected itemIcon(stats: LolStats, itemId: number): string | null {
    return stats.ddragonVersion
      ? `https://ddragon.leagueoflegends.com/cdn/${stats.ddragonVersion}/img/item/${itemId}.png`
      : null;
  }

  protected summaryWinRate(stats: LolStats): number {
    const s = stats.summary;
    return s?.games ? Math.round((s.wins / s.games) * 100) : 0;
  }

  // --- Live game + objectives ----------------------------------------------

  protected liveQueue(lg: NonNullable<LolStats['liveGame']>): string {
    return lg.queueId != null ? (QUEUE_IDS[lg.queueId] ?? 'game') : 'game';
  }

  /** Objective rows for the match detail (team vs enemy). */
  protected objectiveRows(
    m: Match,
  ): { label: string; team: number; enemy: number }[] {
    const o = m.objectives;
    if (!o) return [];
    const rows = [
      { label: 'Dragons', team: o.team.dragons, enemy: o.enemy.dragons },
      { label: 'Barons', team: o.team.barons, enemy: o.enemy.barons },
      { label: 'Towers', team: o.team.towers, enemy: o.enemy.towers },
      { label: 'Heralds', team: o.team.heralds, enemy: o.enemy.heralds },
      { label: 'Grubs', team: o.team.grubs, enemy: o.enemy.grubs },
    ];
    // Heralds/grubs only shown when either side actually got some.
    return rows.filter(
      (r) =>
        (r.label !== 'Heralds' && r.label !== 'Grubs') || r.team || r.enemy,
    );
  }
}
