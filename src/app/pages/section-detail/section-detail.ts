import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SectionService } from '../../services/section-service';
import { LolStats, RankedEntry } from '../../models/lol-stats';

const QUEUE_NAMES: Record<string, string> = {
  RANKED_SOLO_5x5: 'Ranked Solo/Duo',
  RANKED_FLEX_SR: 'Ranked Flex',
};

@Component({
  selector: 'app-section-detail',
  imports: [RouterLink, DatePipe],
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

  /** null = not loaded/failed; otherwise the fetched feed. */
  protected readonly stats = signal<LolStats | null>(null);
  protected readonly statsLoaded = signal(false);

  constructor() {
    // Fetch the stats feed whenever the active section has one.
    effect(() => {
      const feed = this.section()?.statsFeed;
      this.stats.set(null);
      this.statsLoaded.set(false);
      if (!feed) {
        return;
      }
      this.http.get<LolStats>(feed).subscribe({
        next: (data) => {
          this.stats.set(data);
          this.statsLoaded.set(true);
        },
        error: () => this.statsLoaded.set(true),
      });
    });
  }

  protected queueName(entry: RankedEntry): string {
    return QUEUE_NAMES[entry.queue] ?? entry.queue;
  }

  /** "GOLD" + "II" -> "Gold II" */
  protected rankLabel(entry: RankedEntry): string {
    const tier = entry.tier
      ? entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase()
      : '';
    return `${tier} ${entry.rank}`.trim();
  }
}
