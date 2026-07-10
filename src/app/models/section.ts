/** A single labelled stat/fact shown as a card within a section. */
export interface Highlight {
  label: string;
  value: string;
}

/** An outbound link to an external profile (op.gg, u.gg, etc.). */
export interface ProfileLink {
  label: string;
  url: string;
}

/** A showcase section — one of Charlie's interests. */
export interface Section {
  /** URL-friendly unique id, e.g. "league-of-legends" */
  slug: string;
  name: string;
  /** Emoji shown as the section icon */
  icon: string;
  /** Short one-liner shown on the home card */
  tagline: string;
  /** Longer intro shown at the top of the section page */
  intro: string;
  /** CSS colour used as the section's accent (any valid CSS colour) */
  accent: string;
  /** Key facts rendered as a grid of cards */
  highlights: Highlight[];
  /** Free-form bullet points (favourites, goals, fun facts) */
  notes: string[];
  /** Optional external profile links (rendered as buttons) */
  profiles?: ProfileLink[];
  /**
   * Optional path to a JSON stats feed (served as a static asset). When set,
   * the section page fetches it and renders an embedded live-stats block.
   */
  statsFeed?: string;
}
