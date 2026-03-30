import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'search',
    component: () => import('../views/SearchView.vue'),
  },
]
