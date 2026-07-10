import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InducteeService } from '../../services/inductee-service';
import { Inductee } from '../../models/inductee';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly inducteeService = inject(InducteeService);
  protected readonly inductees = signal<Inductee[]>(this.inducteeService.getAll());
}
