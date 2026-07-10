import { Section } from '../models/section';

/**
 * Charlie's showcase sections.
 *
 * NOTE: The highlights/notes below are PLACEHOLDERS — swap in your real
 * ranks, stats, decks, and favourites. Order here is the order shown on
 * the home page.
 */
export const SECTIONS: Section[] = [
  {
    slug: 'league-of-legends',
    name: 'League of Legends',
    icon: '⚔️',
    tagline: 'Summoner on the Rift',
    intro:
      'My journey on Summoner\'s Rift — the roles I main, the champions I love, and where I\'ve climbed. Live rank and level are pulled from Riot\'s API below.',
    accent: '#0596aa',
    // Curated facts the API doesn't provide (edit freely).
    highlights: [
      { label: 'Main Role', value: 'Mid' },
      { label: 'Favourite Champions', value: 'Ahri · Syndra · Yasuo' },
      { label: 'Playing Since', value: 'Season 6' },
    ],
    notes: [
      'Prefer control mages and outplay-heavy champions.',
      'Goal: hit Diamond this season.',
    ],
    profiles: [
      {
        label: 'op.gg',
        url: 'https://www.op.gg/summoners/na/Naked%20and%20Afraid-lost',
      },
      {
        label: 'u.gg',
        url: 'https://u.gg/lol/profile/na1/Naked%20and%20Afraid-lost/overview',
      },
    ],
    statsFeed: '/lol-stats.json',
  },
  {
    slug: 'runescape',
    name: 'RuneScape',
    icon: '🐉',
    tagline: 'Adventurer of Gielinor',
    intro:
      'Skilling, questing, and bossing across Gielinor — my stats, favourite skills, and proudest achievements.',
    accent: '#b5892f',
    highlights: [
      { label: 'Total Level', value: '1500+' },
      { label: 'Favourite Skill', value: 'Slayer' },
      { label: 'Game Mode', value: 'Main' },
      { label: 'Notable Quest', value: 'Recipe for Disaster' },
    ],
    notes: [
      'Chasing 99s one skill at a time.',
      'Love a good boss grind.',
    ],
  },
  {
    slug: 'magic-the-gathering',
    name: 'Magic: The Gathering',
    icon: '🃏',
    tagline: 'Planeswalker & deck brewer',
    intro:
      'The formats I play, the colours I favour, and the decks I\'ve brewed at the kitchen table and beyond.',
    accent: '#7c3aed',
    highlights: [
      { label: 'Favourite Format', value: 'Commander' },
      { label: 'Colours', value: 'Golgari (B/G)' },
      { label: 'Favourite Deck', value: 'Graveyard value' },
      { label: 'Playing Since', value: 'Kitchen-table days' },
    ],
    notes: [
      'Happiest grinding value out of the graveyard.',
      'Always down for a Commander pod.',
    ],
  },
];
