import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  protected readonly sections = signal<Section[]>(this.sectionService.getAll());
}
