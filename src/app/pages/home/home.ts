import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SectionService } from '../../services/section-service';
import { Section } from '../../models/section';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly sectionService = inject(SectionService);
  private readonly http = inject(HttpClient);

  protected readonly sections = signal<Section[]>(this.sectionService.getAll());

  /** Live headline stat per section slug, for the showcase cards. */
  protected readonly stats = signal<Record<string, string>>({});

  constructor() {
    const t = Date.now();

    // League of Legends — current Solo/Duo rank, else summoner level.
    this.http.get<any>(`/lol-stats.json?t=${t}`).subscribe({
      next: (d) => {
        if (!d || d.placeholder) return;
        const ranked: any[] = d.ranked ?? [];
        const solo =
          ranked.find((r) => r.queue === 'RANKED_SOLO_5x5') ?? ranked[0];
        const cap = (s: string) =>
          s ? s.charAt(0) + s.slice(1).toLowerCase() : '';
        const label = solo
          ? `${cap(solo.tier)} ${solo.rank}`
          : d.summonerLevel
            ? `Level ${d.summonerLevel}`
            : '';
        if (label) this.setStat('league-of-legends', label);
      },
      error: () => {},
    });

    // Old School RuneScape — total level (or "Maxed").
    this.http.get<any>(`/runescape-stats.json?t=${t}`).subscribe({
      next: (d) => {
        const lvl = d?.overall?.level;
        if (lvl)
          this.setStat(
            'runescape',
            lvl >= 2376 ? 'Maxed · 2,376' : `${lvl.toLocaleString()} total`,
          );
      },
      error: () => {},
    });

    // Magic — number of tracked decks.
    this.http.get<any>(`/mtg-decks.json?t=${t}`).subscribe({
      next: (d) => {
        const n = (d?.decks ?? []).length;
        if (n) this.setStat('magic-the-gathering', `${n} deck${n === 1 ? '' : 's'}`);
      },
      error: () => {},
    });
  }

  private setStat(slug: string, value: string): void {
    this.stats.update((m) => ({ ...m, [slug]: value }));
  }

  protected stat(slug: string): string | undefined {
    return this.stats()[slug];
  }
}
