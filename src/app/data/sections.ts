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
    logoImage: '/images/league-of-legends-logo.svg',
    tagline: 'Summoner on the Rift',
    intro: '',
    accent: '#0596aa',
    // The LoL page is driven entirely by live Riot data below.
    highlights: [],
    notes: [],
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
    statsType: 'lol',
  },
  {
    slug: 'runescape',
    name: 'Old School RuneScape',
    icon: '🐉',
    logoImage: '/images/osrs-logo.png',
    tagline: 'Adventurer of Gielinor',
    intro: '',
    accent: '#b5892f',
    // Driven entirely by live OSRS Hiscores data below.
    highlights: [],
    notes: [],
    profiles: [
      {
        label: 'OSRS Hiscores',
        url: 'https://secure.runescape.com/m=hiscore_oldschool/hiscorepersonal?user1=Stupid+Hands',
      },
    ],
    statsFeed: '/runescape-stats.json',
    statsType: 'osrs',
  },
  {
    slug: 'magic-the-gathering',
    name: 'Magic: The Gathering',
    icon: '🃏',
    logoImage: '/images/mtg-logo.png',
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
