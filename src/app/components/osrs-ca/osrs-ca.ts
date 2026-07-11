import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
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
  imports: [DecimalPipe],
  templateUrl: './osrs-ca.html',
  styleUrl: './osrs-ca.scss',
})
export class OsrsCaComponent {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<CaData | null>(null);
  protected readonly selectedName = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly tierFilter = signal(0); // 0 = all
  protected readonly hideDone = signal(false);

  constructor() {
    this.http.get<CaData>(`/osrs-ca.json?t=${Date.now()}`).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.data.set(null),
    });
  }

  /** Per-tier done/total, computed from the task set. */
  protected readonly tierSummary = computed(() => {
    const d = this.data();
    const rows = TIER_NAMES.slice(1).map((name, i) => ({
      tier: i + 1,
      name,
      done: 0,
      total: 0,
    }));
    for (const m of d?.monsters ?? []) {
      for (const t of m.tasks) {
        const r = rows[t.tier - 1];
        if (!r) continue;
        r.total++;
        if (t.done) r.done++;
      }
    }
    return rows;
  });

  /** Monsters filtered by the search box. */
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

  protected readonly activeMonster = computed<CaMonster | null>(() => {
    const list = this.monsterList();
    const sel = this.selectedName();
    return list.find((m) => m.name === sel) ?? list[0] ?? null;
  });

  /** Tasks of the active monster after tier / hide-completed filters. */
  protected readonly activeTasks = computed<CaTask[]>(() => {
    const m = this.activeMonster();
    if (!m) return [];
    const tier = this.tierFilter();
    const hide = this.hideDone();
    return m.tasks.filter(
      (t) => (tier === 0 || t.tier === tier) && (!hide || !t.done),
    );
  });

  protected select(name: string): void {
    this.selectedName.set(name);
  }

  protected onSearch(v: string): void {
    this.search.set(v);
    this.selectedName.set(null);
  }

  protected setTier(t: number): void {
    this.tierFilter.set(t);
  }

  protected toggleHideDone(): void {
    this.hideDone.set(!this.hideDone());
  }

  protected monsterClass(m: CaMonster): string {
    return m.done >= m.total ? 'done' : m.done > 0 ? 'partial' : 'none';
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
