<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useLocalStorage } from '@vueuse/core'
import {
  BookOpen,
  ChevronsLeft,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  LoaderCircle,
  Menu,
  Package,
  Receipt,
  ScrollText,
  Search,
  Settings,
  Users,
  Wrench,
} from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useStatusStore } from '@/stores/statuses'
import { named, personName } from '@/i18n'
import GlobalSearch from '@/components/GlobalSearch.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LocaleToggle from '@/components/LocaleToggle.vue'
import SidebarHint from '@/components/SidebarHint.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useThemeStore } from '@/stores/theme'
import { useLocaleStore } from '@/stores/locale'
import AppModals from '@/components/AppModals.vue'
import PdfSheet from '@/components/PdfSheet.vue'
import ContractPdfPicker from '@/components/ContractPdfPicker.vue'
import { useInboxStore } from '@/stores/inbox'
import { useRealtimeStore } from '@/stores/realtime'
import { disableTechPush, enableTechPush } from '@/lib/push'

const { t } = useI18n()
const auth = useAuthStore()
const statuses = useStatusStore()
const theme = useThemeStore()
const locale = useLocaleStore()
const inbox = useInboxStore()
const realtime = useRealtimeStore()
const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)
const loggingOut = ref(false)
const collapsed = useLocalStorage('sidebar-collapsed', false)
const search = ref<{ focus: () => void } | null>(null)

watch(
  () => auth.isLoggedIn,
  (ok) => {
    if (ok) {
      statuses.load()
      if (!auth.isFieldTech()) inbox.limitOrderThreads(null)
      inbox.load()
      realtime.connect()
      if (auth.isFieldTech()) void enableTechPush()
    } else {
      inbox.limitOrderThreads(null)
      realtime.disconnect()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  realtime.disconnect()
})

type NavLink = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  any?: string[]
}

type NavSection = { id: string; label?: string; items: NavLink[] }

const sections = computed<NavSection[]>(() => [
  {
    id: 'overview',
    items: [
      { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    ],
  },
  {
    id: 'customers',
    label: t('nav.sectionCustomers'),
    items: [
      { to: '/clients', label: t('nav.clients'), any: ['clients.view'], icon: Users },
      { to: '/contracts', label: t('nav.contracts'), any: ['contracts.view'], icon: ScrollText },
    ],
  },
  {
    id: 'jobs',
    label: t('nav.sectionJobs'),
    items: [
      { to: '/orders', label: t('nav.orders'), any: ['orders.view'], icon: ClipboardList },
      { to: '/dispatch', label: t('nav.dispatch'), any: ['orders.dispatch'], icon: LayoutGrid },
      { to: '/tech', label: t('nav.myJob'), any: ['orders.accept', 'orders.reached', 'orders.complete', 'invoices.create'], icon: Wrench },
    ],
  },
  {
    id: 'finance',
    label: t('nav.sectionFinance'),
    items: [
      { to: '/invoices', label: t('nav.invoices'), any: ['invoices.view'], icon: Receipt },
      { to: '/accounting', label: t('nav.accounting'), any: ['accounting.view'], icon: BookOpen },
    ],
  },
  {
    id: 'stock',
    label: t('nav.sectionStock'),
    items: [
      {
        to: '/inventory',
        label: t('nav.inventory'),
        any: ['inventory.view', 'items.view', 'transfers.view', 'adjustments.view', 'inventory.receive', 'inventory.valuation'],
        icon: Package,
      },
    ],
  },
  {
    id: 'admin',
    label: t('nav.sectionAdmin'),
    items: [
      { to: '/admin/users', label: t('nav.appSettings'), any: ['users.view', 'roles.view', 'permissions.view', 'departments.view', 'statuses.update'], icon: Settings },
    ],
  },
])

const visibleSections = computed(() => {
  const filtered = sections.value
    .map((section) => ({
      ...section,
      items: section.items.filter((link) => {
        if (auth.isFieldTech()) return link.to === '/tech'
        return !link.any?.length || link.any.some((p) => auth.can(p))
      }),
    }))
    .filter((section) => section.items.length)

  return filtered
})

const visible = computed(() => visibleSections.value.flatMap((section) => section.items))

const mobileNav = computed(() => {
  const preferred = ['/', '/tech', '/dispatch', '/orders', '/clients', '/invoices', '/inventory', '/accounting']
  const picked: typeof visible.value = []
  for (const path of preferred) {
    const link = visible.value.find((item) => item.to === path)
    if (link) picked.push(link)
    if (picked.length === 4) break
  }
  for (const link of visible.value) {
    if (picked.length >= 4) break
    if (!picked.some((item) => item.to === link.to)) picked.push(link)
  }
  return picked
})

const roleLabels = computed(() => (auth.user?.roles || []).map((role) => named('role', role)).join(', '))

function inboxCount(path: string) {
  if (path === '/tech' && auth.isFieldTech()) {
    const dept = Number(route.query.department)
    if (dept) return inbox.orderUnreadForDepartment(dept)
  }
  return inbox.countFor(path)
}

function active(to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  menuOpen.value = false
  try {
    await disableTechPush()
    await auth.logout()
    await router.push({ name: 'login' })
  } finally {
    loggingOut.value = false
  }
}

function toggleSidebar() {
  collapsed.value = !collapsed.value
}

async function expandAndSearch() {
  collapsed.value = false
  await nextTick()
  search.value?.focus()
}
</script>

<template>
  <div class="app-shell flex h-full overflow-hidden">
    <aside
      class="hidden h-full shrink-0 flex-col overflow-hidden bg-sidebar text-white transition-[width] duration-300 ease-in-out md:flex"
      :class="collapsed ? 'w-16' : 'w-60'"
    >
      <div class="shrink-0 px-2 pt-3">
        <div class="flex items-center overflow-hidden" :class="collapsed && 'h-10'">
          <div
            class="min-w-0 overflow-hidden whitespace-nowrap px-2 transition-opacity duration-200 ease-in-out"
            :class="collapsed ? 'w-0 flex-none opacity-0' : 'flex-1 opacity-100 delay-75'"
            :aria-hidden="collapsed"
          >
            <p class="text-xs tracking-[0.2em] text-teal-300 uppercase">{{ t('brand.name') }}</p>
            <p class="mt-1 text-lg font-semibold">{{ t('brand.fieldService') }}</p>
          </div>
          <SidebarHint :inline="!collapsed" :text="collapsed ? t('nav.expand') : t('nav.collapse')">
            <button
              type="button"
              class="flex h-10 items-center rounded-lg text-sidebar-muted hover:bg-white/10 hover:text-white"
              :class="collapsed ? 'w-full gap-2.5 ps-4 pe-2' : 'size-10 shrink-0 justify-center'"
              :aria-label="collapsed ? t('nav.expand') : t('nav.collapse')"
              :aria-expanded="!collapsed"
              @click="toggleSidebar"
            >
              <ChevronsLeft
                class="size-4 shrink-0 transition-transform duration-300 ease-in-out rtl:rotate-180"
                :class="collapsed && 'rotate-180 rtl:rotate-0'"
              />
            </button>
          </SidebarHint>
        </div>
        <div
          v-if="!auth.isFieldTech()"
          class="overflow-hidden transition-[height,opacity] duration-200 ease-in-out"
          :class="collapsed ? 'h-0 opacity-0' : 'mt-3 h-9 opacity-100'"
        >
          <GlobalSearch ref="search" />
        </div>
      </div>
      <nav class="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2">
        <div class="flex flex-col gap-0.5">
          <SidebarHint v-if="!auth.isFieldTech()" :text="t('common.search')" :enabled="collapsed">
            <button
              type="button"
              class="flex h-10 w-full items-center gap-2.5 overflow-hidden rounded-lg ps-4 pe-2 text-sm text-sidebar-muted hover:bg-white/5 hover:text-white"
              :class="collapsed ? '' : 'hidden'"
              :aria-label="t('common.search')"
              @click="expandAndSearch"
            >
              <Search class="size-4 shrink-0" />
            </button>
          </SidebarHint>
          <template v-for="(section, index) in visibleSections" :key="section.id">
            <p
              v-if="section.label && !collapsed"
              class="px-4 pt-3 pb-1 text-[10px] font-medium tracking-[0.16em] text-white/35 uppercase"
              :class="index === 0 && 'pt-1'"
            >
              {{ section.label }}
            </p>
            <div
              v-else-if="section.label && collapsed && index > 0"
              class="mx-3 my-1.5 h-px bg-white/10"
              aria-hidden="true"
            />
            <SidebarHint v-for="link in section.items" :key="link.to" :text="link.label" :enabled="collapsed">
              <RouterLink
                :to="link.to"
                class="relative flex h-10 w-full items-center gap-2.5 overflow-hidden rounded-lg ps-4 pe-2 text-sm text-sidebar-muted hover:bg-white/5 hover:text-white"
                :class="active(link.to) && 'bg-white/10 text-white'"
              >
                <component :is="link.icon" class="size-4 shrink-0" />
                <span
                  class="min-w-0 flex-1 truncate whitespace-nowrap transition-opacity duration-200 ease-in-out"
                  :class="collapsed ? 'pointer-events-none opacity-0' : 'opacity-100 delay-75'"
                >{{ link.label }}</span>
                <span
                  v-if="inboxCount(link.to)"
                  class="min-w-4 shrink-0 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 text-white"
                  :class="collapsed && 'absolute end-1 top-1'"
                >{{ inboxCount(link.to) }}</span>
              </RouterLink>
            </SidebarHint>
          </template>
        </div>
      </nav>
      <div class="shrink-0 overflow-hidden border-t border-white/10 px-2 py-2">
        <div
          class="grid transition-[grid-template-rows] duration-300 ease-in-out"
          :class="collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'"
        >
          <div class="min-h-0 overflow-hidden px-2 pb-2">
            <p class="truncate text-sm font-medium">{{ personName(auth.user) }}</p>
            <p class="truncate text-xs text-sidebar-muted">{{ roleLabels }}</p>
          </div>
        </div>
        <SidebarHint :enabled="collapsed" :text="theme.mode === 'dark' ? t('theme.toLight') : t('theme.toDark')">
          <ThemeToggle :compact="collapsed" />
        </SidebarHint>
        <SidebarHint :enabled="collapsed" :text="locale.locale === 'ar' ? t('locale.switchToEnglish') : t('locale.switchToArabic')">
          <LocaleToggle :compact="collapsed" />
        </SidebarHint>
        <SidebarHint :enabled="collapsed" :text="t('nav.logOut')">
          <button
            type="button"
            class="flex h-10 w-full items-center gap-2.5 overflow-hidden rounded-lg ps-4 pe-2 text-sm text-sidebar-muted hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50"
            :disabled="loggingOut"
            :aria-busy="loggingOut || undefined"
            @click="logout"
          >
            <LoaderCircle v-if="loggingOut" class="size-4 shrink-0 animate-spin" />
            <LogOut v-else class="size-4 shrink-0" />
            <span
              class="truncate whitespace-nowrap transition-opacity duration-200 ease-in-out"
              :class="collapsed ? 'pointer-events-none opacity-0' : 'opacity-100 delay-75'"
            >{{ t('nav.logOut') }}</span>
          </button>
        </SidebarHint>
      </div>
    </aside>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
      <header class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-700">
        <div>
          <p class="text-[10px] tracking-[0.2em] text-teal-700 uppercase dark:text-teal-300">{{ t('brand.name') }}</p>
          <p class="text-sm font-semibold">{{ t('brand.fieldService') }}</p>
        </div>
        <div class="flex items-center gap-2">
          <SidebarHint inline side="bottom" :text="locale.locale === 'ar' ? t('locale.switchToEnglish') : t('locale.switchToArabic')">
            <LocaleToggle compact surface="page" />
          </SidebarHint>
          <SidebarHint inline side="bottom" :text="theme.mode === 'dark' ? t('theme.toLight') : t('theme.toDark')">
            <ThemeToggle compact surface="page" />
          </SidebarHint>
        </div>
      </header>
      <main
        class="mx-auto w-full flex-1 px-4 py-5 pb-24 md:px-6 md:py-8 md:pb-8"
        :class="route.path === '/dispatch' ? 'max-w-none' : 'max-w-6xl'"
      >
        <RouterView />
      </main>
    </div>

    <nav class="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-700 dark:bg-[#0b1220]/95">
      <div class="grid" :style="{ gridTemplateColumns: `repeat(${mobileNav.length + 1}, minmax(0, 1fr))` }">
        <RouterLink
          v-for="link in mobileNav"
          :key="link.to"
          :to="link.to"
          class="flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium"
          :class="active(link.to) ? 'text-accent' : 'text-slate-500'"
        >
          <component :is="link.icon" class="size-5" />
          <span class="w-full truncate text-center">{{ link.label }}</span>
        </RouterLink>
        <button
          type="button"
          class="flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium text-slate-500"
          @click="menuOpen = true"
        >
          <Menu class="size-5" />
          <span>{{ t('nav.more') }}</span>
        </button>
      </div>
    </nav>

    <Dialog :open="menuOpen" @update:open="menuOpen = $event">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ t('nav.navigate') }}</DialogTitle>
        </DialogHeader>
        <div v-if="!auth.isFieldTech()" class="mt-3">
          <GlobalSearch variant="sheet" @navigate="menuOpen = false" />
        </div>
        <nav class="mt-3 grid gap-0.5">
          <template v-for="(section, index) in visibleSections" :key="section.id">
            <p
              v-if="section.label"
              class="px-3 text-[10px] font-medium tracking-[0.16em] text-slate-400 uppercase"
              :class="index === 0 ? 'mb-1' : 'mt-3 mb-1'"
            >
              {{ section.label }}
            </p>
            <RouterLink
              v-for="link in section.items"
              :key="link.to"
              :to="link.to"
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5"
              :class="active(link.to) && 'bg-slate-100 font-medium dark:bg-white/10'"
              @click="menuOpen = false"
            >
              <component :is="link.icon" class="size-4" />
              {{ link.label }}
            </RouterLink>
          </template>
        </nav>
        <p class="mt-4 text-sm text-slate-500">{{ personName(auth.user) }}</p>
        <ThemeToggle surface="page" class="mt-2 w-full justify-start" />
        <LocaleToggle surface="page" class="mt-1 w-full justify-start" />
        <Button variant="outline" class="mt-2 w-full" :loading="loggingOut" @click="logout">{{ t('nav.logOut') }}</Button>
      </DialogContent>
    </Dialog>
    <AppModals />
  </div>
  <Teleport to="body">
    <PdfSheet />
    <ContractPdfPicker />
  </Teleport>
</template>
