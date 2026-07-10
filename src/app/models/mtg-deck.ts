/** A notable card within a deck (new-set or low-play-rate pick). */
export interface CardChip {
  name: string;
  set: string | null;
  /** Printing release date (newCards). */
  date: string | null;
  /** EDHREC rank — higher = less played (spiceCards). */
  rank: number | null;
  art: string | null;
  uri: string | null;
}

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
  /** Cards that debuted in a recent set. */
  newCards?: CardChip[];
  /** Rarely-played picks (worst EDHREC ranks in the deck). */
  spiceCards?: CardChip[];
}

export interface MtgDecks {
  updatedAt?: string;
  decks: MtgDeck[];
}
