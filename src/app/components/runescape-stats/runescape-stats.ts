import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { OsrsSkill, RunescapeStats } from '../../models/runescape-stats';
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
}
