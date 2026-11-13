<!-- GAMCS F16: who changed what, when, on leads, deals, relationships, proposals and engagements. Management and Admin. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <div class="text-lg-medium text-ink-gray-9">{{ __('Audit log') }}</div>
    </template>
    <template #right-header>
      <Button
        :label="__('Export CSV')"
        icon-left="lucide-download"
        :disabled="!log.data?.length"
        @click="exportCsv"
      />
    </template>
  </LayoutHeader>
  <div class="gamcs-canvas flex-1 overflow-y-auto px-4 py-6 sm:px-6">
    <div class="mx-auto flex max-w-6xl flex-col gap-4">
      <form
        class="gamcs-card grid grid-cols-2 items-end gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6"
        data-testid="audit-filters"
        @submit.prevent="log.reload()"
      >
        <DatePicker :label="__('From')" v-model="filters.from_date" :placeholder="__('From')" />
        <DatePicker :label="__('To')" v-model="filters.to_date" :placeholder="__('To')" />
        <Link class="w-full" :label="__('Changed by')" doctype="User" v-model="filters.user" :placeholder="__('Anyone')" />
        <FormControl
          type="select"
          :label="__('Record type')"
          v-model="filters.doctype"
          :options="doctypes"
        />
        <FormControl
          type="text"
          :label="__('Record ID')"
          v-model="filters.docname"
          :placeholder="__('e.g. CRM-DEAL-2026-00012')"
        />
        <Button type="submit" variant="solid" :label="__('Apply')" />
      </form>
      <div v-if="log.error" class="gamcs-card p-4 text-base text-ink-red-6">{{ log.error.messages?.[0] || log.error.message }}</div>
      <div v-else-if="log.data && !log.data.length" class="gamcs-card p-6 text-base text-ink-gray-6">{{ __('Nothing changed in this range.') }}</div>
      <div v-else-if="log.data" class="gamcs-card overflow-hidden" data-testid="audit-table">
        <table class="hidden w-full text-base sm:table">
          <thead class="bg-surface-gray-1 text-left text-sm text-ink-gray-6">
            <tr>
              <th class="px-4 py-2 font-medium">{{ __('When') }}</th>
              <th class="px-4 py-2 font-medium">{{ __('Record') }}</th>
              <th class="px-4 py-2 font-medium">{{ __('Change') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-gray-1">
            <tr v-for="(e, i) in log.data" :key="i">
              <td class="whitespace-nowrap px-4 py-2.5 text-ink-gray-6">{{ formatDate(e.timestamp, 'DD MMM, HH:mm') }}</td>
              <td class="whitespace-nowrap px-4 py-2.5">
                <router-link v-if="routeFor(e)" :to="routeFor(e)" class="text-ink-blue-link hover:underline">{{ e.docname }}</router-link>
                <span v-else class="text-ink-gray-9">{{ e.docname }}</span>
                <span class="gamcs-pill gamcs-pill-gray ml-2">{{ kind(e) }}</span>
              </td>
              <td class="px-4 py-2.5 text-ink-gray-9">{{ e.text }}</td>
            </tr>
          </tbody>
        </table>
        <ul class="divide-y divide-outline-gray-1 sm:hidden">
          <li v-for="(e, i) in log.data" :key="i" class="flex flex-col gap-1 px-4 py-3">
            <div class="flex items-center justify-between gap-2 text-sm text-ink-gray-6">
              <span class="truncate">
                <router-link v-if="routeFor(e)" :to="routeFor(e)" class="text-ink-blue-link">{{ e.docname }}</router-link>
                <span v-else>{{ e.docname }}</span>
                · {{ kind(e) }}
              </span>
              <span class="shrink-0">{{ formatDate(e.timestamp, 'DD MMM, HH:mm') }}</span>
            </div>
            <div class="text-p-base text-ink-gray-9">{{ e.text }}</div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import Link from '@/components/Controls/Link.vue'
import { formatDate } from '@/utils'
import { DatePicker, FormControl, createResource, usePageMeta } from 'frappe-ui'
import { reactive } from 'vue'

const today = new Date()
const monthAgo = new Date(today.getTime() - 30 * 86400000)
const filters = reactive({
  from_date: monthAgo.toISOString().slice(0, 10),
  to_date: today.toISOString().slice(0, 10),
  user: '',
  doctype: '',
  docname: '',
})
const doctypes = [
  { label: __('All'), value: '' },
  { label: __('Leads'), value: 'CRM Lead' },
  { label: __('Deals'), value: 'CRM Deal' },
  { label: __('Relationships'), value: 'GAMCS Relationship' },
  { label: __('Proposals'), value: 'GAMCS Proposal' },
  { label: __('Engagements'), value: 'GAMCS Engagement' },
]

const log = createResource({
  url: 'gamcs_crm.api.audit.get_audit_log',
  makeParams: () => ({ ...filters, doctype: filters.doctype || null, user: filters.user || null, docname: filters.docname || null }),
  auto: true,
})

const routes = { 'CRM Lead': ['Lead', 'leadId'], 'CRM Deal': ['Deal', 'dealId'], 'GAMCS Relationship': ['Relationship', 'relationshipId'] }
function kind(e) {
  return e.doctype.replace('CRM ', '').replace('GAMCS ', '')
}
function routeFor(e) {
  const r = routes[e.doctype]
  return r ? { name: r[0], params: { [r[1]]: e.docname } } : null
}

function exportCsv() {
  const rows = [['when', 'user', 'doctype', 'record', 'field', 'old', 'new']]
  for (const e of log.data) rows.push([e.timestamp, e.user_name, e.doctype, e.docname, e.label, e.old ?? '', e.new ?? ''])
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `audit-${filters.from_date}-${filters.to_date}.csv`
  a.click()
}

usePageMeta(() => ({ title: __('Audit log') }))
</script>
