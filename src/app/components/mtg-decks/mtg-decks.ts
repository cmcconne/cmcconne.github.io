import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CardChip, MtgDeck, MtgDecks } from '../../models/mtg-deck';
import { TopdeckEvent, TopdeckStats } from '../../models/topdeck';
import { PlaygroupGame, PlaygroupStats } from '../../models/playgroup';

const COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};

@Component({
  selector: 'app-mtg-decks',
  imports: [DatePipe],
  templateUrl: './mtg-decks.html',
  styleUrl: './mtg-decks.scss',
})
export class MtgDecksComponent {
  private readonly http = inject(HttpClient);

  readonly feed = input.required<string>();

  protected readonly data = signal<MtgDecks | null>(null);
  protected readonly loaded = signal(false);
  protected readonly topdeck = signal<TopdeckStats | null>(null);
  protected readonly playgroup = signal<PlaygroupStats | null>(null);

  /** Which event row is expanded (event id), if any. */
  protected readonly expandedId = signal<string | null>(null);
  /** Year filter: 'all' or a 4-digit year string. */
  protected readonly yearFilter = signal('all');
  /** Bottom tab selection. */
  protected readonly activeTab = signal<'tournaments' | 'playgroup'>('tournaments');

  /** Playgroup data is only shown once real (non-placeholder) data exists. */
  protected readonly hasPlaygroup = computed(
    () => !!this.playgroup() && !this.playgroup()!.placeholder,
  );

  constructor() {
    effect(() => {
      const feed = this.feed();
      this.data.set(null);
      this.loaded.set(false);
      this.http.get<MtgDecks>(`${feed}?t=${Date.now()}`).subscribe({
        next: (d) => {
          this.data.set(d);
          this.loaded.set(true);
        },
        error: () => this.loaded.set(true),
      });
      // TopDeck tournament stats (best-effort; hides if unavailable).
      this.http
        .get<TopdeckStats>(`/topdeck-stats.json?t=${Date.now()}`)
        .subscribe({
          next: (t) => this.topdeck.set(t),
          error: () => this.topdeck.set(null),
        });
      // playgroup.gg casual stats (best-effort; tab hides if unavailable).
      this.http
        .get<PlaygroupStats>(`/playgroup-stats.json?t=${Date.now()}`)
        .subscribe({
          next: (p) => this.playgroup.set(p),
          error: () => this.playgroup.set(null),
        });
    });
  }

  /** Distinct event years, newest first (for the filter chips). */
  protected readonly years = computed<string[]>(() => {
    const ys = new Set(
      (this.topdeck()?.events ?? []).map((e) => e.date.slice(0, 4)),
    );
    return [...ys].sort().reverse();
  });

  protected readonly filteredEvents = computed<TopdeckEvent[]>(() => {
    const events = this.topdeck()?.events ?? [];
    const y = this.yearFilter();
    return y === 'all' ? events : events.filter((e) => e.date.startsWith(y));
  });

  /** Best (lowest) placement across all events. */
  protected readonly bestFinish = computed<TopdeckEvent | null>(() => {
    const events = this.topdeck()?.events ?? [];
    if (!events.length) return null;
    return events.reduce((best, e) =>
      e.placementNumber < best.placementNumber ? e : best,
    );
  });

  protected toggle(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  protected setYear(y: string): void {
    this.yearFilter.set(y);
    this.expandedId.set(null);
  }

  protected madeTopCut(e: TopdeckEvent): boolean {
    return !!e.topCut && e.topCut > 0 && e.placementNumber <= e.topCut;
  }

  protected commanderArt(t: TopdeckStats, name: string): string | null {
    return t.commanderArts?.[name] ?? null;
  }

  /** Colour identity to display, defaulting to Colorless. */
  protected pips(deck: MtgDeck): string[] {
    return deck.colors?.length ? deck.colors : ['C'];
  }

  protected colorName(c: string): string {
    return c === 'C' ? 'Colorless' : (COLOR_NAMES[c] ?? c);
  }

  /** Best outbound link for a deck: Moxfield if set, else Scryfall. */
  protected link(deck: MtgDeck): string | null {
    return deck.moxfield || deck.scryfallUri || null;
  }

  /** Front-face name for double-faced cards. */
  protected frontName(name: string): string {
    return name.split(' // ')[0];
  }

  protected newTitle(c: CardChip): string {
    return c.set ? `${c.set}${c.date ? ' · ' + c.date : ''}` : c.name;
  }

  protected spiceTitle(c: CardChip): string {
    return c.rank
      ? `EDHREC rank #${c.rank.toLocaleString()} — a rare pick`
      : c.name;
  }

  /** Career record as "6–33–9". */
  protected recordLine(t: TopdeckStats): string {
    const r = t.totals;
    return r ? `${r.wins}–${r.losses}–${r.draws}` : '';
  }

  // --- Playgroup helpers ----------------------------------------------------

  protected setTab(tab: 'tournaments' | 'playgroup'): void {
    this.activeTab.set(tab);
  }

  /** "combat_damage" -> "Combat damage". */
  protected winConLabel(g: PlaygroupGame): string {
    if (!g.winCon) return '';
    const s = g.winCon.replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Compact relative time for playgroup games, e.g. "3d ago". */
  protected gameAgo(g: PlaygroupGame): string {
    const diff = Date.now() - new Date(g.endedAt).getTime();
    const days = Math.floor(diff / 86400000);
    if (days >= 30) return `${Math.floor(days / 30)}mo ago`;
    if (days >= 1) return `${days}d ago`;
    const hours = Math.floor(diff / 3600000);
    return hours >= 1 ? `${hours}h ago` : 'today';
  }

  /** "played <my deck>" note for games someone else won. */
  protected myDeckNote(g: PlaygroupGame): string | null {
    return g.myDeck && !g.wonByMe ? `played ${g.myDeck}` : null;
  }

  protected bracketLabel(bracket: number | null | undefined): string | null {
    const names: Record<number, string> = {
      1: 'Exhibition',
      2: 'Core',
      3: 'Upgraded',
      4: 'Optimized',
      5: 'cEDH',
    };
    return bracket ? (names[bracket] ?? null) : null;
  }
}
