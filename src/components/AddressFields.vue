<script setup lang="ts">
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import { useI18n } from 'vue-i18n'

defineProps<{ loc: Record<string, any> }>()
const { t } = useI18n()
</script>

<template>
  <div class="grid gap-2 sm:grid-cols-2">
    <Field :label="t('address.country')"><Input v-model="loc.country" /></Field>
    <Field :label="t('address.city')"><Input v-model="loc.city" /></Field>
    <Field :label="t('address.area')"><Input v-model="loc.area" /></Field>
    <Field :label="t('address.block')"><Input v-model="loc.block" /></Field>
    <Field :label="t('address.street')"><Input v-model="loc.street" /></Field>
    <Field :label="t('address.avenue')"><Input v-model="loc.avenue" /></Field>
    <Field :label="t('address.building')"><Input v-model="loc.building" /></Field>
    <Field :label="t('address.floor')"><Input v-model="loc.floor" /></Field>
    <Field :label="t('address.flat')"><Input v-model="loc.flat" /></Field>
    <Field :label="t('address.paci')"><Input v-model="loc.paci_number" type="number" min="0" step="1" /></Field>
    <div class="sm:col-span-2">
      <Field :label="t('address.maps')"><Input v-model="loc.google_maps_link" placeholder="https://maps.google.com/…" /></Field>
    </div>
    <div class="sm:col-span-2">
      <Field :label="t('address.extras')"><Input v-model="loc.extras" /></Field>
    </div>
  </div>
</template>
