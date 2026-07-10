import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
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

  /** Bound from the :slug route param via withComponentInputBinding(). */
  readonly slug = input.required<string>();

  protected readonly section = computed(() =>
    this.sectionService.getBySlug(this.slug()),
  );
}
