import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { OsrsSkill, RunescapeStats } from '../../models/runescape-stats';

@Component({
  selector: 'app-runescape-stats',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './runescape-stats.html',
  styleUrl: './runescape-stats.scss',
})
export class RunescapeStatsComponent {
  private readonly http = inject(HttpClient);

  /** Path to the stats JSON feed. */
  readonly feed = input.required<string>();

  protected readonly stats = signal<RunescapeStats | null>(null);
  protected readonly statsLoaded = signal(false);

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
        },
        error: () => this.statsLoaded.set(true),
      });
    });
  }

  /** Self-hosted OSRS skill icon. */
  protected skillIcon(skill: OsrsSkill): string {
    return `/images/osrs-skills/${skill.name.toLowerCase()}.png`;
  }

  /** Self-hosted skill icon by name (for activities). */
  protected skillIconByName(name: string): string {
    return `/images/osrs-skills/${name.toLowerCase()}.png`;
  }

  /** RuneLite item icon by id. */
  protected itemIcon(itemId: number): string {
    return `https://static.runelite.net/cache/item/icon/${itemId}.png`;
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

  /** Compact relative time, e.g. "3d ago". */
  protected timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days >= 1) return `${days}d ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours >= 1) return `${hours}h ago`;
    return 'recently';
  }
}
