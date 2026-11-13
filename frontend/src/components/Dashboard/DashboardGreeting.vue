<!-- GAMCS: dashboard opener. Greeting, today's date and what needs doing, then the
     follow-up queue as a row of KPI cards (overdue is the one highlighted card). -->
<template>
  <section class="flex flex-col gap-6" data-testid="dashboard-greeting">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1">
        <div class="text-base text-ink-gray-5">{{ today }}</div>
        <h1 class="text-2xl leading-tight text-ink-gray-9 sm:text-3xl">
          <span class="gamcs-title-light">{{ greeting + ', ' }}</span>
          <span class="font-semibold">{{ firstName }}</span>
        </h1>
        <p class="text-p-base text-ink-gray-6">{{ summary }}</p>
      </div>
      <slot name="filters" />
    </div>

    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <router-link
        v-for="card in cards"
        :key="card.key"
        :to="{ name: 'FollowUps', hash: '#' + card.key }"
        class="gamcs-card flex flex-col justify-between gap-3 p-4 transition-shadow sm:p-5 focus-visible:ring-2 focus-visible:ring-outline-gray-3"
        :class="card.highlight ? 'gamcs-kpi-highlight' : ''"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="min-w-0 text-base font-medium leading-snug text-ink-gray-7">
            {{ card.label }}
          </span>
          <span
            class="gamcs-pill hidden shrink-0 lg:inline-flex"
            :class="card.highlight ? 'gamcs-pill-dark' : 'gamcs-pill-soft'"
          >
            {{ card.hint }}
          </span>
        </div>
        <div class="gamcs-num text-3xl font-semibold text-ink-gray-9">
          {{ counts ? counts[card.key] : '–' }}
        </div>
      </router-link>
    </div>
  </section>
</template>

<script setup>
import { usersStore } from '@/stores/users'
import { createResource } from 'frappe-ui'
import { computed } from 'vue'

const { getUser } = usersStore()

const followUps = createResource({
  url: 'gamcs_crm.api.follow_ups.get_follow_ups',
  params: { counts_only: 1 },
  cache: 'gamcs-follow-up-counts',
  auto: true,
})
const counts = computed(() => followUps.data?.counts)

const now = new Date()
const hour = now.getHours()
const greeting =
  hour < 12
    ? __('Good morning')
    : hour < 17
      ? __('Good afternoon')
      : __('Good evening')
const today = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(now)
const firstName = computed(
  () => (getUser().full_name || '').split(' ')[0] || __('there'),
)

const summary = computed(() => {
  const c = counts.value
  if (!c) return ' '
  const parts = []
  if (c.today) parts.push(__('{0} follow-ups due today', [c.today]))
  if (c.overdue) parts.push(__('{0} overdue', [c.overdue]))
  if (c.needs_next_action)
    parts.push(__('{0} without a next action', [c.needs_next_action]))
  return parts.length
    ? parts.join(', ') + '.'
    : __('You are all caught up. Nothing is due today.')
})

const cards = [
  { key: 'overdue', label: __('Overdue'), hint: __('Act now'), highlight: true },
  { key: 'today', label: __('Due today'), hint: __('Today') },
  { key: 'needs_next_action', label: __('Needs next action'), hint: __('Set one') },
  { key: 'upcoming', label: __('Upcoming'), hint: __('Coming up') },
]
</script>
