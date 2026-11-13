<!-- GAMCS F2: today's queue across leads, deals and relationships.
     Filter pills on top, one card per bucket, plain-language due dates, one Log button per row. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <div class="text-lg-medium text-ink-gray-9">{{ __('Follow-ups') }}</div>
    </template>
    <template #right-header>
      <Button
        variant="ghost"
        :label="__('Refresh')"
        icon-left="lucide-refresh-cw"
        :loading="data.loading"
        @click="data.reload()"
      />
    </template>
  </LayoutHeader>
  <div class="gamcs-canvas flex-1 overflow-y-auto px-4 py-6 sm:px-6">
    <div class="flex max-w-5xl flex-col gap-6">
      <div class="flex flex-col gap-1">
        <div class="text-base text-ink-gray-5">{{ todayLabel }}</div>
        <h1 class="text-2xl leading-tight text-ink-gray-9 sm:text-3xl">
          <span class="gamcs-title-light">{{ __('Your') + ' ' }}</span>
          <span class="font-semibold">{{ __('follow-ups') }}</span>
        </h1>
      </div>

      <div
        class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        role="tablist"
        :aria-label="__('Filter follow-ups')"
        data-testid="follow-up-filters"
      >
        <button
          v-for="f in filters"
          :key="f.key"
          type="button"
          role="tab"
          :aria-selected="active === f.key"
          class="inline-flex h-8 shrink-0 items-center gap-2 rounded-full px-4 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          :class="
            active === f.key
              ? 'bg-surface-gray-10 text-ink-base'
              : 'bg-surface-base text-ink-gray-7 shadow-sm hover:bg-surface-gray-2'
          "
          @click="select(f.key)"
        >
          {{ f.label }}
          <span
            v-if="f.key !== 'all' && data.data"
            class="gamcs-num rounded-full px-1.5 text-sm"
            :class="
              f.key === 'overdue' && count(f.key)
                ? 'bg-[var(--gamcs-yellow)] text-[var(--gamcs-midnight)]'
                : active === f.key
                  ? 'bg-white/20'
                  : 'bg-surface-gray-2'
            "
          >
            {{ count(f.key) }}
          </span>
        </button>
      </div>

      <div
        v-if="!data.data"
        class="gamcs-card p-6 text-base text-ink-gray-5"
      >
        {{ __('Loading your follow-ups…') }}
      </div>

      <div
        v-else-if="!visibleBuckets.length"
        class="gamcs-card flex flex-col items-start gap-2 p-6"
        data-testid="follow-ups-empty"
      >
        <span
          class="lucide-circle-check size-6 text-ink-green-6"
          aria-hidden="true"
        />
        <div class="text-lg font-semibold text-ink-gray-9">
          {{ __('All caught up') }}
        </div>
        <div class="text-p-base text-ink-gray-6">
          {{
            active === 'all'
              ? __('Nothing is due and every open record has a next action.')
              : __('Nothing in this list right now.')
          }}
        </div>
      </div>

      <section
        v-for="b in visibleBuckets"
        :id="b.key"
        :key="b.key"
        class="gamcs-card overflow-hidden"
      >
        <header class="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 class="text-lg font-semibold text-ink-gray-9">{{ b.label }}</h2>
          <span
            class="gamcs-pill gamcs-num"
            :class="b.key === 'overdue' ? 'gamcs-pill-yellow' : 'gamcs-pill-soft'"
          >
            {{ count(b.key) }}
          </span>
        </header>
        <ul class="divide-y divide-outline-gray-1">
          <li
            v-for="row in data.data.buckets[b.key]"
            :key="row.doctype + row.name"
            class="flex items-center gap-3 px-5 py-3"
          >
            <span
              class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-gray-2"
              :title="kinds[row.doctype]"
            >
              <component
                :is="icons[row.doctype]"
                class="size-4 text-ink-gray-6"
              />
            </span>
            <router-link :to="routeFor(row)" class="min-w-0 flex-1">
              <div class="flex min-w-0 items-center gap-2">
                <span class="truncate text-base font-medium text-ink-gray-9">
                  {{ row.title }}
                </span>
                <span class="gamcs-pill gamcs-pill-gray hidden sm:inline-flex">
                  {{ row.status }}
                </span>
                <span
                  v-if="row.is_stale"
                  class="gamcs-pill gamcs-pill-red"
                  >{{ __('Stale') }}</span
                >
              </div>
              <div class="mt-0.5 truncate text-sm text-ink-gray-6">
                <template v-if="b.key === 'reconnect_due'">
                  {{ joinParts([__('Reconnect'), row.nurture_reason]) }}
                  ·
                  <span :class="dueClass(row.reconnect_date)">{{
                    dueText(row.reconnect_date)
                  }}</span>
                </template>
                <template v-else-if="row.next_action_date">
                  {{ joinParts([row.next_action_type, row.next_step]) }}
                  <template
                    v-if="joinParts([row.next_action_type, row.next_step])"
                    >·</template
                  >
                  <span :class="dueClass(row.next_action_date)">{{
                    dueText(row.next_action_date)
                  }}</span>
                </template>
                <template v-else>{{ __('No next action set') }}</template>
              </div>
            </router-link>
            <Tooltip
              v-if="row.owner_user"
              :text="getUser(row.owner_user).full_name"
            >
              <Avatar
                class="hidden sm:flex"
                size="md"
                shape="circle"
                :label="getUser(row.owner_user).full_name"
                :image="getUser(row.owner_user).user_image"
              />
            </Tooltip>
            <!-- GAMCS L3: WhatsApp / LinkedIn one-click logging per row -->
            <ChannelActions
              compact
              size="sm"
              :phone="recordWhatsApp(row)"
              :linkedin="row.linkedin"
              @log="(t) => openLog(row, t)"
            />
            <Button
              variant="subtle"
              :label="__('Log')"
              icon-left="lucide-plus"
              :aria-label="__('Log activity on {0}', [row.title])"
              @click="openLog(row)"
            />
          </li>
        </ul>
      </section>
    </div>
  </div>
  <QuickLog
    v-if="logTarget"
    v-model="showLog"
    :doctype="logTarget.doctype"
    :docname="logTarget.name"
    :defaults="logDefaults"
    @logged="data.reload()"
  />
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import QuickLog from '@/components/QuickLog.vue'
import ChannelActions from '@/components/ChannelActions.vue' // GAMCS L3
import { recordWhatsApp } from '@/utils/channels'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue'
import LucideHandshake from '~icons/lucide/handshake'
import { usersStore } from '@/stores/users'
import { daysFromToday, dueLabel, formatDay } from '@/utils/gamcs'
import { Avatar, Tooltip, createResource, usePageMeta } from 'frappe-ui'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const { getUser } = usersStore()
const route = useRoute()
const router = useRouter()
usePageMeta(() => ({ title: __('Follow-ups') }))

const icons = {
  'CRM Lead': LeadsIcon,
  'CRM Deal': DealsIcon,
  'GAMCS Relationship': LucideHandshake,
}
const kinds = {
  'CRM Lead': __('Lead'),
  'CRM Deal': __('Deal'),
  'GAMCS Relationship': __('Relationship'),
}
const bucketOrder = [
  { key: 'overdue', label: __('Overdue') },
  { key: 'today', label: __('Due today') },
  { key: 'needs_next_action', label: __('Needs next action') },
  { key: 'upcoming', label: __('Upcoming') },
  { key: 'reconnect_due', label: __('Reconnect due') },
]
const filters = [{ key: 'all', label: __('All') }, ...bucketOrder]

const todayLabel = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date())

const data = createResource({
  url: 'gamcs_crm.api.follow_ups.get_follow_ups',
  cache: 'gamcs-follow-ups',
  auto: true,
})

// the dashboard KPI cards link here with #overdue, #today, ...
const active = ref(
  bucketOrder.some((b) => '#' + b.key === route.hash)
    ? route.hash.slice(1)
    : 'all',
)
function select(key) {
  active.value = key
  router.replace({ hash: key === 'all' ? '' : '#' + key })
}

function count(key) {
  return data.data?.counts?.[key] ?? 0
}

const visibleBuckets = computed(() =>
  bucketOrder.filter(
    (b) =>
      (active.value === 'all' || active.value === b.key) &&
      data.data?.buckets?.[b.key]?.length,
  ),
)

function joinParts(parts) {
  return parts.filter(Boolean).join(' · ')
}
function dueText(date) {
  return `${dueLabel(date)} (${formatDay(date)})`
}
function dueClass(date) {
  const n = daysFromToday(date)
  return n !== null && n < 0 ? 'gamcs-overdue' : ''
}

function routeFor(row) {
  if (row.doctype === 'CRM Deal')
    return { name: 'Deal', params: { dealId: row.name } }
  if (row.doctype === 'GAMCS Relationship')
    return { name: 'Relationship', params: { relationshipId: row.name } }
  return { name: 'Lead', params: { leadId: row.name } }
}

const showLog = ref(false)
const logTarget = ref(null)
const logDefaults = ref({})
function openLog(row, type) {
  logTarget.value = row
  logDefaults.value = type ? { activity_type: type } : {}
  showLog.value = true
}
</script>
