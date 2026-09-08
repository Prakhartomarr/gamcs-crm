<!-- GAMCS F16: who changed what, when, on leads, deals, relationships, proposals and engagements. Management and Admin. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <div class="text-lg-medium text-ink-gray-9">{{ __('Audit log') }}</div>
    </template>
    <template #right-header>
      <Button
        :label="__('Export CSV')"
        icon-left="download"
        :disabled="!log.data?.length"
        @click="exportCsv"
      />
    </template>
  </LayoutHeader>
  <div class="flex-1 overflow-y-auto p-5">
    <div class="mx-auto flex max-w-6xl flex-col gap-4">
      <div class="flex flex-wrap items-end gap-2" data-testid="audit-filters">
        <DatePicker :label="__('From')" v-model="filters.from_date" :placeholder="__('From')" />
        <DatePicker :label="__('To')" v-model="filters.to_date" :placeholder="__('To')" />
        <Link :label="__('User')" doctype="User" v-model="filters.user" :placeholder="__('Anyone')" />
        <FormControl
          type="select"
          :label="__('Record type')"
          v-model="filters.doctype"
          :options="doctypes"
        />
        <FormControl type="text" :label="__('Record')" v-model="filters.docname" :placeholder="__('CRM-DEAL-2026-00012')" />
        <Button variant="solid" :label="__('Apply')" @click="log.reload()" />
      </div>
      <div v-if="log.error" class="text-base text-ink-red-5">{{ log.error.messages?.[0] || log.error.message }}</div>
      <div v-else-if="log.data && !log.data.length" class="text-base text-ink-gray-5">{{ __('Nothing changed in this range') }}</div>
      <table v-else-if="log.data" class="w-full text-base" data-testid="audit-table">
        <thead class="text-left text-sm text-ink-gray-5">
          <tr>
            <th class="py-2 pr-3">{{ __('When') }}</th>
            <th class="py-2 pr-3">{{ __('Record') }}</th>
            <th class="py-2">{{ __('Change') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in log.data" :key="i" class="border-t">
            <td class="whitespace-nowrap py-2 pr-3 text-ink-gray-5">{{ formatDate(e.timestamp, 'DD MMM HH:mm') }}</td>
            <td class="whitespace-nowrap py-2 pr-3">
              <router-link v-if="routeFor(e)" :to="routeFor(e)" class="text-ink-gray-9 hover:underline">{{ e.docname }}</router-link>
              <span v-else class="text-ink-gray-9">{{ e.docname }}</span>
              <span class="ml-1 text-ink-gray-5">{{ e.doctype.replace('CRM ', '').replace('GAMCS ', '') }}</span>
            </td>
            <td class="py-2 text-ink-gray-9">{{ e.text }}</td>
          </tr>
        </tbody>
      </table>
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
