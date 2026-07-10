import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InducteeService } from '../../services/inductee-service';

@Component({
  selector: 'app-inductee-detail',
  imports: [RouterLink],
  templateUrl: './inductee-detail.html',
  styleUrl: './inductee-detail.scss',
})
export class InducteeDetail {
  private readonly inducteeService = inject(InducteeService);

  /** Bound from the :slug route param via withComponentInputBinding(). */
  readonly slug = input.required<string>();

  protected readonly inductee = computed(() =>
    this.inducteeService.getBySlug(this.slug()),
  );
}
