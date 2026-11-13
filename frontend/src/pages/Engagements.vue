<!-- GAMCS E65 (Phase 2): won work being onboarded and billed. One card per engagement with
     onboarding progress and billed-to-date; BD sees only their own (server scope). -->
<template>
  <LayoutHeader>
    <template #left-header>
      <div class="text-lg-medium text-ink-gray-9">{{ __('Engagements') }}</div>
    </template>
    <template #right-header>
      <Button
        v-if="list.data?.can_enter_revenue"
        :label="__('Import revenue')"
        icon-left="lucide-upload"
        data-testid="import-revenue"
        @click="showImport = true"
      />
    </template>
  </LayoutHeader>
  <div class="gamcs-canvas flex-1 overflow-y-auto px-4 py-6 sm:px-6">
    <div class="flex max-w-5xl flex-col gap-6">
      <h1 class="text-2xl leading-tight text-ink-gray-9 sm:text-3xl">
        <span class="gamcs-title-light">{{ __('Client') + ' ' }}</span>
        <span class="font-semibold">{{ __('engagements') }}</span>
      </h1>
      <div
        class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        role="tablist"
        :aria-label="__('Filter engagements')"
      >
        <button
          v-for="f in statusFilters"
          :key="f.value"
          type="button"
          role="tab"
          :aria-selected="status === f.value"
          class="inline-flex h-8 shrink-0 items-center rounded-full px-4 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          :class="
            status === f.value
              ? 'bg-surface-gray-10 text-ink-base'
              : 'bg-surface-base text-ink-gray-7 shadow-sm hover:bg-surface-gray-2'
          "
          @click="status = f.value"
        >
          {{ f.label }}
        </button>
      </div>

      <div
        v-if="list.data && !rows.length"
        class="gamcs-card p-5 text-base text-ink-gray-6"
        data-testid="engagements-empty"
      >
        {{ __('No engagements yet. One is created when a deal is marked won.') }}
      </div>
      <ul v-else class="grid gap-4 md:grid-cols-2" data-testid="engagements-list">
        <li v-for="e in rows" :key="e.name">
          <router-link
            :to="{ name: 'Engagement', params: { engagementId: e.name } }"
            class="gamcs-card flex h-full flex-col gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="truncate text-base font-semibold text-ink-gray-9">
                  {{ e.client_legal_name || e.client || e.name }}
                </div>
                <div class="truncate text-sm text-ink-gray-6">
                  {{ __('Started {0}', [formatDay(e.start_date)]) }}
                </div>
              </div>
              <span class="gamcs-pill shrink-0" :class="e.status === 'Onboarding' ? 'gamcs-pill-soft' : 'gamcs-pill-gray'">
                {{ __(e.status) }}
              </span>
            </div>
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between text-sm">
                <span class="text-ink-gray-6">{{ __('Onboarding') }}</span>
                <span class="gamcs-num text-ink-gray-8">
                  {{ __('{0} of {1}', [e.onboarding_done || 0, e.onboarding_total || 0]) }}
                  <span v-if="e.overdue_items" class="gamcs-pill gamcs-pill-yellow ml-1">
                    {{ __('{0} overdue', [e.overdue_items]) }}
                  </span>
                </span>
              </div>
              <div
                class="h-2 overflow-hidden rounded-full gamcs-track-todo"
                role="progressbar"
                :aria-valuenow="e.onboarding_done || 0"
                :aria-valuemax="e.onboarding_total || 0"
                :aria-label="__('Onboarding progress')"
              >
                <div class="h-full rounded-full gamcs-track-done" :style="{ width: pct(e) + '%' }" />
              </div>
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div>
                <span class="text-ink-gray-6">{{ __('ACV') }}</span>
                <span class="gamcs-num ml-1.5 font-semibold text-ink-gray-9">{{
                  formatMoney(e.base_expected_annual_revenue)
                }}</span>
              </div>
              <div>
                <span class="text-ink-gray-6">{{ __('Billed') }}</span>
                <span class="gamcs-num ml-1.5 font-semibold text-ink-gray-9">{{ formatMoney(e.billed_to_date) }}</span>
              </div>
            </div>
          </router-link>
        </li>
      </ul>
    </div>
  </div>
  <RevenueImportModal v-if="showImport" v-model="showImport" @imported="list.reload()" />
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import RevenueImportModal from '@/components/Modals/RevenueImportModal.vue'
import { formatDay, formatMoney } from '@/utils/gamcs'
import { createResource, usePageMeta } from 'frappe-ui'
import { computed, ref, watch } from 'vue'

usePageMeta(() => ({ title: __('Engagements') }))

const status = ref('')
const statusFilters = [
  { value: '', label: __('All') },
  { value: 'Onboarding', label: __('Onboarding') },
  { value: 'Active', label: __('Active') },
  { value: 'On Hold', label: __('On hold') },
  { value: 'Completed', label: __('Completed') },
]
const showImport = ref(false)

const list = createResource({
  url: 'gamcs_crm.api.engagement.get_engagements',
  makeParams: () => ({ status: status.value || null }),
  auto: true,
})
watch(status, () => list.reload())
const rows = computed(() => list.data?.engagements || [])

function pct(e) {
  return e.onboarding_total ? Math.round(((e.onboarding_done || 0) / e.onboarding_total) * 100) : 0
}
</script>
