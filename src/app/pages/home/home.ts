import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SectionService } from '../../services/section-service';
import { Section } from '../../models/section';

/** A deck reduced to what the MTG portal shows: art thumb + colour identity. */
interface DeckThumb {
  name: string;
  art?: string;
  colors: string[];
}

/** Current League rank, resolved to a rank-emblem image. */
interface LolRank {
  label: string;
  emblem: string;
  sub?: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly sectionService = inject(SectionService);
  private readonly http = inject(HttpClient);

  protected readonly sections = signal<Section[]>(this.sectionService.getAll());

  /** Live headline stat per section slug, for the portal badge. */
  protected readonly stats = signal<Record<string, string>>({});

  // --- Signature flourishes, one shape per game ---
  protected readonly lolRank = signal<LolRank | null>(null);
  protected readonly osrsSkills = signal<string[]>([]);
  protected readonly mtgDecks = signal<DeckThumb[]>([]);
  /** Commander-art crops used as the MTG portal backdrop montage. */
  protected readonly mtgArts = signal<string[]>([]);

  private static readonly RANK_EMBLEMS = new Set([
    'iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald',
    'diamond', 'master', 'grandmaster', 'challenger',
  ]);

  constructor() {
    const t = Date.now();

    // League of Legends — current Solo/Duo rank (with emblem), else level.
    this.http.get<any>(`/lol-stats.json?t=${t}`).subscribe({
      next: (d) => {
        if (!d || d.placeholder) return;
        const ranked: any[] = d.ranked ?? [];
        const solo =
          ranked.find((r) => r.queue === 'RANKED_SOLO_5x5') ?? ranked[0];
        const cap = (s: string) =>
          s ? s.charAt(0) + s.slice(1).toLowerCase() : '';
        if (solo?.tier) {
          const tier = String(solo.tier).toLowerCase();
          const label = `${cap(solo.tier)} ${solo.rank}`;
          this.setStat('league-of-legends', label);
          const wins = solo.wins ?? 0;
          const losses = solo.losses ?? 0;
          const games = wins + losses;
          const wr = games ? Math.round((wins / games) * 100) : null;
          this.lolRank.set({
            label,
            emblem: Home.RANK_EMBLEMS.has(tier)
              ? `/images/ranks/${tier}.png`
              : '',
            sub: [
              solo.leaguePoints != null ? `${solo.leaguePoints} LP` : null,
              wr != null ? `${wr}% WR` : null,
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
          });
        } else if (d.summonerLevel) {
          this.setStat('league-of-legends', `Level ${d.summonerLevel}`);
        }
      },
      error: () => {},
    });

    // Old School RuneScape — total level + the skill roster (icons).
    this.http.get<any>(`/runescape-stats.json?t=${t}`).subscribe({
      next: (d) => {
        const lvl = d?.overall?.level;
        if (lvl) {
          this.setStat(
            'runescape',
            lvl >= 2376 ? 'Maxed · 2,376 total' : `${lvl.toLocaleString()} total`,
          );
        }
        const skills: any[] = d?.skills ?? [];
        this.osrsSkills.set(
          skills
            .map((s) => String(s?.name ?? '').toLowerCase())
            .filter((n) => n && n !== 'overall'),
        );
      },
      error: () => {},
    });

    // Magic — deck count + per-deck art thumbs and colours.
    this.http.get<any>(`/mtg-decks.json?t=${t}`).subscribe({
      next: (d) => {
        const decks: any[] = d?.decks ?? [];
        if (decks.length) {
          this.setStat(
            'magic-the-gathering',
            `${decks.length} deck${decks.length === 1 ? '' : 's'}`,
          );
        }
        this.mtgDecks.set(
          decks.map((dk) => ({
            name: dk.name,
            art: (dk.arts ?? [])[0],
            colors: dk.colors ?? [],
          })),
        );
        this.mtgArts.set(
          decks.map((dk) => (dk.arts ?? [])[0]).filter(Boolean),
        );
      },
      error: () => {},
    });
  }

  private setStat(slug: string, value: string): void {
    this.stats.update((m) => ({ ...m, [slug]: value }));
  }

  protected stat(slug: string): string | undefined {
    return this.stats()[slug];
  }

  protected skillIcon(name: string): string {
    return `/images/osrs-skills/${name}.png`;
  }
}
