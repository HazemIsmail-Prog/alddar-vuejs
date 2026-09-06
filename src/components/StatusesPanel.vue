<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Pencil } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError, statusBadgeStyle } from '@/lib/utils'
import { statusName } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import FormDialog from '@/components/FormDialog.vue'
import { useStatusStore } from '@/stores/statuses'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const statuses = useStatusStore()
const open = ref(false)
const error = ref('')
const saving = ref(false)
const editing = ref<any>(null)
const form = ref({ name_en: '', name_ar: '', color: '#64748B' })

function startEdit(row: any) {
  editing.value = row
  form.value = { name_en: row.name_en, name_ar: row.name_ar, color: row.color }
  error.value = ''
  open.value = true
}

function onColorPicker(event: Event) {
  form.value.color = (event.target as HTMLInputElement).value.toUpperCase()
}

function onColorText() {
  const value = form.value.color.trim().toUpperCase()
  form.value.color = value.startsWith('#') ? value : `#${value}`
}

async function save() {
  if (saving.value) return
  error.value = ''
  saving.value = true
  try {
    await api.put(`/api/order-statuses/${editing.value.id}`, {
      name_en: form.value.name_en,
      name_ar: form.value.name_ar,
      color: form.value.color,
    })
    open.value = false
    await statuses.load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (!statuses.loaded) statuses.load()
})
</script>

<template>
  <div>
    <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="data-table">
        <thead>
          <tr><th>{{ t('common.status') }}</th><th>{{ t('statuses.slug') }}</th><th>{{ t('statuses.color') }}</th><th>{{ t('statuses.preview') }}</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="row in statuses.items" :key="row.id">
            <td class="font-medium">{{ statusName(row) }}</td>
            <td class="text-slate-500">{{ row.slug }}</td>
            <td>
              <span class="inline-flex items-center gap-2 font-mono text-xs text-slate-600">
                <span class="size-4 rounded-full border border-black/10" :style="{ backgroundColor: row.color }" />
                {{ row.color }}
              </span>
            </td>
            <td>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" :style="statusBadgeStyle(row.color)">{{ statusName(row) }}</span>
            </td>
            <td class="text-end">
              <Button v-if="auth.can('statuses.update')" size="sm" variant="outline" @click="startEdit(row)"><Pencil class="size-3.5" /> {{ t('common.edit') }}</Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <FormDialog v-model:open="open" :title="t('statuses.editTitle')" :submit-label="t('statuses.saveStatus')" :error="error" :loading="saving" @submit="save">
      <p class="text-sm text-slate-500">{{ t('statuses.slugLocked', { slug: editing?.slug }) }}</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <Field :label="t('staff.nameEn')"><Input v-model="form.name_en" required /></Field>
        <Field :label="t('staff.nameAr')"><Input v-model="form.name_ar" required /></Field>
      </div>
      <Field :label="t('statuses.color')">
        <div class="flex items-center gap-2">
          <input type="color" class="h-9 w-12 cursor-pointer rounded border border-slate-200 bg-white p-1" :value="form.color" @input="onColorPicker" />
          <Input v-model="form.color" class="font-mono uppercase" maxlength="7" @blur="onColorText" />
        </div>
      </Field>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p class="mb-2 text-xs text-slate-500">{{ t('statuses.preview') }}</p>
        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" :style="statusBadgeStyle(form.color)">{{ statusName(form, t('statuses.fallback')) }}</span>
      </div>
    </FormDialog>
  </div>
</template>
