import {
  Component,
  computed,
  effect,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  CardChip,
  DeckCard,
  MtgAlter,
  MtgDeck,
  MtgDecks,
} from '../../models/mtg-deck';
import { TopdeckEvent, TopdeckStats } from '../../models/topdeck';
import { PlaygroupGame, PlaygroupStats } from '../../models/playgroup';

const COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
};

const TYPE_ORDER = [
  'Commander',
  'Creature',
  'Planeswalker',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Battle',
  'Land',
  'Other',
];

@Component({
  selector: 'app-mtg-decks',
  imports: [DatePipe, DecimalPipe],
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

  /** Selected deck name for the interactive decklist, or null for the grid. */
  protected readonly selectedDeck = signal<string | null>(null);
  /** Card-name filter within the open deck. */
  protected readonly deckSearch = signal('');
  /** Card currently hovered in the decklist (drives the image preview). */
  protected readonly hoveredCard = signal<DeckCard | null>(null);
  /** A drawn sample opening hand (7 cards from the library). */
  protected readonly hand = signal<DeckCard[]>([]);
  /** Whether the deck's "Alters & proofs" strip is expanded. */
  protected readonly altersOpen = signal(true);

  // --- Collection gallery (alters / proofs / signed) ---
  protected readonly alterKind = signal<'all' | 'alter' | 'proof' | 'signed'>('all');
  protected readonly alterSearch = signal('');
  /** Index into the filtered gallery for the open lightbox, or -1. */
  protected readonly lightboxIndex = signal(-1);
  protected readonly lightboxOfficial = signal(false);

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

  /** The deck whose decklist is open. */
  protected readonly activeDeck = computed<MtgDeck | null>(() => {
    const name = this.selectedDeck();
    if (!name) return null;
    return this.data()?.decks.find((d) => d.name === name) ?? null;
  });

  /** Decklist grouping mode. */
  protected readonly sortMode = signal<'type' | 'cmc'>('type');

  /** Open deck's cards grouped for display (by type, or by mana value). */
  protected readonly deckView = computed<{ label: string; cards: DeckCard[] }[]>(
    () => {
      const deck = this.activeDeck();
      if (!deck?.cards) return [];
      const q = this.deckSearch().trim().toLowerCase();
      const cards = q
        ? deck.cards.filter((c) => c.name.toLowerCase().includes(q))
        : deck.cards;
      const byName = (a: DeckCard, b: DeckCard) => a.name.localeCompare(b.name);

      if (this.sortMode() === 'type') {
        return TYPE_ORDER.map((type) => ({
          label: type,
          cards: cards
            .filter((c) => c.type === type)
            .sort((a, b) => a.cmc - b.cmc || byName(a, b)),
        })).filter((g) => g.cards.length);
      }

      // Mana-value mode: commanders, then spells bucketed by MV, then lands.
      const groups: { label: string; cards: DeckCard[] }[] = [];
      const commanders = cards.filter((c) => c.type === 'Commander');
      if (commanders.length) groups.push({ label: 'Commander', cards: commanders });
      const buckets = new Map<number, DeckCard[]>();
      for (const c of cards) {
        if (c.type === 'Commander' || c.type === 'Land') continue;
        const b = Math.min(7, Math.floor(c.cmc));
        (buckets.get(b) ?? buckets.set(b, []).get(b)!).push(c);
      }
      for (const b of [...buckets.keys()].sort((a, z) => a - z)) {
        groups.push({
          label: (b >= 7 ? '7+' : b) + ' MV',
          cards: buckets.get(b)!.sort(byName),
        });
      }
      const lands = cards.filter((c) => c.type === 'Land');
      if (lands.length) groups.push({ label: 'Lands', cards: lands.sort(byName) });
      return groups;
    },
  );

  /** Card shown in the preview pane (hovered, else the first commander). */
  protected readonly previewCard = computed<DeckCard | null>(
    () => this.hoveredCard() ?? this.activeDeck()?.cards?.[0] ?? null,
  );

  /** Show official art instead of the alter in the preview. */
  protected readonly previewOfficial = signal(false);

  /** Image URL for the preview (alter by default, official when toggled). */
  protected readonly previewImage = computed<string | null>(() => {
    const c = this.previewCard();
    if (!c) return null;
    return c.alter && !this.previewOfficial() ? c.alter.image : c.image;
  });

  /** Cards in the open deck that have an alter/proof (for the gallery). */
  protected readonly alteredCards = computed<DeckCard[]>(
    () => this.activeDeck()?.cards?.filter((c) => c.alter) ?? [],
  );

  /** Priciest cards in the open deck (top 5 by USD value). */
  protected readonly topValueCards = computed<DeckCard[]>(
    () =>
      [...(this.activeDeck()?.cards ?? [])]
        .filter((c) => c.price)
        .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
        .slice(0, 5),
  );

  /** The full alter/proof/signed collection. */
  protected readonly allAlters = computed<MtgAlter[]>(
    () => this.data()?.alters ?? [],
  );

  /** Kind filter chips with counts (only kinds that exist). */
  protected readonly alterKinds = computed<{ key: string; label: string; n: number }[]>(
    () => {
      const all = this.allAlters();
      const counts: Record<string, number> = {};
      for (const a of all) counts[a.kind] = (counts[a.kind] ?? 0) + 1;
      const plural: Record<string, string> = {
        alter: 'Alters',
        proof: 'Proofs',
        signed: 'Signed',
      };
      const chips = [{ key: 'all', label: 'All', n: all.length }];
      for (const k of ['alter', 'proof', 'signed']) {
        if (counts[k]) chips.push({ key: k, label: plural[k] ?? k, n: counts[k] });
      }
      return chips;
    },
  );

  /** Gallery after kind + search filters. */
  protected readonly alterGallery = computed<MtgAlter[]>(() => {
    const kind = this.alterKind();
    const q = this.alterSearch().trim().toLowerCase();
    return this.allAlters().filter(
      (a) =>
        (kind === 'all' || a.kind === kind) &&
        (!q ||
          a.card.toLowerCase().includes(q) ||
          (a.artist ?? '').toLowerCase().includes(q)),
    );
  });

  /** The alter shown in the lightbox, or null. */
  protected readonly activeAlter = computed<MtgAlter | null>(() => {
    const i = this.lightboxIndex();
    return i >= 0 ? (this.alterGallery()[i] ?? null) : null;
  });

  /** Lightbox image — the alter photo, or the official printing when toggled. */
  protected readonly lightboxImage = computed<string | null>(() => {
    const a = this.activeAlter();
    if (!a) return null;
    return this.lightboxOfficial() ? a.official : a.image;
  });

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

  // --- Interactive decklist -------------------------------------------------

  protected openDeck(deck: MtgDeck): void {
    if (!deck.cards?.length) {
      const url = this.link(deck);
      if (url) window.open(url, '_blank', 'noopener');
      return;
    }
    this.selectedDeck.set(deck.name);
    this.deckSearch.set('');
    this.hoveredCard.set(null);
    this.hand.set([]);
    this.altersOpen.set(true);
  }

  protected toggleAlters(): void {
    this.altersOpen.set(!this.altersOpen());
  }

  protected closeDeck(): void {
    this.selectedDeck.set(null);
    this.hoveredCard.set(null);
    this.hand.set([]);
  }

  /** Draw a random 7-card opening hand from the deck's library (no commander). */
  protected drawHand(): void {
    const lib = (this.activeDeck()?.cards ?? []).filter(
      (c) => c.type !== 'Commander',
    );
    const a = [...lib];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    this.hand.set(a.slice(0, 7));
  }

  protected clearHand(): void {
    this.hand.set([]);
  }

  /** Lands in the current sample hand (for the keep/mulligan read). */
  protected readonly handLands = computed(
    () => this.hand().filter((c) => c.type === 'Land').length,
  );

  protected onDeckSearch(v: string): void {
    this.deckSearch.set(v);
  }

  protected setSortMode(m: 'type' | 'cmc'): void {
    this.sortMode.set(m);
  }

  protected setHover(c: DeckCard | null): void {
    if (c) this.previewOfficial.set(false);
    this.hoveredCard.set(c);
  }

  protected toggleOfficial(): void {
    this.previewOfficial.set(!this.previewOfficial());
  }

  /** Mana-cost symbols, e.g. "{2}{U}{U}" -> ["2","U","U"]. */
  protected manaSymbols(mana: string | undefined): string[] {
    if (!mana) return [];
    return (mana.match(/\{([^}]+)\}/g) ?? []).map((t) =>
      t.slice(1, -1).replace(/\//g, ''),
    );
  }

  /** Scryfall SVG for a mana symbol code. */
  protected symbolUrl(code: string): string {
    return `https://svgs.scryfall.io/card-symbols/${code}.svg`;
  }

  protected alterLabel(kind: string): string {
    return kind === 'proof'
      ? 'Artist proof'
      : kind === 'signed'
        ? 'Signed'
        : 'Alter';
  }

  // --- Collection gallery ---------------------------------------------------

  protected setAlterKind(k: 'all' | 'alter' | 'proof' | 'signed'): void {
    this.alterKind.set(k);
  }

  protected onAlterSearch(v: string): void {
    this.alterSearch.set(v);
  }

  protected openAlter(i: number): void {
    this.lightboxOfficial.set(false);
    this.lightboxIndex.set(i);
  }

  protected closeAlter(): void {
    this.lightboxIndex.set(-1);
  }

  protected stepAlter(delta: number): void {
    const len = this.alterGallery().length;
    if (!len) return;
    this.lightboxOfficial.set(false);
    this.lightboxIndex.set((this.lightboxIndex() + delta + len) % len);
  }

  protected toggleLightboxOfficial(): void {
    this.lightboxOfficial.set(!this.lightboxOfficial());
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(e: KeyboardEvent): void {
    if (this.lightboxIndex() < 0) return;
    if (e.key === 'Escape') this.closeAlter();
    else if (e.key === 'ArrowRight') this.stepAlter(1);
    else if (e.key === 'ArrowLeft') this.stepAlter(-1);
  }

  /** Tallest mana-curve bucket, for scaling the bars. */
  protected curveMax(deck: MtgDeck): number {
    return Math.max(1, ...(deck.stats?.curve ?? [1]));
  }

  /** Colour breakdown entries with a non-zero count, WUBRGC order. */
  protected colorList(deck: MtgDeck): { c: string; n: number }[] {
    const cc = deck.stats?.colorCounts ?? {};
    return ['W', 'U', 'B', 'R', 'G', 'C']
      .map((c) => ({ c, n: cc[c] ?? 0 }))
      .filter((e) => e.n > 0);
  }

  /** Largest colour count, for scaling the colour bars. */
  protected colorMax(deck: MtgDeck): number {
    return Math.max(1, ...this.colorList(deck).map((e) => e.n));
  }

  private readonly MANA_HEX: Record<string, string> = {
    W: '#f4e9c1',
    U: '#2a7fc4',
    B: '#6b6b6b',
    R: '#d3202a',
    G: '#1a9c5b',
    C: '#b3aca4',
  };

  protected pieHex(c: string): string {
    return this.MANA_HEX[c] ?? '#888';
  }

  /** Donut segments for the colour pie (dash length + offset, pathLength 100). */
  protected colorPie(
    deck: MtgDeck,
  ): { c: string; n: number; dash: number; off: number }[] {
    const list = this.colorList(deck);
    const total = list.reduce((s, e) => s + e.n, 0) || 1;
    let start = 0;
    return list.map((e) => {
      const dash = (e.n / total) * 100;
      const seg = { c: e.c, n: e.n, dash, off: 25 - start };
      start += dash;
      return seg;
    });
  }

  /** Type breakdown entries (excluding commanders), in list order. */
  protected typeList(deck: MtgDeck): { type: string; n: number }[] {
    const tc = deck.stats?.typeCounts ?? {};
    return TYPE_ORDER.filter((t) => t !== 'Commander' && tc[t]).map((type) => ({
      type,
      n: tc[type],
    }));
  }

  /** CMC label for the curve axis (7 -> "7+"). */
  protected curveLabel(i: number): string {
    return i >= 7 ? '7+' : String(i);
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
