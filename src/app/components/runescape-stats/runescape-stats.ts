import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { OsrsSkill, RunescapeStats, WomData } from '../../models/runescape-stats';
import { OsrsCharacterComponent } from '../osrs-character/osrs-character';
import { OsrsClogComponent } from '../osrs-clog/osrs-clog';
import { OsrsCaComponent } from '../osrs-ca/osrs-ca';
import { OsrsProgressComponent } from '../osrs-progress/osrs-progress';

// OSRS in-game stats-panel order (fills the 3-column grid row by row).
const SKILL_ORDER = [
  'Attack', 'Hitpoints', 'Mining',
  'Strength', 'Agility', 'Smithing',
  'Defence', 'Herblore', 'Fishing',
  'Ranged', 'Thieving', 'Cooking',
  'Prayer', 'Crafting', 'Firemaking',
  'Magic', 'Fletching', 'Woodcutting',
  'Runecraft', 'Slayer', 'Farming',
  'Construction', 'Hunter', 'Sailing',
];

@Component({
  selector: 'app-runescape-stats',
  imports: [
    DatePipe,
    DecimalPipe,
    OsrsCharacterComponent,
    OsrsClogComponent,
    OsrsCaComponent,
    OsrsProgressComponent,
  ],
  templateUrl: './runescape-stats.html',
  styleUrl: './runescape-stats.scss',
})
export class RunescapeStatsComponent {
  private readonly http = inject(HttpClient);

  /** Path to the stats JSON feed. */
  readonly feed = input.required<string>();

  /** Optional real-time proxy base (the Cloudflare Worker); polls `${base}/osrs`. */
  readonly liveApi = input<string>('');

  protected readonly stats = signal<RunescapeStats | null>(null);
  protected readonly statsLoaded = signal(false);

  /** Wise Old Man weekly gains + boss KCs (from the proxy's /wom endpoint). */
  protected readonly wom = signal<WomData | null>(null);

  /** Skills reordered to match the OSRS in-game stats panel. */
  protected readonly orderedSkills = computed<OsrsSkill[]>(() => {
    const skills = this.stats()?.skills ?? [];
    const byName = new Map(skills.map((s) => [s.name, s]));
    return SKILL_ORDER.map(
      (name) =>
        byName.get(name) ?? { name, level: 1, xp: 0, rank: -1 },
    );
  });

  /** OSRS level colour: green at 99, red at 1, yellow otherwise. */
  protected levelClass(skill: OsrsSkill): string {
    if (skill.level >= 99) return 'lvl-max';
    if (skill.level <= 1) return 'lvl-min';
    return '';
  }

  /** Plain RuneProfile URL (for the credit / open-in-new-tab link). */
  protected readonly profileUrl = computed(() => {
    const username = this.stats()?.username;
    return username
      ? `https://runeprofile.com/${encodeURIComponent(username)}`
      : '';
  });

  constructor() {
    effect(() => {
      const feed = this.feed();
      this.stats.set(null);
      this.statsLoaded.set(false);
      // Cache-bust so visitors always get the latest deployed stats.
      this.http.get<RunescapeStats>(`${feed}?t=${Date.now()}`).subscribe({
        next: (data) => {
          this.stats.set(data);
          this.statsLoaded.set(true);
          this.mergeLive(); // re-apply proxy stats if they arrived first
        },
        error: () => this.statsLoaded.set(true),
      });
    });

    // Fresh Hiscores + recent activity from the proxy's /osrs endpoint, so the
    // skills grid and activity feed aren't limited to the 6-hourly snapshot.
    // Refreshes every 2 min; the Worker caches 3 min. Silent fallback on error.
    effect((onCleanup) => {
      const api = this.liveApi();
      if (!api) return;
      const base = api.replace(/\/+$/, '');
      let stopped = false;
      const poll = () => {
        this.http.get<Partial<RunescapeStats>>(`${base}/osrs?t=${Date.now()}`).subscribe({
          next: (d) => {
            if (stopped || !d?.skills?.length) return;
            this.liveData = d;
            this.mergeLive();
          },
          error: () => {},
        });
      };
      poll();
      const id = setInterval(poll, 120000);
      onCleanup(() => {
        stopped = true;
        clearInterval(id);
      });
    });

    // Wise Old Man weekly gains + boss KCs from the proxy's /wom endpoint.
    // Refreshes every 5 min (the Worker caches 5 min); optional, silent on error.
    effect((onCleanup) => {
      const api = this.liveApi();
      if (!api) return;
      const base = api.replace(/\/+$/, '');
      let stopped = false;
      const poll = () => {
        this.http.get<WomData>(`${base}/wom?t=${Date.now()}`).subscribe({
          next: (d) => {
            if (!stopped && d && !('error' in d)) this.wom.set(d);
          },
          error: () => {},
        });
      };
      poll();
      const id = setInterval(poll, 300000);
      onCleanup(() => {
        stopped = true;
        clearInterval(id);
      });
    });
  }

  /** Latest proxy-fetched OSRS stats, overlaid on the static feed. */
  private liveData: Partial<RunescapeStats> | null = null;

  /** Overlay the proxy's fresher stats onto the loaded feed, if both exist. */
  private mergeLive(): void {
    const d = this.liveData;
    if (!d) return;
    this.stats.update((s) =>
      s
        ? {
            ...s,
            overall: d.overall ?? s.overall,
            combatLevel: d.combatLevel ?? s.combatLevel,
            skills: d.skills ?? s.skills,
            recentItems: d.recentItems ?? s.recentItems,
            recentActivities: d.recentActivities ?? s.recentActivities,
            updatedAt: d.updatedAt ?? s.updatedAt,
          }
        : s,
    );
  }

  /** Self-hosted OSRS skill icon. */
  protected skillIcon(skill: OsrsSkill): string {
    return `/images/osrs-skills/${skill.name.toLowerCase()}.png`;
  }

  /** Self-hosted skill icon by name (for activities). */
  protected skillIconByName(name: string): string {
    return `/images/osrs-skills/${name.toLowerCase()}.png`;
  }

  /** RuneLite item icon by id (for activity drops). */
  protected itemIcon(itemId: number): string {
    return `https://static.runelite.net/cache/item/icon/${itemId}.png`;
  }

  /** Compact relative time, e.g. "3d ago". */
  protected timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days >= 1) return `${days}d ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours >= 1) return `${hours}h ago`;
    return 'recently';
  }

  /** Tooltip with rank and XP for a skill. */
  protected skillTitle(skill: OsrsSkill): string {
    const rank = skill.rank >= 0 ? skill.rank.toLocaleString() : 'unranked';
    const xp = skill.xp >= 0 ? skill.xp.toLocaleString() : '0';
    return `${skill.name} — level ${skill.level}, ${xp} xp, rank ${rank}`;
  }

  /** 12881561 -> "12.9M". */
  protected gp(value: number): string {
    if (value >= 1e9) return (value / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(value);
  }

  // --- Wise Old Man --------------------------------------------------------

  /** Selected gains period + KC highlight tab + KC record period. */
  protected readonly womPeriod = signal<'week' | 'month' | 'year'>('week');
  protected readonly kcTab = signal<'bosses' | 'raids'>('bosses');
  protected readonly kcPeriod = signal<'total' | 'day' | 'week' | 'month'>('total');

  /** The gains block for the selected period, or null. */
  protected readonly activePeriod = computed(
    () => this.wom()?.periods?.[this.womPeriod()] ?? null,
  );

  /** Which periods actually have data (to show/hide the toggle). */
  protected readonly hasAnyPeriod = computed(() => {
    const p = this.wom()?.periods;
    return !!(p && (p.week || p.month || p.year));
  });

  // OSRS raid metrics (WOM slugs), so KCs split into Bosses vs Raids.
  private static readonly RAID_METRICS = new Set([
    'chambers_of_xeric',
    'chambers_of_xeric_challenge_mode',
    'theatre_of_blood',
    'theatre_of_blood_hard_mode',
    'tombs_of_amascut',
    'tombs_of_amascut_expert',
  ]);

  /** Whether there's any KC data to show the Bosses & Raids panel. */
  protected readonly hasKcData = computed(() => {
    const w = this.wom();
    if (!w) return false;
    const r = w.records;
    return (
      (w.bosses?.length ?? 0) > 0 ||
      Object.keys(r?.day ?? {}).length > 0 ||
      Object.keys(r?.week ?? {}).length > 0 ||
      Object.keys(r?.month ?? {}).length > 0
    );
  });

  /**
   * KC rows for the active category + period, highest first (capped).
   * period 'total' = lifetime kills; day/week/month = personal-best records.
   */
  protected readonly activeKcs = computed<{ metric: string; value: number }[]>(() => {
    const w = this.wom();
    if (!w) return [];
    const period = this.kcPeriod();
    const wantRaid = this.kcTab() === 'raids';
    const rows =
      period === 'total'
        ? (w.bosses ?? []).map((b) => ({ metric: b.metric, value: b.kills }))
        : Object.entries(w.records?.[period] ?? {}).map(([metric, value]) => ({ metric, value }));
    return rows
      .filter((r) => RunescapeStatsComponent.RAID_METRICS.has(r.metric) === wantRaid)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  });

  protected setPeriod(p: 'week' | 'month' | 'year'): void {
    this.womPeriod.set(p);
  }
  protected setKcTab(t: 'bosses' | 'raids'): void {
    this.kcTab.set(t);
  }
  protected setKcPeriod(p: 'total' | 'day' | 'week' | 'month'): void {
    this.kcPeriod.set(p);
  }

  private static readonly WOM_ALIASES: Record<string, string> = {
    chambers_of_xeric: 'Chambers of Xeric',
    chambers_of_xeric_challenge_mode: 'CoX: Challenge Mode',
    theatre_of_blood: 'Theatre of Blood',
    theatre_of_blood_hard_mode: 'ToB: Hard Mode',
    tombs_of_amascut: 'Tombs of Amascut',
    tombs_of_amascut_expert: 'ToA: Expert',
    the_corrupted_gauntlet: 'Corrupted Gauntlet',
    tzkal_zuk: 'TzKal-Zuk',
    tztok_jad: 'TzTok-Jad',
    kril_tsutsaroth: "K'ril Tsutsaroth",
    kreearra: "Kree'arra",
  };

  /** Pretty display name for a WOM metric slug. */
  protected womName(metric: string): string {
    const alias = RunescapeStatsComponent.WOM_ALIASES[metric];
    if (alias) return alias;
    const small = new Set(['of', 'the', 'and', 'a', 'to']);
    return metric
      .split('_')
      .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ');
  }

  // WOM slug → Hiscores icon key, where stripping underscores isn't enough
  // (the Hiscores names a few activities differently, e.g. "Expert Mode").
  private static readonly BOSS_ICON_ALIASES: Record<string, string> = {
    tombs_of_amascut_expert: 'tombsofamascutexpertmode',
  };

  /** Self-hosted Hiscores boss icon (WOM slug → icon key). */
  protected bossIcon(metric: string): string {
    const key =
      RunescapeStatsComponent.BOSS_ICON_ALIASES[metric] ?? metric.replace(/_/g, '');
    return `/images/osrs-hiscores/${key}.png`;
  }

  /** Hide an icon that has no matching self-hosted image. */
  protected hideBroken(e: Event): void {
    (e.target as HTMLElement).style.display = 'none';
  }
}
