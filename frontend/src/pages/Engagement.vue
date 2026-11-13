<!-- GAMCS E65 (Phase 2): one engagement. Onboarding checklist (owner and due date per item,
     overdue highlighted) and monthly billed revenue, entered by Admin / Management. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <Breadcrumbs :items="breadcrumbs" />
    </template>
    <template v-if="doc" #right-header>
      <Dropdown v-if="eng.data?.can_edit" :options="statusOptions" align="end">
        <Button :label="__(doc.status)" icon-right="lucide-chevron-down" data-testid="engagement-status" />
      </Dropdown>
    </template>
  </LayoutHeader>
  <div v-if="doc" class="gamcs-canvas flex-1 overflow-y-auto px-4 py-6 sm:px-6">
    <div class="flex max-w-5xl flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold leading-tight text-ink-gray-9 sm:text-3xl" data-testid="engagement-title">
          {{ doc.client_legal_name || doc.client || doc.name }}
        </h1>
        <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span v-for="f in facts" :key="f.label">
            <span class="text-ink-gray-6">{{ f.label }}</span>
            <span class="gamcs-num ml-1.5 font-semibold text-ink-gray-9">{{ f.value }}</span>
          </span>
          <router-link
            v-if="doc.deal"
            :to="{ name: 'Deal', params: { dealId: doc.deal } }"
            class="text-ink-gray-8 underline-offset-2 hover:underline"
            >{{ __('Open the deal') }}</router-link
          >
        </div>
      </div>

      <section class="gamcs-card overflow-hidden" data-testid="onboarding">
        <header class="flex flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 class="text-lg font-semibold text-ink-gray-9">{{ __('Onboarding') }}</h2>
          <span class="gamcs-pill gamcs-pill-soft gamcs-num" data-testid="onboarding-progress">
            {{ __('{0} of {1} done', [doc.onboarding_done || 0, doc.onboarding_total || 0]) }}
          </span>
        </header>
        <div class="px-5 pb-3">
          <div class="h-2 overflow-hidden rounded-full gamcs-track-todo" role="progressbar"
            :aria-valuenow="doc.onboarding_done || 0" :aria-valuemax="doc.onboarding_total || 0" :aria-label="__('Onboarding progress')">
            <div class="h-full rounded-full gamcs-track-done" :style="{ width: progress + '%' }" />
          </div>
        </div>
        <ul class="divide-y divide-outline-gray-1">
          <li
            v-for="row in doc.onboarding"
            :key="row.name"
            class="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4"
            :data-testid="'onboarding-item'"
          >
            <label class="flex min-w-0 flex-1 items-center gap-3">
              <input
                type="checkbox"
                class="size-4 shrink-0 rounded border-outline-gray-3"
                :checked="!!row.done"
                :disabled="!eng.data?.can_edit"
                :aria-label="row.item"
                @change="update(row, { done: $event.target.checked ? 1 : 0 })"
              />
              <span class="truncate text-base" :class="row.done ? 'text-ink-gray-6 line-through' : 'text-ink-gray-9'">{{ row.item }}</span>
              <span v-if="!row.done && isOverdue(row.due_date)" class="gamcs-pill gamcs-pill-yellow shrink-0">
                {{ dueLabel(row.due_date) }}
              </span>
            </label>
            <div class="flex items-center gap-2 pl-7 sm:pl-0">
              <Link
                class="w-44"
                :value="row.assigned_to"
                doctype="User"
                :placeholder="__('Owner')"
                :filters="{ user_type: 'System User', enabled: 1 }"
                :disabled="!eng.data?.can_edit"
                @change="(v) => update(row, { assigned_to: v })"
              />
              <DatePicker
                class="w-36"
                :model-value="row.due_date"
                :placeholder="__('Due date')"
                :format="getFormat('', '', true, false, false)"
                :disabled="!eng.data?.can_edit"
                @update:model-value="(v) => v !== row.due_date && update(row, { due_date: v })"
              />
            </div>
          </li>
        </ul>
        <div v-if="!doc.onboarding?.length" class="px-5 pb-4 text-base text-ink-gray-6">
          {{ __('No checklist. An Admin sets the default items in Settings → Masters.') }}
        </div>
      </section>

      <section class="gamcs-card overflow-hidden" data-testid="revenue">
        <header class="flex flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 class="text-lg font-semibold text-ink-gray-9">{{ __('Billed revenue') }}</h2>
          <span class="gamcs-num text-sm text-ink-gray-6">
            {{ __('{0} billed to date, INR', [formatMoney(doc.billed_to_date)]) }}
          </span>
        </header>
        <form
          v-if="eng.data?.can_enter_revenue"
          class="flex flex-wrap items-end gap-3 px-5 pb-4"
          data-testid="revenue-form"
          @submit.prevent="addRevenue"
        >
          <FormControl v-model="form.month" type="month" :label="__('Month')" class="w-40" required />
          <FormControl
            v-model="form.amount"
            type="number"
            min="0"
            step="any"
            :label="__('Billed ({0}, excl. tax)', [doc.currency || 'INR'])"
            class="w-48"
            required
          />
          <FormControl v-model="form.notes" type="text" :label="__('Notes')" class="min-w-40 flex-1" />
          <Button type="submit" variant="solid" :label="__('Save month')" :loading="saving" />
        </form>
        <ul v-if="eng.data?.revenue?.length" class="divide-y divide-outline-gray-1 border-t border-outline-gray-1">
          <li v-for="r in eng.data.revenue" :key="r.name" class="flex items-center gap-3 px-5 py-2.5 text-base">
            <span class="w-24 shrink-0 text-ink-gray-8">{{ monthLabel(r.month) }}</span>
            <span class="gamcs-num flex-1 font-medium text-ink-gray-9">
              {{ formatMoney(r.amount, r.currency) }}
              <span v-if="r.currency !== 'INR'" class="text-sm font-normal text-ink-gray-6">
                ({{ formatMoney(r.base_amount) }})
              </span>
            </span>
            <span class="hidden min-w-0 truncate text-sm text-ink-gray-6 sm:block">{{ r.notes }}</span>
            <Button
              v-if="eng.data.can_enter_revenue"
              variant="ghost"
              icon="lucide-trash-2"
              :aria-label="__('Delete {0}', [monthLabel(r.month)])"
              @click="removeRevenue(r)"
            />
          </li>
        </ul>
        <div v-else class="px-5 pb-4 text-base text-ink-gray-6">
          {{ __('Nothing billed yet.') }}
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import Link from '@/components/Controls/Link.vue'
import { getFormat } from '@/utils'
import { daysFromToday, dueLabel, formatDay, formatMoney } from '@/utils/gamcs'
import { Breadcrumbs, DatePicker, Dropdown, FormControl, call, createResource, toast, usePageMeta } from 'frappe-ui'
import { computed, reactive, ref } from 'vue'

const props = defineProps({ engagementId: { type: String, required: true } })

const eng = createResource({
  url: 'gamcs_crm.api.engagement.get_engagement',
  makeParams: () => ({ name: props.engagementId }),
  auto: true,
})
const doc = computed(() => eng.data?.doc)
usePageMeta(() => ({ title: doc.value?.client_legal_name || __('Engagement') }))

const breadcrumbs = computed(() => [
  { label: __('Engagements'), route: { name: 'Engagements' } },
  { label: doc.value?.client_legal_name || props.engagementId, route: { name: 'Engagement', params: { engagementId: props.engagementId } } },
])

const facts = computed(() => {
  const d = doc.value || {}
  return [
    d.start_date && { label: __('Start'), value: formatDay(d.start_date) },
    d.billing_frequency && { label: __('Billing'), value: __(d.billing_frequency) },
    { label: __('ACV'), value: formatMoney(d.expected_annual_revenue, d.currency) },
    d.gross_margin_pct ? { label: __('Est. margin'), value: `${Math.round(d.gross_margin_pct)}%` } : null,
  ].filter(Boolean)
})
const progress = computed(() => {
  const d = doc.value || {}
  return d.onboarding_total ? Math.round(((d.onboarding_done || 0) / d.onboarding_total) * 100) : 0
})

const statusOptions = computed(() =>
  ['Onboarding', 'Active', 'On Hold', 'Completed'].map((s) => ({
    label: __(s),
    onClick: () => setStatus(s),
  })),
)

function isOverdue(date) {
  return (daysFromToday(date) ?? 0) < 0
}
function monthLabel(month) {
  return formatDay(month).replace(/^\d+ /, '')
}
function errorText(e) {
  return e?.messages?.[0] || e?.message || __('Something went wrong')
}

async function update(row, values) {
  try {
    eng.data = await call('gamcs_crm.api.engagement.update_onboarding', {
      engagement: props.engagementId,
      row: row.name,
      values,
    })
  } catch (e) {
    toast.error(errorText(e))
    eng.reload()
  }
}

async function setStatus(status) {
  try {
    await call('gamcs_crm.api.engagement.set_status', { engagement: props.engagementId, status })
    eng.reload()
  } catch (e) {
    toast.error(errorText(e))
  }
}

const form = reactive({ month: new Date().toISOString().slice(0, 7), amount: '', notes: '' })
const saving = ref(false)
async function addRevenue() {
  saving.value = true
  try {
    await call('gamcs_crm.api.engagement.save_revenue', {
      engagement: props.engagementId,
      month: `${form.month}-01`,
      amount: form.amount,
      notes: form.notes || null,
    })
    toast.success(__('Saved {0}', [monthLabel(`${form.month}-01`)]))
    form.amount = ''
    form.notes = ''
    eng.reload()
  } catch (e) {
    toast.error(errorText(e))
  } finally {
    saving.value = false
  }
}

async function removeRevenue(r) {
  try {
    await call('gamcs_crm.api.engagement.delete_revenue', { name: r.name })
    eng.reload()
  } catch (e) {
    toast.error(errorText(e))
  }
}
</script>
