import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api, { csrf } from '@/api/client'

export type AuthUser = {
  id: number
  name_en: string
  name_ar: string
  civil_id: string
  email: string | null
  is_active: boolean
  roles: string[]
  permissions: string[]
  field_tech: boolean
  departments: { id: number; name_en: string; name_ar: string }[]
  warehouse: { id: number; name: string } | null
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loaded = ref(false)

  const isLoggedIn = computed(() => !!user.value)
  function can(permission: string) {
    return user.value?.permissions.includes(permission) ?? false
  }
  function canAny(...permissions: string[]) {
    return permissions.some((p) => can(p))
  }
  function hasRole(role: string) {
    return user.value?.roles.includes(role) ?? false
  }

  async function fetchUser() {
    try {
      const { data } = await api.get('/api/user')
      user.value = data
    } catch {
      user.value = null
    } finally {
      loaded.value = true
    }
  }

  async function login(civilId: string, password: string) {
    await csrf()
    const { data } = await api.post('/login', { civil_id: civilId, password })
    user.value = data
    loaded.value = true
  }

  async function logout() {
    try {
      await csrf()
      await api.post('/logout')
    } finally {
      clear()
    }
  }

  function clear() {
    user.value = null
  }

  function isFieldTech() {
    const current = user.value
    if (!current) return false
    if (typeof current.field_tech === 'boolean') return current.field_tech
    if (current.roles?.includes('admin')) return false
    const perms = current.permissions || []
    const canWork = ['orders.accept', 'orders.reached', 'orders.complete', 'invoices.create']
      .some((slug) => perms.includes(slug))
    if (!canWork) return false
    return !['orders.create', 'orders.dispatch', 'clients.view', 'contracts.view', 'accounting.view', 'inventory.view', 'users.view']
      .some((slug) => perms.includes(slug))
  }

  function homePath() {
    return isFieldTech() ? '/tech' : '/'
  }

  return { user, loaded, isLoggedIn, can, canAny, hasRole, isFieldTech, fetchUser, login, logout, clear, homePath }
})
