import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface ClogItem {
  id: number;
  name: string;
  /** Quantity owned; 0 = not obtained. */
  q: number;
}
export interface ClogKc {
  label: string;
  count: number;
}
export interface ClogPage {
  name: string;
  aliases: string[];
  kc: ClogKc[];
  obtained: number;
  total: number;
  items: ClogItem[];
}
export interface ClogTab {
  name: string;
  pages: ClogPage[];
}
export interface ClogData {
  updatedAt: string;
  obtained: number;
  total: number;
  tabs: ClogTab[];
}

/** An entry in the page sidebar (search results span multiple tabs). */
interface PageRef {
  tabIdx: number;
  page: ClogPage;
}

@Component({
  selector: 'app-osrs-clog',
  templateUrl: './osrs-clog.html',
  styleUrl: './osrs-clog.scss',
})
export class OsrsClogComponent {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<ClogData | null>(null);
  protected readonly activeTabIdx = signal(0);
  protected readonly selected = signal<{ tab: number; name: string } | null>(null);
  protected readonly search = signal('');

  constructor() {
    this.http.get<ClogData>(`/osrs-clog.json?t=${Date.now()}`).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.data.set(null),
    });
  }

  /** Sidebar pages: active tab's pages, or cross-tab matches while searching. */
  protected readonly pageList = computed<PageRef[]>(() => {
    const d = this.data();
    if (!d) return [];
    const q = this.search().trim().toLowerCase();
    if (!q) {
      const ti = this.activeTabIdx();
      return (d.tabs[ti]?.pages ?? []).map((page) => ({ tabIdx: ti, page }));
    }
    const out: PageRef[] = [];
    d.tabs.forEach((t, tabIdx) => {
      for (const page of t.pages) {
        if (
          page.name.toLowerCase().includes(q) ||
          page.aliases.some((a) => a.toLowerCase().includes(q))
        ) {
          out.push({ tabIdx, page });
        }
      }
    });
    return out;
  });

  protected readonly activePage = computed<ClogPage | null>(() => {
    const d = this.data();
    if (!d) return null;
    const sel = this.selected();
    if (sel) {
      const p = d.tabs[sel.tab]?.pages.find((x) => x.name === sel.name);
      if (p) return p;
    }
    return this.pageList()[0]?.page ?? null;
  });

  protected setTab(i: number): void {
    this.activeTabIdx.set(i);
    this.selected.set(null);
    this.search.set('');
  }

  protected selectPage(ref: PageRef): void {
    this.activeTabIdx.set(ref.tabIdx);
    this.selected.set({ tab: ref.tabIdx, name: ref.page.name });
  }

  protected isSelected(ref: PageRef): boolean {
    const active = this.activePage();
    return !!active && active.name === ref.page.name;
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.selected.set(null);
  }

  /** Detail-pane colours: green = complete, yellow = started, red = untouched. */
  protected pageClass(p: ClogPage): string {
    if (p.obtained >= p.total) return 'done';
    return p.obtained > 0 ? 'partial' : 'none';
  }

  /** Sidebar colours match the in-game log: red until complete, then green. */
  protected sideClass(p: ClogPage): string {
    return p.obtained >= p.total ? 'done' : 'none';
  }

  protected itemIcon(id: number): string {
    return `https://static.runelite.net/cache/item/icon/${id}.png`;
  }

  protected itemTitle(i: ClogItem): string {
    return i.q > 0 ? i.name : `${i.name} — not obtained`;
  }
}
