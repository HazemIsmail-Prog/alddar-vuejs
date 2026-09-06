import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/layouts/AppLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },
    {
      path: '/',
      component: AppLayout,
      meta: { auth: true },
      children: [
        { path: '', component: () => import('@/views/DashboardView.vue') },
        { path: 'orders', component: () => import('@/views/OrdersView.vue'), meta: { any: ['orders.view'] } },
        { path: 'orders/:id', component: () => import('@/views/OrderShowView.vue'), meta: { any: ['orders.view'] } },
        { path: 'dispatch', component: () => import('@/views/DispatchView.vue'), meta: { any: ['orders.dispatch'] } },
        { path: 'admin/statuses', redirect: { path: '/admin/users', query: { tab: 'statuses' } } },
        {
          path: 'tech',
          component: () => import('@/views/TechView.vue'),
          meta: { any: ['orders.accept', 'orders.reached', 'orders.complete', 'invoices.create'] },
        },
        { path: 'clients', component: () => import('@/views/ClientsView.vue'), meta: { any: ['clients.view'] } },
        { path: 'clients/:id', component: () => import('@/views/ClientShowView.vue'), meta: { any: ['clients.view'] } },
        { path: 'contracts', component: () => import('@/views/ContractsView.vue'), meta: { any: ['contracts.view'] } },
        { path: 'contracts/:id', component: () => import('@/views/ContractShowView.vue'), meta: { any: ['contracts.view'] } },
        {
          path: 'inventory',
          component: () => import('@/views/InventoryView.vue'),
          meta: { any: ['inventory.view', 'items.view', 'transfers.view', 'adjustments.view', 'inventory.receive', 'inventory.valuation'] },
        },
        { path: 'invoices', component: () => import('@/views/InvoicesView.vue'), meta: { any: ['invoices.view'] } },
        { path: 'invoices/:id', component: () => import('@/views/InvoiceView.vue'), meta: { any: ['invoices.view'] } },
        { path: 'accounting', component: () => import('@/views/AccountingView.vue'), meta: { any: ['accounting.view'] } },
        {
          path: 'admin/users',
          component: () => import('@/views/UsersView.vue'),
          meta: { any: ['users.view', 'roles.view', 'permissions.view', 'departments.view', 'statuses.update'] },
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.loaded) {
    await auth.fetchUser()
  }
  if (to.meta.auth && !auth.isLoggedIn) {
    return { name: 'login' }
  }
  if (to.meta.guest && auth.isLoggedIn) {
    return auth.homePath()
  }
  const roles = to.meta.roles as string[] | undefined
  if (roles?.length && !roles.some((role) => auth.hasRole(role))) {
    return auth.homePath()
  }
  const any = to.meta.any as string[] | undefined
  if (any?.length && !auth.canAny(...any)) {
    return auth.homePath()
  }
  if (auth.isLoggedIn && auth.isFieldTech() && to.path !== '/tech' && to.path !== '/login') {
    return '/tech'
  }
  return true
})

export default router
