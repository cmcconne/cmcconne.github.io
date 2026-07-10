import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionService } from '../../services/section-service';

@Component({
  selector: 'app-section-detail',
  imports: [RouterLink],
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
