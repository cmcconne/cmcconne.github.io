import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { InducteeDetail } from './pages/inductee-detail/inductee-detail';

export const routes: Routes = [
  { path: '', component: Home, title: "Charlie's Hall of Fame" },
  {
    path: 'inductee/:slug',
    component: InducteeDetail,
    title: 'Inductee · Hall of Fame',
  },
  { path: '**', redirectTo: '' },
];
