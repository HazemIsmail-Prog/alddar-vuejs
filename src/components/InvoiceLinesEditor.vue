<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/DeleteButton.vue'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { machineLabel } from '@/lib/machines'
import {
  blankInvoiceLine,
  isCustomLine,
  setLineKind,
  type InvoiceEditLine,
} from '@/lib/invoiceLines'

const lines = defineModel<InvoiceEditLine[]>({ required: true })

const props = withDefaults(defineProps<{
  catalog: any[]
  machines?: any[]
  coveredMachineIds?: number[]
  hasContract?: boolean
  includesSpareParts?: boolean
  showPrice?: boolean
  quantityReadonly?: boolean
  itemLabel?: (item: any) => string
}>(), {
  machines: () => [],
  coveredMachineIds: () => [],
  hasContract: false,
  includesSpareParts: false,
  showPrice: false,
  quantityReadonly: false,
})

const { t } = useI18n()

const coveredIdSet = computed(() => new Set((props.coveredMachineIds || []).map(Number)))
const coveredMachines = computed(() =>
  (props.machines || []).filter((machine) => coveredIdSet.value.has(Number(machine.id))),
)
const otherMachines = computed(() =>
  (props.machines || []).filter((machine) => !coveredIdSet.value.has(Number(machine.id))),
)
const groupMachines = computed(() => props.hasContract && (coveredMachines.value.length > 0 || otherMachines.value.length > 0))

function labelFor(item: any) {
  return props.itemLabel ? props.itemLabel(item) : item.name
}

function canCover(line: InvoiceEditLine) {
  if (!props.hasContract) return false
  if (!line.machine_id) return true
  return coveredIdSet.value.has(Number(line.machine_id))
}

function defaultCovered(line: InvoiceEditLine) {
  if (!canCover(line) || isCustomLine(line) || !line.item_id) return false
  const item = props.catalog.find((row) => String(row.id) === line.item_id)
  if (!item) return false
  if (item.type === 'service') return true
  if (item.type === 'tracked_part' && item.is_sellable !== false) return props.includesSpareParts
  return false
}

function applyCoverageDefault(line: InvoiceEditLine) {
  if (!canCover(line)) {
    line.is_covered = false
    return
  }
  if (!line.coveredTouched) line.is_covered = defaultCovered(line)
}

function onCatalogPick(line: InvoiceEditLine) {
  applyCoverageDefault(line)
  if (!props.showPrice) return
  const item = props.catalog.find((row) => String(row.id) === line.item_id)
  if (item && (!line.unit_amount || line.unit_amount === '0')) {
    line.unit_amount = String(item.default_price ?? 0)
  }
}

function onMachineChange(line: InvoiceEditLine) {
  applyCoverageDefault(line)
}

function onKind(line: InvoiceEditLine, kind: 'catalog' | 'custom') {
  setLineKind(line, kind)
  applyCoverageDefault(line)
}

function setCovered(line: InvoiceEditLine, value: boolean) {
  if (!canCover(line)) {
    line.is_covered = false
    return
  }
  line.is_covered = value
  line.coveredTouched = true
}

function addLine() {
  lines.value = [...lines.value, blankInvoiceLine()]
}

function removeLine(index: number) {
  if (lines.value.length === 1) {
    lines.value = [blankInvoiceLine()]
    return
  }
  lines.value = lines.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(line, i) in lines"
      :key="line.key"
      class="space-y-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
    >
      <div class="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
        <button
          type="button"
          class="rounded-md px-2 py-1.5 font-medium"
          :class="!isCustomLine(line) ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'"
          @click="onKind(line, 'catalog')"
        >{{ t('tech.catalogItem') }}</button>
        <button
          type="button"
          class="rounded-md px-2 py-1.5 font-medium"
          :class="isCustomLine(line) ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'"
          @click="onKind(line, 'custom')"
        >{{ t('tech.customItem') }}</button>
      </div>
      <div class="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_auto]" :class="showPrice && 'sm:!grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_auto]'">
        <select v-if="!isCustomLine(line)" v-model="line.item_id" class="select" @change="onCatalogPick(line)">
          <option value="">{{ t('common.item') }}</option>
          <option v-for="item in catalog" :key="item.id" :value="String(item.id)">{{ labelFor(item) }}</option>
        </select>
        <Input v-else v-model="line.description" :placeholder="t('tech.customItemPh')" />
        <div
          v-if="quantityReadonly"
          class="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
          :title="t('common.qty')"
        >{{ line.quantity }}</div>
        <Input v-else v-model="line.quantity" type="text" inputmode="decimal" :title="t('common.qty')" />
        <Input v-if="showPrice" v-model="line.unit_amount" type="number" min="0" step="1" :title="t('dispatch.unitPrice')" />
        <DeleteButton icon-only @click="removeLine(i)" />
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select v-if="machines.length" v-model="line.machine_id" class="select min-w-0 flex-1" @change="onMachineChange(line)">
          <option value="">{{ t('tech.machineOptional') }}</option>
          <template v-if="groupMachines">
            <optgroup v-if="coveredMachines.length" :label="t('contracts.coveredMachines')">
              <option v-for="machine in coveredMachines" :key="machine.id" :value="String(machine.id)">
                {{ machineLabel(machine) }} {{ machine.serial }}
              </option>
            </optgroup>
            <optgroup v-if="otherMachines.length" :label="t('tech.otherSiteMachines')">
              <option v-for="machine in otherMachines" :key="machine.id" :value="String(machine.id)">
                {{ machineLabel(machine) }} {{ machine.serial }}
              </option>
            </optgroup>
          </template>
          <option v-else v-for="machine in machines" :key="machine.id" :value="String(machine.id)">
            {{ machineLabel(machine) }} {{ machine.serial }}
          </option>
        </select>
        <label class="flex shrink-0 items-center gap-2 text-sm" :class="!canCover(line) && 'opacity-60'">
          <Checkbox
            :model-value="line.is_covered"
            :disabled="!canCover(line)"
            @update:model-value="setCovered(line, $event === true)"
          />
          {{ t('dispatch.covered') }}
        </label>
      </div>
    </div>
    <Button type="button" size="sm" variant="outline" @click="addLine">
      <Plus class="size-3.5" /> {{ t('tech.addLine') }}
    </Button>
  </div>
</template>
