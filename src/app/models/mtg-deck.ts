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

/** An owner-supplied alter / artist proof / signed card image. */
export interface CardAlter {
  image: string;
  kind: string;
  artist: string | null;
  note: string | null;
}

/** One card in a deck's full list. */
export interface DeckCard {
  name: string;
  /** Category: Commander/Creature/Instant/Sorcery/Artifact/Enchantment/Land/… */
  type: string;
  cmc: number;
  colors: string[];
  image: string | null;
  rank: number | null;
  uri: string | null;
  price: number | null;
  /** Present when the owner has an alter/proof of this card. */
  alter?: CardAlter;
}

/** Aggregate stats over a deck's cards. */
export interface DeckStats {
  count: number;
  lands: number;
  avgCmc: number;
  price: number;
  /** Mana curve buckets: 0,1,2,3,4,5,6,7+. */
  curve: number[];
  typeCounts: Record<string, number>;
  colorCounts: Record<string, number>;
  /** How many cards in the deck have an owner alter/proof. */
  alters?: number;
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
  /** Full decklist (commanders first, then mainboard). */
  cards?: DeckCard[];
  stats?: DeckStats;
}

export interface MtgDecks {
  updatedAt?: string;
  decks: MtgDeck[];
}
