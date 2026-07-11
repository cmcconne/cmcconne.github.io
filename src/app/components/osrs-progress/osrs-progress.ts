import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface QuestEntry {
  name: string;
  /** 0 = not started, 1 = in progress, 2 = complete. */
  state: number;
  mini?: boolean;
}
interface QuestGroup {
  done: number;
  started: number;
  total: number;
  list: QuestEntry[];
}
interface DiaryTier {
  tier: string;
  complete: boolean;
  done: number;
  total: number;
}
interface DiaryArea {
  area: string;
  tiers: DiaryTier[];
  complete: boolean;
}
export interface QuestsDiaries {
  updatedAt: string;
  quests: QuestGroup & { mini: QuestGroup };
  diaries: {
    areasComplete: number;
    areasTotal: number;
    tiersComplete: number;
    tiersTotal: number;
    list: DiaryArea[];
  };
}

@Component({
  selector: 'app-osrs-progress',
  templateUrl: './osrs-progress.html',
  styleUrl: './osrs-progress.scss',
})
export class OsrsProgressComponent {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<QuestsDiaries | null>(null);
  protected readonly search = signal('');

  constructor() {
    this.http.get<QuestsDiaries>(`/osrs-quests-diaries.json?t=${Date.now()}`).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.data.set(null),
    });
  }

  /** Quests, incomplete first (not started, then started, then complete). */
  protected readonly mainQuests = computed<QuestEntry[]>(() =>
    this.filterSort(this.data()?.quests.list),
  );
  /** Miniquests, same ordering. */
  protected readonly miniQuests = computed<QuestEntry[]>(() =>
    this.filterSort(this.data()?.quests.mini.list),
  );

  private filterSort(list: QuestEntry[] | undefined): QuestEntry[] {
    if (!list) return [];
    const q = this.search().trim().toLowerCase();
    const filtered = q ? list.filter((x) => x.name.toLowerCase().includes(q)) : list;
    const rank = (s: number) => (s === 0 ? 0 : s === 1 ? 1 : 2);
    // Stable sort keeps the feed's alphabetical order within each state group.
    return [...filtered].sort((a, b) => rank(a.state) - rank(b.state));
  }

  /** In-game quest-list colours: red = not started, yellow = started, green = complete. */
  protected questClass(state: number): string {
    return state === 2 ? 'done' : state === 1 ? 'partial' : 'none';
  }

  protected questLabel(state: number): string {
    return state === 2 ? 'Complete' : state === 1 ? 'In progress' : 'Not started';
  }

  protected tierClass(t: DiaryTier): string {
    return t.complete ? 'done' : t.done > 0 ? 'partial' : 'none';
  }

  protected areaClass(a: DiaryArea): string {
    if (a.complete) return 'done';
    return a.tiers.some((t) => t.done > 0) ? 'partial' : 'none';
  }

  /** Total diary tasks done / total across an area's four tiers. */
  protected areaDone(a: DiaryArea): number {
    return a.tiers.reduce((s, t) => s + t.done, 0);
  }
  protected areaTotal(a: DiaryArea): number {
    return a.tiers.reduce((s, t) => s + t.total, 0);
  }

  /** Progress-bar fill % for a single tier. */
  protected tierPct(t: DiaryTier): number {
    return t.total ? Math.round((t.done / t.total) * 100) : 0;
  }

  protected onSearch(value: string): void {
    this.search.set(value);
  }
}
