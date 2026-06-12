import { createRouter, createWebHistory } from 'vue-router'
import Assets from '../views/Assets.vue'
import AssetDetail from '../views/AssetDetail.vue'
import CreateTicket from '../views/CreateTicket.vue'
import KanbanBoard from '../views/KanbanBoard.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/assets',
      name: 'assets',
      component: Assets
    },
    {
      path: '/assets/:id/:itemType',
      name: 'asset-detail',
      component: AssetDetail
    },
    {
      path: '/create-ticket',
      name: 'create-ticket',
      component: CreateTicket
    },
    {
      path: '/kanban',
      name: 'kanban',
      component: KanbanBoard
    },
    {
      path: '/',
      redirect: '/kanban'
    }
  ]
})

export default router
