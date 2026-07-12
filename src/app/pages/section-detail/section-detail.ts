import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SectionService } from '../../services/section-service';
import { LolStatsComponent } from '../../components/lol-stats/lol-stats';
import { RunescapeStatsComponent } from '../../components/runescape-stats/runescape-stats';
import { MtgDecksComponent } from '../../components/mtg-decks/mtg-decks';

@Component({
  selector: 'app-section-detail',
  imports: [RouterLink, LolStatsComponent, RunescapeStatsComponent, MtgDecksComponent],
  templateUrl: './section-detail.html',
  styleUrl: './section-detail.scss',
})
export class SectionDetail {
  private readonly sectionService = inject(SectionService);
  private readonly http = inject(HttpClient);

  /** Bound from the :slug route param via withComponentInputBinding(). */
  readonly slug = input.required<string>();

  protected readonly section = computed(() =>
    this.sectionService.getBySlug(this.slug()),
  );

  // Themed page backdrop, drawn from each section's real art.
  protected readonly bgKind = signal<'photo' | 'tile' | null>(null);
  protected readonly bgImages = signal<string[]>([]);

  constructor() {
    effect(() => {
      const s = this.section();
      this.bgKind.set(null);
      this.bgImages.set([]);
      if (!s?.statsFeed) return;

      if (s.statsType === 'osrs') {
        // The stone interface texture — no fetch needed.
        this.bgKind.set('tile');
        return;
      }

      if (s.statsType === 'lol') {
        this.http.get<any>(s.statsFeed).subscribe({
          next: (d) => {
            if (!d || d.placeholder) return;
            const top = (d.championMastery ?? [])[0];
            const key = top?.key ?? top?.name?.replace(/[^A-Za-z0-9]/g, '');
            if (key) {
              this.bgImages.set([
                `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`,
              ]);
              this.bgKind.set('photo');
            }
          },
          error: () => {},
        });
      } else if (s.statsType === 'mtg') {
        this.http.get<any>(s.statsFeed).subscribe({
          next: (d) => {
            const arts = (d?.decks ?? [])
              .map((dk: any) => (dk.arts ?? [])[0])
              .filter(Boolean);
            if (arts.length) {
              this.bgImages.set(arts);
              this.bgKind.set('photo');
            }
          },
          error: () => {},
        });
      }
    });
  }
}
