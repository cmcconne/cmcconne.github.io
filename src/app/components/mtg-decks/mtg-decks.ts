import { Component, effect, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MtgDeck, MtgDecks } from '../../models/mtg-deck';

const COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};

@Component({
  selector: 'app-mtg-decks',
  templateUrl: './mtg-decks.html',
  styleUrl: './mtg-decks.scss',
})
export class MtgDecksComponent {
  private readonly http = inject(HttpClient);

  readonly feed = input.required<string>();

  protected readonly data = signal<MtgDecks | null>(null);
  protected readonly loaded = signal(false);

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
    });
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
}
