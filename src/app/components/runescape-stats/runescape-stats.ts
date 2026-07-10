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

  /** Tooltip with rank and XP for a skill. */
  protected skillTitle(skill: OsrsSkill): string {
    const rank = skill.rank >= 0 ? skill.rank.toLocaleString() : 'unranked';
    const xp = skill.xp >= 0 ? skill.xp.toLocaleString() : '0';
    return `${skill.name} — level ${skill.level}, ${xp} xp, rank ${rank}`;
  }
}
