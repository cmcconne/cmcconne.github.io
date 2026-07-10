import { Injectable } from '@angular/core';
import { SECTIONS } from '../data/sections';
import { Section } from '../models/section';

@Injectable({ providedIn: 'root' })
export class SectionService {
  /** Returns all sections in display order. */
  getAll(): Section[] {
    return SECTIONS;
  }

  /** Returns a single section by its slug, or undefined if not found. */
  getBySlug(slug: string): Section | undefined {
    return SECTIONS.find((s) => s.slug === slug);
  }
}
