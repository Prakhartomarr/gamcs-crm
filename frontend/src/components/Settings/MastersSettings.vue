<!-- GAMCS E65 (PRD "configurable"): Admin edits stages, lists and follow-up intervals here,
     without the desk. Every write goes through gamcs_crm.api.masters, which keeps the status
     rules (D33, D37, D39) and the next-action rule intact. -->
<template>
  <div class="flex h-full flex-col gap-6 px-6 py-8 text-ink-gray-8" :data-testid="'masters-' + section">
    <div class="flex flex-col gap-1 px-2">
      <h2 class="flex h-5 gap-2 text-2xl-semibold leading-none">{{ heading }}</h2>
      <p class="text-p-base text-ink-gray-6">{{ intro }}</p>
    </div>

    <!-- follow-up intervals -->
    <div v-if="section === 'intervals'" class="flex flex-col px-2">
      <div v-for="f in intervalFields" :key="f.key" class="flex items-center justify-between gap-4 border-b border-outline-gray-1 py-3">
        <div class="flex flex-col">
          <div class="text-p-base-medium text-ink-gray-7">{{ f.label }}</div>
          <div class="text-p-sm text-ink-gray-5">{{ f.help }}</div>
        </div>
        <FormControl
          v-model="intervals[f.key]"
          type="number"
          class="w-24"
          :min="f.min"
          :max="f.max"
          :aria-label="f.label"
          :data-testid="'interval-' + f.key"
        />
      </div>
      <div class="flex justify-end pt-4">
        <Button variant="solid" :label="__('Save')" :loading="savingIntervals" data-testid="save-intervals" @click="saveIntervals" />
      </div>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2 px-2">
        <div class="flex flex-wrap gap-1" role="tablist" :aria-label="heading">
          <button
            v-for="m in groupMasters"
            :key="m.key"
            type="button"
            role="tab"
            :aria-selected="current === m.key"
            class="h-7 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
            :class="current === m.key ? 'bg-surface-gray-10 text-ink-base' : 'bg-surface-gray-2 text-ink-gray-7 hover:bg-surface-gray-3'"
            :data-testid="'master-tab-' + m.key"
            @click="current = m.key"
          >
            {{ m.label }}
          </button>
        </div>
        <FormControl v-model="search" type="text" class="w-48" :placeholder="__('Search')" :aria-label="__('Search')" />
      </div>

      <div class="flex-1 overflow-auto px-2" data-testid="master-rows">
        <div
          class="sticky top-0 z-10 hidden gap-2 bg-surface-elevation-2 pb-2 text-sm text-ink-gray-6 sm:grid"
          :style="gridStyle"
        >
          <span v-for="f in fields" :key="f.fieldname">{{ f.label }}</span>
          <span v-if="master?.is_stage">{{ __('In use') }}</span>
          <span />
        </div>
        <div
          v-for="row in filteredRows"
          :key="row.name"
          class="grid items-center gap-2 border-b border-outline-gray-1 py-2"
          :style="gridStyle"
          :data-testid="'master-row'"
          :data-name="row.name"
        >
          <template v-for="f in fields" :key="f.fieldname">
            <FormControl
              v-if="f.fieldtype === 'Select'"
              v-model="drafts[row.name][f.fieldname]"
              type="select"
              :options="f.options.map((o) => ({ label: __(o), value: o }))"
              :aria-label="f.label"
            />
            <FormControl
              v-else-if="f.fieldtype === 'Check'"
              v-model="drafts[row.name][f.fieldname]"
              type="checkbox"
              :aria-label="f.label"
            />
            <FormControl
              v-else
              v-model="drafts[row.name][f.fieldname]"
              :type="['Int', 'Float', 'Percent'].includes(f.fieldtype) ? 'number' : 'text'"
              :aria-label="f.label"
              :data-testid="f.title ? 'master-title' : undefined"
            />
          </template>
          <span v-if="master?.is_stage" class="gamcs-num text-sm text-ink-gray-6">{{ row.in_use || 0 }}</span>
          <div class="flex justify-end gap-1">
            <Button
              v-if="isDirty(row)"
              :label="__('Save')"
              :loading="savingRow === row.name"
              data-testid="master-save"
              @click="saveRow(row)"
            />
            <Button
              variant="ghost"
              icon="lucide-trash-2"
              :aria-label="__('Delete {0}', [row.name])"
              :disabled="!!row.in_use"
              @click="deleteRow(row)"
            />
          </div>
        </div>
        <form class="grid items-center gap-2 py-3" :style="gridStyle" data-testid="master-add" @submit.prevent="addRow">
          <template v-for="f in fields" :key="f.fieldname">
            <FormControl
              v-if="f.fieldtype === 'Select'"
              v-model="newRow[f.fieldname]"
              type="select"
              :options="f.options.map((o) => ({ label: __(o), value: o }))"
              :aria-label="__('New') + ' ' + f.label"
            />
            <FormControl v-else-if="f.fieldtype === 'Check'" v-model="newRow[f.fieldname]" type="checkbox" :aria-label="f.label" />
            <FormControl
              v-else
              v-model="newRow[f.fieldname]"
              :type="['Int', 'Float', 'Percent'].includes(f.fieldtype) ? 'number' : 'text'"
              :placeholder="f.title ? __('Add {0}', [singular]) : ''"
              :aria-label="__('New') + ' ' + f.label"
              :data-testid="f.title ? 'master-new-title' : undefined"
            />
          </template>
          <span v-if="master?.is_stage" />
          <div class="flex justify-end">
            <Button type="submit" variant="solid" :label="__('Add')" :loading="adding" data-testid="master-add-button" />
          </div>
        </form>
      </div>
    </template>
  </div>
</template>

<script setup>
import { FormControl, call, createResource, toast } from 'frappe-ui'
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({
  // 'stages' | 'lists' | 'intervals'
  section: { type: String, required: true },
})

const COPY = {
  stages: {
    heading: __('Stages'),
    intro: __('Lead, opportunity and relationship stages. The type decides the next-action rule: Open and Ongoing need a next action date, On hold needs a reconnect date. Probability is what a stage change applies to a deal.'),
  },
  lists: {
    heading: __('Lists'),
    intro: __('The choices people pick from: sources, services, lost reasons, industries, countries, competitors, nurture categories, lead types and the onboarding checklist.'),
  },
  intervals: {
    heading: __('Follow-up intervals'),
    intro: __('When a record counts as stale, and how far ahead the Follow-ups page looks.'),
  },
}
const heading = computed(() => COPY[props.section].heading)
const intro = computed(() => COPY[props.section].intro)

function errorText(e) {
  return e?.messages?.[0] || e?.message || __('Could not save')
}

// ---------------- intervals
const intervalFields = [
  { key: 'stale_days', label: __('Stale after (days)'), help: __('An active record with no activity for this long is flagged stale. Default 7.'), min: 1, max: 365 },
  { key: 'follow_up_horizon_days', label: __('Upcoming horizon (days)'), help: __('Follow-ups lists next actions due within this many days. Default 7.'), min: 1, max: 90 },
]
const intervals = reactive({})
const savingIntervals = ref(false)
async function saveIntervals() {
  savingIntervals.value = true
  try {
    Object.assign(intervals, await call('gamcs_crm.api.masters.save_intervals', { values: { ...intervals } }))
    toast.success(__('Saved'))
  } catch (e) {
    toast.error(errorText(e))
  } finally {
    savingIntervals.value = false
  }
}

// ---------------- stages and lists
const masters = createResource({ url: 'gamcs_crm.api.masters.get_masters' })
const groupMasters = computed(() =>
  (masters.data || []).filter((m) => m.group === (props.section === 'stages' ? 'Stages' : 'Lists')),
)
const current = ref('')
watch(groupMasters, (list) => {
  if (list.length && !list.some((m) => m.key === current.value)) current.value = list[0].key
})
// the three Settings entries share this component, so a switch between them is a prop change
watch(
  () => props.section,
  (section) => {
    if (section === 'intervals')
      call('gamcs_crm.api.masters.get_intervals').then((v) => Object.assign(intervals, v))
    else if (!masters.data) masters.fetch()
  },
  { immediate: true },
)
const master = computed(() => groupMasters.value.find((m) => m.key === current.value))
const fields = computed(() => master.value?.fields || [])
const titleField = computed(() => fields.value.find((f) => f.title)?.fieldname)
const singular = computed(() => (master.value?.label || '').replace(/s$/, '').toLowerCase())
const gridStyle = computed(() => {
  const cols = fields.value.map((f) => (f.title ? 'minmax(10rem, 2fr)' : 'minmax(5rem, 1fr)'))
  if (master.value?.is_stage) cols.push('3.5rem')
  cols.push('7rem')
  return { gridTemplateColumns: cols.join(' ') }
})

const rows = ref([])
const drafts = reactive({})
const search = ref('')
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? rows.value.filter((r) => String(r.name).toLowerCase().includes(q)) : rows.value
})

function blankRow() {
  const out = {}
  for (const f of fields.value) {
    if (f.fieldtype === 'Select') out[f.fieldname] = f.fieldname === 'type' ? 'Ongoing' : f.options[0]
    else if (f.fieldtype === 'Check') out[f.fieldname] = f.fieldname === 'enabled' ? 1 : 0
    else out[f.fieldname] = ''
  }
  return out
}
const newRow = ref({})

async function loadRows() {
  if (!current.value) return
  const data = await call('gamcs_crm.api.masters.get_rows', { master: current.value })
  rows.value = data
  for (const k of Object.keys(drafts)) delete drafts[k]
  for (const r of data) drafts[r.name] = pick(r)
  newRow.value = blankRow()
}
watch(current, () => {
  search.value = ''
  loadRows()
})

function pick(r) {
  const out = {}
  for (const f of fields.value) out[f.fieldname] = r[f.fieldname]
  return out
}
function isDirty(row) {
  const d = drafts[row.name]
  return d && fields.value.some((f) => String(d[f.fieldname] ?? '') !== String(row[f.fieldname] ?? ''))
}

const savingRow = ref('')
async function saveRow(row) {
  savingRow.value = row.name
  try {
    await call('gamcs_crm.api.masters.save_row', { master: current.value, name: row.name, values: drafts[row.name] })
    toast.success(__('Saved {0}', [drafts[row.name][titleField.value]]))
    await loadRows()
  } catch (e) {
    toast.error(errorText(e))
  } finally {
    savingRow.value = ''
  }
}

const adding = ref(false)
async function addRow() {
  if (!String(newRow.value[titleField.value] || '').trim()) return
  adding.value = true
  try {
    await call('gamcs_crm.api.masters.save_row', { master: current.value, values: newRow.value })
    toast.success(__('Added {0}', [newRow.value[titleField.value]]))
    await loadRows()
  } catch (e) {
    toast.error(errorText(e))
  } finally {
    adding.value = false
  }
}

async function deleteRow(row) {
  if (!window.confirm(__('Delete {0}?', [row.name]))) return
  try {
    await call('gamcs_crm.api.masters.delete_row', { master: current.value, name: row.name })
    toast.success(__('Deleted {0}', [row.name]))
    await loadRows()
  } catch (e) {
    toast.error(errorText(e))
  }
}
</script>
