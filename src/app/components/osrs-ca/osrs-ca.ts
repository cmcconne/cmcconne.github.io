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
  /** Hiscores pixel-icon key, or null when the boss isn't on the hiscores. */
  hs: string | null;
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
  /** Top-level view: boss grid or the flat combat-achievements task list. */
  protected readonly view = signal<'bosses' | 'list'>('bosses');
  /** null = grid/list; a name = that boss's task detail. */
  protected readonly selectedName = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly tierFilter = signal(0); // 0 = all tiers
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

  /** The boss whose tasks are open, or null in grid/list view. */
  protected readonly activeMonster = computed<CaMonster | null>(() => {
    const sel = this.selectedName();
    if (!sel) return null;
    return this.data()?.monsters.find((m) => m.name === sel) ?? null;
  });

  /** Per-tier done/total, for the Task List tier chips. */
  protected readonly tierCounts = computed(() => {
    const rows = TIER_NAMES.slice(1).map((name, i) => ({
      tier: i + 1,
      name,
      done: 0,
      total: 0,
    }));
    for (const m of this.data()?.monsters ?? []) {
      for (const t of m.tasks) {
        const r = rows[t.tier - 1];
        if (!r) continue;
        r.total++;
        if (t.done) r.done++;
      }
    }
    return rows;
  });

  /** Flat list of every combat achievement (the "RuneScape CA list"). */
  protected readonly allTasks = computed<(CaTask & { monster: string })[]>(() => {
    const d = this.data();
    if (!d) return [];
    const q = this.search().trim().toLowerCase();
    const tier = this.tierFilter();
    const hide = this.hideDone();
    const out: (CaTask & { monster: string })[] = [];
    for (const m of d.monsters) {
      for (const t of m.tasks) {
        if (tier && t.tier !== tier) continue;
        if (hide && t.done) continue;
        if (
          q &&
          !t.name.toLowerCase().includes(q) &&
          !t.description.toLowerCase().includes(q) &&
          !m.name.toLowerCase().includes(q)
        )
          continue;
        out.push({ ...t, monster: m.name });
      }
    }
    out.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
    return out;
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

  protected setView(v: 'bosses' | 'list'): void {
    this.view.set(v);
    this.selectedName.set(null);
  }

  protected setTier(t: number): void {
    this.tierFilter.set(this.tierFilter() === t ? 0 : t);
  }

  protected onSearch(v: string): void {
    this.search.set(v);
  }

  protected toggleHideDone(): void {
    this.hideDone.set(!this.hideDone());
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

  /** Hiscores pixel icon when available, else the wiki boss image. */
  protected monsterIcon(m: CaMonster): string {
    return m.hs
      ? `/images/osrs-hiscores/${m.hs}.png`
      : `/images/osrs-monsters/${m.icon}.png`;
  }

  /** Fallback chain: hiscores icon → wiki image → generic emblem. */
  protected onIconError(e: Event, m: CaMonster): void {
    const img = e.target as HTMLImageElement;
    const wiki = `/images/osrs-monsters/${m.icon}.png`;
    if (!img.src.endsWith(wiki) && !img.src.includes('/osrs-ca/generic')) {
      img.src = wiki;
    } else {
      img.src = '/images/osrs-ca/generic.png';
    }
  }
}
