import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SectionService } from '../../services/section-service';
import { LolStats, Match, RankedEntry } from '../../models/lol-stats';

const QUEUE_NAMES: Record<string, string> = {
  RANKED_SOLO_5x5: 'Ranked Solo/Duo',
  RANKED_FLEX_SR: 'Ranked Flex',
  RANKED_PREMADE_5x5: 'Ranked 5v5',
  RANKED_TFT: 'Teamfight Tactics',
};

// match-v5 numeric queue ids -> display names.
const QUEUE_IDS: Record<number, string> = {
  400: 'Normal Draft',
  420: 'Ranked Solo/Duo',
  430: 'Normal Blind',
  440: 'Ranked Flex',
  450: 'ARAM',
  490: 'Quickplay',
  700: 'Clash',
  720: 'ARAM Clash',
  830: 'Co-op vs AI',
  840: 'Co-op vs AI',
  850: 'Co-op vs AI',
  900: 'ARURF',
  1700: 'Arena',
  1900: 'URF',
};

@Component({
  selector: 'app-section-detail',
  imports: [RouterLink, DatePipe],
  templateUrl: './section-detail.html',
  styleUrl: './section-detail.scss',
})
export class SectionDetail {
  private readonly sectionService = inject(SectionService);
  private readonly http = inject(HttpClient);

  /** Bound from the :slug route param via withComponentInputBinding(). */
  readonly slug = input.required<string>();

  protected readonly section = computed(() =>
    this.sectionService.getBySlug(this.slug()),
  );

  /** null = not loaded/failed; otherwise the fetched feed. */
  protected readonly stats = signal<LolStats | null>(null);
  protected readonly statsLoaded = signal(false);

  constructor() {
    // Fetch the stats feed whenever the active section has one.
    effect(() => {
      const feed = this.section()?.statsFeed;
      this.stats.set(null);
      this.statsLoaded.set(false);
      if (!feed) {
        return;
      }
      // Cache-bust so visitors always get the latest deployed stats.
      this.http.get<LolStats>(`${feed}?t=${Date.now()}`).subscribe({
        next: (data) => {
          this.stats.set(data);
          this.statsLoaded.set(true);
        },
        error: () => this.statsLoaded.set(true),
      });
    });
  }

  protected queueName(entry: RankedEntry): string {
    if (QUEUE_NAMES[entry.queue]) {
      return QUEUE_NAMES[entry.queue];
    }
    // Fallback: "RANKED_PREMADE_5x5" -> "Premade 5x5"
    return entry.queue
      .replace(/^RANKED_/, '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** "GOLD" + "II" -> "Gold II" */
  protected rankLabel(entry: RankedEntry): string {
    const tier = entry.tier
      ? entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase()
      : '';
    return `${tier} ${entry.rank}`.trim();
  }

  /** Ranked emblem image for a tier (Iron … Challenger). */
  protected rankEmblem(entry: RankedEntry): string {
    return (
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/' +
      `global/default/images/ranked-emblem/emblem-${entry.tier.toLowerCase()}.png`
    );
  }

  /** Summoner profile icon image. */
  protected profileIcon(stats: LolStats): string {
    return (
      'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/' +
      `global/default/v1/profile-icons/${stats.profileIconId}.jpg`
    );
  }

  protected matchQueue(m: Match): string {
    return QUEUE_IDS[m.queueId] ?? 'Custom';
  }

  /** Reliable champion square icon by numeric id (no version/name mapping). */
  protected championIcon(m: Match): string {
    return (
      'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/' +
      `global/default/v1/champion-icons/${m.championId}.png`
    );
  }

  protected kda(m: Match): string {
    return `${m.kills} / ${m.deaths} / ${m.assists}`;
  }

  protected kdaRatio(m: Match): string {
    return ((m.kills + m.assists) / Math.max(1, m.deaths)).toFixed(2);
  }

  /** 1830s -> "30:30" */
  protected duration(m: Match): string {
    const mins = Math.floor(m.durationSec / 60);
    const secs = m.durationSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /** Compact relative time, e.g. "3h ago", "2d ago". */
  protected timeAgo(m: Match): string {
    const diff = Date.now() - m.endTimestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${Math.max(mins, 0)}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
