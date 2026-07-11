import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface QuestEntry {
  name: string;
  /** 0 = not started, 1 = in progress, 2 = complete. */
  state: number;
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
  quests: { done: number; started: number; total: number; list: QuestEntry[] };
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
  protected readonly questList = computed<QuestEntry[]>(() => {
    const d = this.data();
    if (!d) return [];
    const q = this.search().trim().toLowerCase();
    const list = q
      ? d.quests.list.filter((x) => x.name.toLowerCase().includes(q))
      : d.quests.list;
    const rank = (s: number) => (s === 0 ? 0 : s === 1 ? 1 : 2);
    // Stable sort keeps the feed's alphabetical order within each state group.
    return [...list].sort((a, b) => rank(a.state) - rank(b.state));
  });

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

  protected onSearch(value: string): void {
    this.search.set(value);
  }
}
