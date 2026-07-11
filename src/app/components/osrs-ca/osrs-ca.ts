import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface CaTask {
  name: string;
  tier: number;
  type: string;
  description: string;
  comp: number | null;
  done: boolean;
}
export interface CaMonster {
  name: string;
  icon: string;
  done: number;
  total: number;
  tasks: CaTask[];
}
export interface CaData {
  updatedAt: string;
  hasCompletion: boolean;
  done: number;
  total: number;
  points: number | null;
  monsters: CaMonster[];
}

const TIER_NAMES = ['', 'Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'];

@Component({
  selector: 'app-osrs-ca',
  templateUrl: './osrs-ca.html',
  styleUrl: './osrs-ca.scss',
})
export class OsrsCaComponent {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<CaData | null>(null);
  /** null = boss grid ("Task List"); a name = that boss's task detail. */
  protected readonly selectedName = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly hideDone = signal(false);

  constructor() {
    this.http.get<CaData>(`/osrs-ca.json?t=${Date.now()}`).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.data.set(null),
    });
  }

  /** Monsters filtered by the search box (grid view). */
  protected readonly monsterList = computed<CaMonster[]>(() => {
    const d = this.data();
    if (!d) return [];
    const q = this.search().trim().toLowerCase();
    if (!q) return d.monsters;
    return d.monsters.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.tasks.some((t) => t.name.toLowerCase().includes(q)),
    );
  });

  /** The boss whose tasks are open, or null in grid view. */
  protected readonly activeMonster = computed<CaMonster | null>(() => {
    const sel = this.selectedName();
    if (!sel) return null;
    return this.data()?.monsters.find((m) => m.name === sel) ?? null;
  });

  /** Tasks of the active monster after the hide-completed filter. */
  protected readonly activeTasks = computed<CaTask[]>(() => {
    const m = this.activeMonster();
    if (!m) return [];
    const hide = this.hideDone();
    return [...m.tasks]
      .filter((t) => !hide || !t.done)
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  });

  protected select(name: string): void {
    this.selectedName.set(name);
  }

  protected back(): void {
    this.selectedName.set(null);
  }

  protected onSearch(v: string): void {
    this.search.set(v);
  }

  protected toggleHideDone(): void {
    this.hideDone.set(!this.hideDone());
  }

  /** Scroll up to the collection log (the "View Clog" button). */
  protected viewClog(): void {
    document
      .querySelector('app-osrs-clog')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected monsterClass(m: CaMonster): string {
    return m.done >= m.total ? 'done' : m.done > 0 ? 'partial' : 'none';
  }

  /** Progress-bar fill percentage for a boss card. */
  protected pct(m: CaMonster): number {
    return m.total ? Math.round((m.done / m.total) * 100) : 0;
  }

  protected tierName(t: number): string {
    return TIER_NAMES[t] ?? '';
  }

  protected tierIcon(t: number): string {
    return `/images/osrs-ca/tier-${(TIER_NAMES[t] ?? 'easy').toLowerCase()}.png`;
  }

  protected monsterIcon(m: CaMonster): string {
    return `/images/osrs-monsters/${m.icon}.png`;
  }

  /** Swap a missing monster icon (Giants / General) for the generic emblem. */
  protected onIconError(e: Event): void {
    (e.target as HTMLImageElement).src = '/images/osrs-ca/generic.png';
  }
}
