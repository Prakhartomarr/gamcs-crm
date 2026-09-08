<!-- GAMCS F2: today's queue across leads, deals and relationships -->
<template>
  <LayoutHeader>
    <template #left-header>
      <div class="text-lg-medium text-ink-gray-9">{{ __('Follow-ups') }}</div>
    </template>
    <template #right-header>
      <Button
        :label="__('Refresh')"
        icon-left="refresh-cw"
        @click="data.reload()"
      />
    </template>
  </LayoutHeader>
  <div class="flex-1 overflow-y-auto p-5">
    <div v-if="data.data" class="mx-auto flex max-w-5xl flex-col gap-6">
      <div class="grid grid-cols-5 gap-3">
        <div
          v-for="b in bucketOrder"
          :key="b.key"
          class="rounded-lg border p-3 text-center"
          :class="b.tone"
        >
          <div class="text-2xl-semibold text-ink-gray-9">
            {{ data.data.counts[b.key] }}
          </div>
          <div class="text-sm text-ink-gray-6">{{ b.label }}</div>
        </div>
      </div>
      <section v-for="b in bucketOrder" :key="b.key">
        <h2 class="mb-2 text-base font-semibold text-ink-gray-8">
          {{ b.label }}
        </h2>
        <div
          v-if="!data.data.buckets[b.key].length"
          class="rounded-lg border border-dashed p-4 text-center text-sm text-ink-gray-5"
        >
          {{ __('Nothing here') }}
        </div>
        <div v-else class="divide-y rounded-lg border">
          <div
            v-for="row in data.data.buckets[b.key]"
            :key="row.doctype + row.name"
            class="flex items-center gap-3 px-3 py-2"
          >
            <Icon
              :icon="icons[row.doctype]"
              class="size-4 shrink-0 text-ink-gray-5"
            />
            <router-link :to="routeFor(row)" class="min-w-0 flex-1">
              <div class="truncate text-base text-ink-gray-9">
                {{ row.title }}
                <span class="ml-2 text-sm text-ink-gray-5">{{
                  row.status
                }}</span>
                <Badge
                  v-if="row.is_stale"
                  class="ml-2"
                  theme="orange"
                  variant="subtle"
                  :label="__('Stale')"
                />
              </div>
              <div class="truncate text-sm text-ink-gray-6">
                <template v-if="b.key === 'reconnect_due'"
                  >{{ __('Reconnect') }} ·
                  {{ formatDate(row.reconnect_date) }} ·
                  {{ row.nurture_reason || '' }}</template
                >
                <template v-else-if="row.next_action_date"
                  >{{ row.next_action_type || '' }} {{ row.next_step || '' }} ·
                  {{ formatDate(row.next_action_date) }}</template
                >
                <template v-else>{{ __('No next action set') }}</template>
              </div>
            </router-link>
            <Avatar
              v-if="row.owner_user"
              size="sm"
              :label="getUser(row.owner_user).full_name"
              :image="getUser(row.owner_user).user_image"
            />
            <Button
              size="sm"
              :label="__('Log')"
              icon-left="plus"
              @click="openLog(row)"
            />
          </div>
        </div>
      </section>
    </div>
    <div v-else class="flex h-full items-center justify-center text-ink-gray-5">
      {{ __('Loading...') }}
    </div>
  </div>
  <QuickLog
    v-if="logTarget"
    v-model="showLog"
    :doctype="logTarget.doctype"
    :docname="logTarget.name"
    @logged="data.reload()"
  />
</template>

<script setup>
import Icon from '@/components/Icon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import QuickLog from '@/components/QuickLog.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue'
import LucideHandshake from '~icons/lucide/handshake'
import { usersStore } from '@/stores/users'
import { formatDate } from '@/utils'
import { Avatar, Badge, createResource, usePageMeta } from 'frappe-ui'
import { ref } from 'vue'

const { getUser } = usersStore()
usePageMeta(() => ({ title: __('Follow-ups') }))

const icons = {
  'CRM Lead': LeadsIcon,
  'CRM Deal': DealsIcon,
  'GAMCS Relationship': LucideHandshake,
}
const bucketOrder = [
  { key: 'overdue', label: __('Overdue'), tone: 'border-red-200' },
  { key: 'today', label: __('Due today'), tone: 'border-amber-200' },
  { key: 'upcoming', label: __('Upcoming'), tone: '' },
  {
    key: 'needs_next_action',
    label: __('Needs next action'),
    tone: 'border-red-200',
  },
  { key: 'reconnect_due', label: __('Reconnect due'), tone: '' },
]

const data = createResource({
  url: 'gamcs_crm.api.follow_ups.get_follow_ups',
  cache: 'gamcs-follow-ups',
  auto: true,
})

function routeFor(row) {
  if (row.doctype === 'CRM Deal')
    return { name: 'Deal', params: { dealId: row.name } }
  if (row.doctype === 'GAMCS Relationship')
    return { name: 'Relationship', params: { relationshipId: row.name } }
  return { name: 'Lead', params: { leadId: row.name } }
}

const showLog = ref(false)
const logTarget = ref(null)
function openLog(row) {
  logTarget.value = row
  showLog.value = true
}
</script>
