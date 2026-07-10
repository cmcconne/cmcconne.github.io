export interface Inductee {
  /** URL-friendly unique id, e.g. "ada-lovelace" */
  slug: string;
  name: string;
  /** Short tagline shown on the card */
  title: string;
  /** Year inducted into the hall of fame */
  yearInducted: number;
  /** Longer description shown on the detail page */
  bio: string;
  /** One or more notable achievements */
  achievements: string[];
}
