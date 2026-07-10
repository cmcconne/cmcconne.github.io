import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { SectionDetail } from './pages/section-detail/section-detail';

export const routes: Routes = [
  { path: '', component: Home, title: 'Charlie McConnell' },
  {
    path: ':slug',
    component: SectionDetail,
    title: 'Charlie McConnell · Showcase',
  },
  { path: '**', redirectTo: '' },
];
