import { Injectable } from '@angular/core';
import { INDUCTEES } from '../data/inductees';
import { Inductee } from '../models/inductee';

@Injectable({ providedIn: 'root' })
export class InducteeService {
  /** Returns all inductees, most recently inducted first. */
  getAll(): Inductee[] {
    return [...INDUCTEES].sort((a, b) => b.yearInducted - a.yearInducted);
  }

  /** Returns a single inductee by its slug, or undefined if not found. */
  getBySlug(slug: string): Inductee | undefined {
    return INDUCTEES.find((i) => i.slug === slug);
  }
}
