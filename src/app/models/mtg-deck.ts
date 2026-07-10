/** A curated Magic deck, enriched with Scryfall art/colour data. */
export interface MtgDeck {
  name: string;
  /** Commander(s) — exact card names, used to look up art/colours on Scryfall. */
  commanders: string[];
  format: string;
  moxfield?: string;
  description?: string;
  // --- filled in from Scryfall at build time ---
  /** One art_crop URL per commander (same order as `commanders`). */
  arts?: (string | null)[];
  /** Combined colour identity, ordered WUBRG, e.g. ["W","B","R"]. */
  colors?: string[];
  scryfallUri?: string | null;
}

export interface MtgDecks {
  updatedAt?: string;
  decks: MtgDeck[];
}
