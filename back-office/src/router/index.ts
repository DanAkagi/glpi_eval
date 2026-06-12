import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import Tickets from '../views/Tickets.vue'
import Import from '../views/Import.vue'
import Reset from '../views/Reset.vue'
import CostsByAssets from '../views/CostsByAssets.vue'
import Assets from '../views/Assets.vue'
import AssetDetail from '../views/AssetDetail.vue'
import KanbanSettings from '../views/KanbanSettings.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/assets',
      name: 'assets',
      component: Assets,
      meta: { requiresAuth: true }
    },
    {
      path: '/assets/:id/:itemType',
      name: 'asset-detail',
      component: AssetDetail,
      meta: { requiresAuth: true }
    },
    {
      path: '/tickets',
      name: 'tickets',
      component: Tickets,
      meta: { requiresAuth: true }
    },
    {
      path: '/import',
      name: 'import',
      component: Import,
      meta: { requiresAuth: true }
    },
    {
      path: '/reset',
      name: 'reset',
      component: Reset,
      meta: { requiresAuth: true }
    },
    {
      path: '/kanban-settings',
      name: 'kanban-settings',
      component: KanbanSettings,
      meta: { requiresAuth: true }
    },
    {
      path: '/costs-by-assets',
      name: 'costs-by-assets',
      component: CostsByAssets,
      meta: { requiresAuth: true }
    },
    {
      path: '/',
      redirect: '/dashboard'
    }
  ]
})

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    try {
      const response = await fetch('http://localhost:3001/api/auth/status', {
        credentials: 'include'
      });
      const data = await response.json();
      if (!data.authenticated) {
        return '/login';
      }
    } catch (error) {
      return '/login';
    }
  }
})

export default router
