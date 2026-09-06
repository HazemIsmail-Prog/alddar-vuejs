<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Copy, Pencil, Plus } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError } from '@/lib/utils'
import { named, personName, departmentName } from '@/i18n'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/DeleteButton.vue'
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import FormDialog from '@/components/FormDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/stores/auth'
import StatusesPanel from '@/components/StatusesPanel.vue'
import PageHeader from '@/components/PageHeader.vue'

type StaffTab = 'users' | 'roles' | 'permissions' | 'departments' | 'statuses'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const users = ref<any[]>([])
const roles = ref<any[]>([])
const permissions = ref<any[]>([])
const departments = ref<any[]>([])
function firstAllowedTab(): StaffTab {
  if (auth.can('users.view')) return 'users'
  if (auth.can('roles.view')) return 'roles'
  if (auth.can('permissions.view')) return 'permissions'
  if (auth.can('departments.view')) return 'departments'
  return 'statuses'
}

function tabAllowed(id: StaffTab) {
  if (id === 'users') return auth.can('users.view')
  if (id === 'roles') return auth.can('roles.view')
  if (id === 'permissions') return auth.can('permissions.view')
  if (id === 'departments') return auth.can('departments.view')
  return auth.can('statuses.update')
}

const tab = ref<StaffTab>(firstAllowedTab())
const error = ref('')

const userOpen = ref(false)
const roleOpen = ref(false)
const permOpen = ref(false)
const deptOpen = ref(false)
const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmDescription = ref('')
const confirmLabel = ref('')
const confirmVariant = ref<'default' | 'destructive'>('default')
const confirmAction = ref<null | (() => Promise<void>)>(null)
const saving = ref(false)
const confirming = ref(false)

const editingUserId = ref<number | null>(null)
const duplicatingFrom = ref('')
const editingRoleId = ref<number | null>(null)
const editingPermId = ref<number | null>(null)
const editingDeptId = ref<number | null>(null)
const roleLocked = ref(false)

const userForm = ref({
  name_en: '',
  name_ar: '',
  civil_id: '',
  email: '',
  password: 'password',
  role_ids: [] as number[],
  department_ids: [] as number[],
  permission_ids: [] as number[],
})
const roleForm = ref({ name: '', permission_ids: [] as number[] })
const permForm = ref({ name: '', slug: '', group: '', role_ids: [] as number[] })
const deptForm = ref({ name_en: '', name_ar: '', is_service: true, user_ids: [] as number[] })

const tabs = computed(() => {
  const items: { id: StaffTab; label: string }[] = []
  if (auth.can('users.view')) items.push({ id: 'users', label: t('staff.users') })
  if (auth.can('roles.view')) items.push({ id: 'roles', label: t('staff.roles') })
  if (auth.can('permissions.view')) items.push({ id: 'permissions', label: t('staff.permissions') })
  if (auth.can('departments.view')) items.push({ id: 'departments', label: t('staff.departments') })
  if (auth.can('statuses.update')) items.push({ id: 'statuses', label: t('nav.statuses') })
  return items
})

function applyTabFromRoute() {
  const requested = String(route.query.tab || '')
  if (tabs.value.some((item) => item.id === requested) && tabAllowed(requested as StaffTab)) {
    tab.value = requested as StaffTab
    return
  }
  if (!tabAllowed(tab.value)) tab.value = firstAllowedTab()
}

function setTab(id: StaffTab) {
  tab.value = id
  const query = { ...route.query, tab: id }
  void router.replace({ query })
}

watch(() => route.query.tab, applyTabFromRoute)

const assignableRoles = computed(() => roles.value.filter((r) => r.slug !== 'admin'))

const GROUP_ORDER = [
  'dashboard',
  'orders',
  'clients',
  'contracts',
  'invoices',
  'payments',
  'items',
  'inventory',
  'transfers',
  'adjustments',
  'accounting',
  'users',
  'roles',
  'permissions',
  'departments',
  'statuses',
  'other',
]

const ACTION_ORDER = ['view', 'view_own', 'create', 'update', 'delete', 'toggle_active']

function actionRank(slug: string) {
  const action = slug.split('.').slice(1).join('.')
  const index = ACTION_ORDER.indexOf(action)
  return index === -1 ? ACTION_ORDER.length : index
}

const permissionGroups = computed(() => {
  const map = new Map<string, any[]>()
  for (const p of permissions.value) {
    const group = p.group || 'other'
    if (!map.has(group)) map.set(group, [])
    map.get(group)!.push(p)
  }
  return [...map.entries()]
    .map(([group, items]) => ({
      group,
      items: [...items].sort((a, b) => actionRank(a.slug) - actionRank(b.slug) || a.slug.localeCompare(b.slug)),
    }))
    .sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a.group)
      const bi = GROUP_ORDER.indexOf(b.group)
      return (ai === -1 ? GROUP_ORDER.length : ai) - (bi === -1 ? GROUP_ORDER.length : bi) || a.group.localeCompare(b.group)
    })
})

async function load() {
  const tasks: Promise<void>[] = [api.get('/api/departments').then((r) => { departments.value = r.data })]
  if (auth.can('users.view')) {
    tasks.push(api.get('/api/users').then((r) => { users.value = r.data }))
  }
  if (auth.canAny('users.view', 'roles.view')) {
    tasks.push(api.get('/api/roles').then((r) => { roles.value = r.data }))
  }
  if (auth.canAny('users.view', 'roles.view', 'permissions.view')) {
    tasks.push(api.get('/api/permissions').then((r) => { permissions.value = r.data }))
  }
  await Promise.all(tasks)
}

function toggleId(list: number[], id: number) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

function groupChecked(ids: number[], selected: number[]) {
  return ids.length > 0 && ids.every((id) => selected.includes(id))
}

function toggleGroup(ids: number[], selected: number[]) {
  return groupChecked(ids, selected)
    ? selected.filter((id) => !ids.includes(id))
    : [...new Set([...selected, ...ids])]
}

function ask(opts: { title: string; description: string; label: string; variant?: 'default' | 'destructive' }, action: () => Promise<void>) {
  confirmTitle.value = opts.title
  confirmDescription.value = opts.description
  confirmLabel.value = opts.label
  confirmVariant.value = opts.variant ?? 'default'
  confirmAction.value = action
  confirmOpen.value = true
}

async function runConfirm() {
  if (!confirmAction.value || confirming.value) return
  confirming.value = true
  try {
    await confirmAction.value()
    confirmOpen.value = false
  } catch (e) {
    confirmDescription.value = apiError(e)
  } finally {
    confirming.value = false
  }
}

function startCreateUser() {
  editingUserId.value = null
  duplicatingFrom.value = ''
  userForm.value = { name_en: '', name_ar: '', civil_id: '', email: '', password: 'password', role_ids: [], department_ids: [], permission_ids: [] }
  error.value = ''
  userOpen.value = true
}

function startDuplicateUser(user: any) {
  editingUserId.value = null
  duplicatingFrom.value = personName(user)
  userForm.value = {
    name_en: '',
    name_ar: '',
    civil_id: '',
    email: '',
    password: 'password',
    role_ids: (user.roles || []).map((r: any) => r.id),
    department_ids: (user.departments || []).map((d: any) => d.id),
    permission_ids: (user.extra_permissions || []).map((p: any) => p.id),
  }
  error.value = ''
  userOpen.value = true
}

function startEditUser(user: any) {
  editingUserId.value = user.id
  duplicatingFrom.value = ''
  userForm.value = {
    name_en: user.name_en,
    name_ar: user.name_ar,
    civil_id: user.civil_id,
    email: user.email ?? '',
    password: '',
    role_ids: (user.roles || []).map((r: any) => r.id),
    department_ids: (user.departments || []).map((d: any) => d.id),
    permission_ids: (user.extra_permissions || []).map((p: any) => p.id),
  }
  error.value = ''
  userOpen.value = true
}

async function saveUser() {
  if (saving.value) return
  error.value = ''
  saving.value = true
  try {
    const payload: any = {
      name_en: userForm.value.name_en,
      name_ar: userForm.value.name_ar,
      civil_id: userForm.value.civil_id,
      email: userForm.value.email || null,
      role_ids: userForm.value.role_ids,
      department_ids: userForm.value.department_ids,
      permission_ids: userForm.value.permission_ids,
    }
    if (userForm.value.password) payload.password = userForm.value.password
    if (editingUserId.value) {
      await api.put(`/api/users/${editingUserId.value}`, payload)
    } else {
      await api.post('/api/users', payload)
    }
    userOpen.value = false
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

function startCreateRole() {
  editingRoleId.value = null
  roleLocked.value = false
  roleForm.value = { name: '', permission_ids: [] }
  error.value = ''
  roleOpen.value = true
}

function startEditRole(role: any) {
  editingRoleId.value = role.id
  roleLocked.value = role.slug === 'admin'
  roleForm.value = {
    name: role.name,
    permission_ids: roleLocked.value
      ? permissions.value.map((p) => p.id)
      : (role.permissions || []).map((p: any) => p.id),
  }
  error.value = ''
  roleOpen.value = true
}

async function saveRole() {
  if (saving.value) return
  error.value = ''
  saving.value = true
  try {
    const payload: any = { name: roleForm.value.name }
    if (!roleLocked.value) payload.permission_ids = roleForm.value.permission_ids
    if (editingRoleId.value) {
      await api.put(`/api/roles/${editingRoleId.value}`, payload)
    } else {
      await api.post('/api/roles', { ...payload, permission_ids: roleForm.value.permission_ids })
    }
    roleOpen.value = false
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

function askDeleteRole(role: any) {
  ask(
    {
      title: t('staff.deleteRole', { name: role.name }),
      description: t('staff.deleteRoleDesc'),
      label: t('staff.deleteRoleBtn'),
      variant: 'destructive',
    },
    async () => {
      await api.delete(`/api/roles/${role.id}`)
      await load()
    },
  )
}

function startCreatePerm() {
  editingPermId.value = null
  permForm.value = { name: '', slug: '', group: '', role_ids: [] }
  error.value = ''
  permOpen.value = true
}

function startEditPerm(perm: any) {
  editingPermId.value = perm.id
  permForm.value = {
    name: perm.name,
    slug: perm.slug,
    group: perm.group || '',
    role_ids: (perm.roles || []).filter((r: any) => r.slug !== 'admin').map((r: any) => r.id),
  }
  error.value = ''
  permOpen.value = true
}

async function savePerm() {
  if (saving.value) return
  error.value = ''
  saving.value = true
  try {
    const payload: any = {
      name: permForm.value.name,
      group: permForm.value.group,
      role_ids: permForm.value.role_ids,
    }
    if (editingPermId.value) {
      await api.put(`/api/permissions/${editingPermId.value}`, payload)
    } else {
      if (permForm.value.slug) payload.slug = permForm.value.slug
      await api.post('/api/permissions', payload)
    }
    permOpen.value = false
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

function askDeletePerm(perm: any) {
  ask(
    {
      title: t('staff.deletePerm', { name: perm.name }),
      description: t('staff.deletePermDesc'),
      label: t('staff.deletePermBtn'),
      variant: 'destructive',
    },
    async () => {
      await api.delete(`/api/permissions/${perm.id}`)
      await load()
    },
  )
}

function startCreateDept() {
  editingDeptId.value = null
  deptForm.value = { name_en: '', name_ar: '', is_service: true, user_ids: [] }
  error.value = ''
  deptOpen.value = true
}

function startEditDept(dept: any) {
  editingDeptId.value = dept.id
  deptForm.value = {
    name_en: dept.name_en,
    name_ar: dept.name_ar,
    is_service: dept.is_service !== false,
    user_ids: (dept.users || []).map((u: any) => u.id),
  }
  error.value = ''
  deptOpen.value = true
}

async function saveDept() {
  if (saving.value) return
  error.value = ''
  saving.value = true
  try {
    const payload = {
      name_en: deptForm.value.name_en,
      name_ar: deptForm.value.name_ar,
      is_service: deptForm.value.is_service,
      user_ids: deptForm.value.user_ids,
    }
    if (editingDeptId.value) {
      await api.put(`/api/departments/${editingDeptId.value}`, payload)
    } else {
      await api.post('/api/departments', payload)
    }
    deptOpen.value = false
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

function askDeleteDept(dept: any) {
  ask(
    {
      title: t('staff.deleteDept', { name: departmentName(dept) }),
      description: t('staff.deleteDeptDesc'),
      label: t('staff.deleteDeptBtn'),
      variant: 'destructive',
    },
    async () => {
      await api.delete(`/api/departments/${dept.id}`)
      await load()
    },
  )
}

function askToggle(user: any) {
  ask(
    {
      title: user.is_active ? t('staff.deactivateTitle') : t('staff.activateTitle'),
      description: user.is_active ? t('staff.deactivateDesc') : t('staff.activateDesc'),
      label: user.is_active ? t('staff.deactivate') : t('staff.activate'),
      variant: user.is_active ? 'destructive' : 'default',
    },
    async () => {
      await api.patch(`/api/users/${user.id}/active`)
      await load()
    },
  )
}

function rolePermissionLabel(role: any) {
  if (role.slug === 'admin') return t('staff.all')
  const n = role.permissions?.length ?? 0
  return t('staff.permissionCount', { n })
}

function permRoleLabel(perm: any) {
  const names = (perm.roles || [])
    .filter((r: any) => r.slug !== 'admin')
    .map((r: any) => named('role', r.slug, r.name))
  return names.length ? names.join(', ') : t('common.dash')
}

onMounted(() => {
  applyTabFromRoute()
  void load()
})
</script>

<template>
  <div>
    <PageHeader :title="t('staff.title')" :subtitle="t('staff.subtitle')">
      <template #actions>
        <Button v-if="tab === 'users' && auth.can('users.create')" @click="startCreateUser">
          <Plus class="size-4" /> {{ t('staff.newUser') }}
        </Button>
        <Button v-else-if="tab === 'roles' && auth.can('roles.create')" @click="startCreateRole">
          <Plus class="size-4" /> {{ t('staff.newRole') }}
        </Button>
        <Button v-else-if="tab === 'permissions' && auth.can('permissions.create')" @click="startCreatePerm">
          <Plus class="size-4" /> {{ t('staff.newPermission') }}
        </Button>
        <Button v-else-if="tab === 'departments' && auth.can('departments.create')" @click="startCreateDept">
          <Plus class="size-4" /> {{ t('staff.newDepartment') }}
        </Button>
      </template>
    </PageHeader>

    <div class="page-tabs">
      <button
        v-for="tabItem in tabs"
        :key="tabItem.id"
        type="button"
        class="page-tab"
        :class="tab === tabItem.id && 'is-active'"
        @click="setTab(tabItem.id)"
      >
        {{ tabItem.label }}
      </button>
    </div>

    <div v-if="tab === 'users'" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="data-table">
        <thead>
          <tr><th>{{ t('common.name') }}</th><th>{{ t('common.civilId') }}</th><th>{{ t('common.email') }}</th><th>{{ t('staff.rolesCol') }}</th><th>{{ t('staff.deptsCol') }}</th><th>{{ t('common.status') }}</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td class="font-medium">{{ personName(u) }}</td>
            <td>{{ u.civil_id }}</td>
            <td>{{ u.email || t('common.dash') }}</td>
            <td>{{ u.roles?.map((r: any) => named('role', r.slug, r.name)).join(', ') || t('common.dash') }}</td>
            <td>{{ u.departments?.map((d: any) => departmentName(d)).join(', ') || t('common.dash') }}</td>
            <td>
              <Badge :variant="u.is_active ? 'secondary' : 'outline'">{{ u.is_active ? t('staff.active') : t('staff.inactive') }}</Badge>
            </td>
            <td class="text-end whitespace-nowrap">
              <Button v-if="auth.can('users.update')" size="sm" variant="outline" class="me-1" @click="startEditUser(u)"><Pencil class="size-3.5" /> {{ t('common.edit') }}</Button>
              <Button v-if="auth.can('users.create')" size="sm" variant="outline" class="me-1" @click="startDuplicateUser(u)">
                <Copy class="size-3.5" /> {{ t('staff.duplicate') }}
              </Button>
              <Button v-if="auth.can('users.toggle_active')" size="sm" variant="outline" :disabled="u.id === auth.user?.id" @click="askToggle(u)">
                {{ u.is_active ? t('staff.deactivate') : t('staff.activate') }}
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="tab === 'roles'" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="data-table">
        <thead>
          <tr><th>{{ t('staff.role') }}</th><th>{{ t('staff.slug') }}</th><th>{{ t('staff.permissions') }}</th><th>{{ t('nav.staff') }}</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="r in roles" :key="r.id">
            <td class="font-medium">{{ named('role', r.slug, r.name) }}</td>
            <td class="text-slate-500">{{ r.slug }}</td>
            <td>{{ rolePermissionLabel(r) }}</td>
            <td>{{ r.users_count ?? 0 }}</td>
            <td class="text-end whitespace-nowrap">
              <Button v-if="auth.can('roles.update')" size="sm" variant="outline" class="me-1" @click="startEditRole(r)"><Pencil class="size-3.5" /> {{ t('common.edit') }}</Button>
              <DeleteButton
                v-if="auth.can('roles.delete')"
                :disabled="r.slug === 'admin' || (r.users_count ?? 0) > 0"
                @click="askDeleteRole(r)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="tab === 'permissions'" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="data-table">
        <thead>
          <tr><th>{{ t('staff.permission') }}</th><th>{{ t('staff.slug') }}</th><th>{{ t('staff.group') }}</th><th>{{ t('staff.roles') }}</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="p in permissions" :key="p.id">
            <td class="font-medium">{{ named('permission', p.slug, p.name) }}</td>
            <td class="text-slate-500">{{ p.slug }}</td>
            <td>{{ named('permGroup', p.group) }}</td>
            <td>{{ permRoleLabel(p) }}</td>
            <td class="text-end whitespace-nowrap">
              <Button v-if="auth.can('permissions.update')" size="sm" variant="outline" class="me-1" @click="startEditPerm(p)"><Pencil class="size-3.5" /> {{ t('common.edit') }}</Button>
              <DeleteButton v-if="auth.can('permissions.delete')" @click="askDeletePerm(p)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="tab === 'departments'" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="data-table">
        <thead>
          <tr><th>{{ t('common.department') }}</th><th>{{ t('staff.typeCol') }}</th><th>{{ t('nav.staff') }}</th><th>{{ t('nav.orders') }}</th><th>{{ t('nav.contracts') }}</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="d in departments" :key="d.id">
            <td class="font-medium">{{ departmentName(d) }}</td>
            <td>
              <Badge :variant="d.is_service !== false ? 'secondary' : 'outline'">
                {{ d.is_service !== false ? t('staff.service') : t('staff.other') }}
              </Badge>
            </td>
            <td>{{ d.users_count ?? d.users?.length ?? 0 }}</td>
            <td>{{ d.orders_count ?? 0 }}</td>
            <td>{{ d.contracts_count ?? 0 }}</td>
            <td class="text-end whitespace-nowrap">
              <Button v-if="auth.can('departments.update')" size="sm" variant="outline" class="me-1" @click="startEditDept(d)"><Pencil class="size-3.5" /> {{ t('common.edit') }}</Button>
              <DeleteButton
                v-if="auth.can('departments.delete')"
                :disabled="(d.orders_count ?? 0) > 0 || (d.contracts_count ?? 0) > 0"
                @click="askDeleteDept(d)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <StatusesPanel v-else-if="tab === 'statuses'" />

    <FormDialog
      v-model:open="userOpen"
      :title="duplicatingFrom ? t('staff.duplicateUser', { name: duplicatingFrom }) : editingUserId ? t('staff.editUser') : t('staff.newUser')"
      :description="duplicatingFrom ? t('staff.duplicateUserDesc') : editingUserId ? t('staff.userDescEdit') : t('staff.userDescNew')"
      :submit-label="editingUserId ? t('staff.saveUser') : t('staff.createUser')"
      :error="error"
      wide
      :loading="saving"
      @submit="saveUser"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <Field :label="t('staff.nameEn')"><Input v-model="userForm.name_en" required /></Field>
        <Field :label="t('staff.nameAr')"><Input v-model="userForm.name_ar" required /></Field>
        <Field :label="t('common.civilId')">
          <Input v-model="userForm.civil_id" type="text" inputmode="numeric" maxlength="12" required />
        </Field>
        <Field :label="t('common.email')"><Input v-model="userForm.email" type="email" /></Field>
        <Field :label="t('common.password')" class="sm:col-span-2">
          <Input v-model="userForm.password" type="password" :required="!editingUserId" :placeholder="editingUserId ? t('staff.unchanged') : ''" />
        </Field>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <p class="mb-1 text-sm font-medium text-slate-700">{{ t('staff.roles') }}</p>
          <label v-for="r in roles" :key="r.id" class="mb-1 flex cursor-pointer items-center gap-2.5 text-sm">
            <Switch
              :model-value="userForm.role_ids.includes(r.id)"
              @update:model-value="userForm.role_ids = toggleId(userForm.role_ids, r.id)"
            />
            {{ named('role', r.slug, r.name) }}
          </label>
        </div>
        <div>
          <p class="mb-1 text-sm font-medium text-slate-700">{{ t('staff.departments') }}</p>
          <label v-for="d in departments" :key="d.id" class="mb-1 flex cursor-pointer items-center gap-2.5 text-sm">
            <Switch
              :model-value="userForm.department_ids.includes(d.id)"
              @update:model-value="userForm.department_ids = toggleId(userForm.department_ids, d.id)"
            />
            {{ departmentName(d) }}
          </label>
        </div>
      </div>
      <div v-if="permissions.length" class="space-y-3">
        <div>
          <p class="text-sm font-medium text-slate-700">{{ t('staff.extraPerms') }}</p>
          <p class="text-xs text-slate-500">{{ t('staff.extraHint') }}</p>
        </div>
        <section
          v-for="g in permissionGroups"
          :key="g.group"
          class="rounded-lg border border-slate-200 p-3"
        >
          <label class="mb-2 flex cursor-pointer items-center gap-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <Switch
              :model-value="groupChecked(g.items.map((p) => p.id), userForm.permission_ids)"
              @update:model-value="userForm.permission_ids = toggleGroup(g.items.map((p) => p.id), userForm.permission_ids)"
            />
            {{ named('permGroup', g.group) }}
          </label>
          <div class="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <label v-for="p in g.items" :key="p.id" class="flex cursor-pointer items-center gap-2.5 text-sm">
              <Switch
                :model-value="userForm.permission_ids.includes(p.id)"
                @update:model-value="userForm.permission_ids = toggleId(userForm.permission_ids, p.id)"
              />
              {{ named('permission', p.slug, p.name) }}
            </label>
          </div>
        </section>
      </div>
    </FormDialog>

    <FormDialog
      v-model:open="roleOpen"
      :title="editingRoleId ? (roleLocked ? t('staff.adminRole') : t('staff.editRole')) : t('staff.newRole')"
      :description="roleLocked ? t('staff.adminDesc') : t('staff.roleDesc')"
      :submit-label="editingRoleId ? t('staff.saveRole') : t('staff.createRole')"
      :error="error"
      wide
      :loading="saving"
      @submit="saveRole"
    >
      <Field :label="t('common.name')"><Input v-model="roleForm.name" required /></Field>
      <div class="space-y-3">
        <section
          v-for="g in permissionGroups"
          :key="g.group"
          class="rounded-lg border border-slate-200 p-3"
        >
          <label class="mb-2 flex cursor-pointer items-center gap-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <Switch
              :disabled="roleLocked"
              :model-value="groupChecked(g.items.map((p) => p.id), roleForm.permission_ids)"
              @update:model-value="roleForm.permission_ids = toggleGroup(g.items.map((p) => p.id), roleForm.permission_ids)"
            />
            {{ named('permGroup', g.group) }}
          </label>
          <div class="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <label v-for="p in g.items" :key="p.id" class="flex cursor-pointer items-center gap-2.5 text-sm">
              <Switch
                :disabled="roleLocked"
                :model-value="roleForm.permission_ids.includes(p.id)"
                @update:model-value="roleForm.permission_ids = toggleId(roleForm.permission_ids, p.id)"
              />
              {{ named('permission', p.slug, p.name) }}
            </label>
          </div>
        </section>
      </div>
    </FormDialog>

    <FormDialog
      v-model:open="permOpen"
      :title="editingPermId ? t('staff.editPerm') : t('staff.newPermission')"
      :description="editingPermId ? t('staff.permDescEdit') : t('staff.permDescNew')"
      :submit-label="editingPermId ? t('staff.savePerm') : t('staff.createPerm')"
      :error="error"
      :loading="saving"
      @submit="savePerm"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <Field :label="t('common.name')"><Input v-model="permForm.name" required /></Field>
        <Field :label="t('staff.group')"><Input v-model="permForm.group" placeholder="orders" /></Field>
        <Field v-if="!editingPermId" :label="t('staff.slug')" class="sm:col-span-2">
          <Input v-model="permForm.slug" :placeholder="t('staff.slugGenerated')" />
        </Field>
        <p v-else class="sm:col-span-2 text-sm text-slate-500">{{ t('staff.slugLine', { slug: permForm.slug }) }}</p>
      </div>
      <div>
        <p class="mb-1 text-sm font-medium text-slate-700">{{ t('staff.roles') }}</p>
        <label v-for="r in assignableRoles" :key="r.id" class="mb-1 flex cursor-pointer items-center gap-2.5 text-sm">
          <Switch
            :model-value="permForm.role_ids.includes(r.id)"
            @update:model-value="permForm.role_ids = toggleId(permForm.role_ids, r.id)"
          />
          {{ r.name }}
        </label>
      </div>
    </FormDialog>

    <FormDialog
      v-model:open="deptOpen"
      :title="editingDeptId ? t('staff.editDept') : t('staff.newDepartment')"
      :description="t('staff.deptDesc')"
      :submit-label="editingDeptId ? t('staff.saveDept') : t('staff.createDept')"
      :error="error"
      :loading="saving"
      @submit="saveDept"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <Field :label="t('staff.nameEn')"><Input v-model="deptForm.name_en" required /></Field>
        <Field :label="t('staff.nameAr')"><Input v-model="deptForm.name_ar" required /></Field>
      </div>
      <label class="flex cursor-pointer items-start gap-2.5 text-sm">
        <Switch
          class="mt-0.5"
          :model-value="deptForm.is_service"
          @update:model-value="deptForm.is_service = $event"
        />
        <span>
          <span class="font-medium text-slate-700">{{ t('staff.serviceDept') }}</span>
          <span class="mt-0.5 block text-xs font-normal text-slate-500">{{ t('staff.serviceDeptHint') }}</span>
        </span>
      </label>
      <div>
        <p class="mb-1 text-sm font-medium text-slate-700">{{ t('nav.staff') }}</p>
        <label v-for="u in users" :key="u.id" class="mb-1 flex cursor-pointer items-center gap-2.5 text-sm">
          <Switch
            :model-value="deptForm.user_ids.includes(u.id)"
            @update:model-value="deptForm.user_ids = toggleId(deptForm.user_ids, u.id)"
          />
          {{ personName(u) }}
        </label>
      </div>
    </FormDialog>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :confirm-label="confirmLabel"
      :variant="confirmVariant"
      :loading="confirming"
      @confirm="runConfirm"
    />
  </div>
</template>
