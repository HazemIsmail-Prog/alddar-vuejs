<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import Field from '@/components/ui/Field.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LocaleToggle from '@/components/LocaleToggle.vue'

const { t } = useI18n()
const civilId = ref('287010100003')
const password = ref('password')
const error = ref('')
const loading = ref(false)
const auth = useAuthStore()
const router = useRouter()

const demos = [
  { civil_id: '287010100002', role: 'call_center' },
  { civil_id: '287010100003', role: 'dispatcher' },
  { civil_id: '287010100004', role: 'technician' },
  { civil_id: '287010100006', role: 'accountant' },
  { civil_id: '287010100001', role: 'admin' },
] as const

async function submit() {
  if (loading.value) return
  error.value = ''
  loading.value = true
  try {
    await auth.login(civilId.value, password.value)
    await router.push(auth.homePath())
  } catch (e: any) {
    error.value = e.response?.data?.message ?? e.response?.data?.errors?.civil_id?.[0] ?? t('login.failed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="grid min-h-full lg:grid-cols-2">
    <div class="hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div>
        <p class="text-xs tracking-[0.25em] text-teal-300 uppercase">{{ t('brand.name') }}</p>
        <h1 class="mt-6 max-w-md text-4xl font-semibold leading-tight">{{ t('login.headline') }}</h1>
        <p class="mt-4 max-w-sm text-sm text-sidebar-muted">{{ t('login.subhead') }}</p>
      </div>
      <p class="text-xs text-sidebar-muted">{{ t('login.demoPassword') }}</p>
    </div>
    <div class="relative flex items-center justify-center p-6">
      <div class="absolute top-4 end-4 flex items-center gap-1">
        <LocaleToggle compact surface="page" />
        <ThemeToggle compact surface="page" />
      </div>
      <Card class="w-full max-w-md shadow-lg">
        <CardContent class="p-8">
          <h2 class="text-xl font-semibold">{{ t('login.signIn') }}</h2>
          <p class="mb-6 text-sm text-slate-500">{{ t('login.useSeeded') }}</p>
          <form class="space-y-4" @submit.prevent="submit">
            <Field :label="t('common.civilId')">
              <Input v-model="civilId" type="text" inputmode="numeric" maxlength="12" autocomplete="username" />
            </Field>
            <Field :label="t('common.password')"><Input v-model="password" type="password" /></Field>
            <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
            <Button class="w-full" type="submit" :loading="loading">
              {{ loading ? t('login.signingIn') : t('login.continue') }}
            </Button>
          </form>
          <div class="mt-6 grid gap-1">
            <button
              v-for="demo in demos"
              :key="demo.civil_id"
              type="button"
              class="flex justify-between rounded-md px-2 py-1 text-start text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
              @click="civilId = demo.civil_id"
            >
              <span>{{ t(`login.roles.${demo.role}`) }}</span>
              <span>{{ demo.civil_id }}</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
