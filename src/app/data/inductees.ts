import { Inductee } from '../models/inductee';

/**
 * Sample inductees. Replace these with the real members of
 * Charlie's Hall of Fame.
 */
export const INDUCTEES: Inductee[] = [
  {
    slug: 'ada-lovelace',
    name: 'Ada Lovelace',
    title: 'The First Programmer',
    yearInducted: 2024,
    bio: 'Ada Lovelace worked on Charles Babbage\'s Analytical Engine and is credited with writing the first algorithm intended to be carried out by a machine.',
    achievements: [
      'Wrote the first published computer algorithm',
      'Foresaw computing beyond pure calculation',
    ],
  },
  {
    slug: 'alan-turing',
    name: 'Alan Turing',
    title: 'Father of Computer Science',
    yearInducted: 2024,
    bio: 'Alan Turing formalised the concepts of algorithm and computation with the Turing machine and played a pivotal role in codebreaking during WWII.',
    achievements: [
      'Devised the Turing machine',
      'Proposed the Turing Test',
    ],
  },
  {
    slug: 'grace-hopper',
    name: 'Grace Hopper',
    title: 'Pioneer of Compilers',
    yearInducted: 2025,
    bio: 'Grace Hopper was a computer scientist and US Navy rear admiral who pioneered machine-independent programming languages.',
    achievements: [
      'Developed the first compiler',
      'Championed COBOL',
    ],
  },
];
