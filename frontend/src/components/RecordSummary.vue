<!-- GAMCS: header card on a lead or deal. Where the record is in the pipeline (a pill track,
     each step clickable) and the next action, highlighted, with the one-click Log. -->
<template>
  <div
    class="flex flex-col gap-4 px-5 pt-4 lg:flex-row lg:items-stretch"
    data-testid="record-summary"
  >
    <div class="gamcs-card flex min-w-0 flex-1 flex-col justify-between gap-3 p-4">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div class="flex items-baseline gap-2">
          <span class="text-sm text-ink-gray-6">{{ __('Stage') }}</span>
          <span class="text-lg font-semibold text-ink-gray-9">{{ __(status) }}</span>
          <span v-if="sideState" class="gamcs-pill gamcs-pill-gray">{{ sideState }}</span>
        </div>
        <span v-if="position >= 0" class="text-sm text-ink-gray-6">
          {{ __('Step {0} of {1}', [position + 1, track.length]) }}
        </span>
      </div>
      <ol class="flex gap-1" :aria-label="__('Pipeline stages')">
        <li v-for="(step, i) in track" :key="step.value" class="flex-1">
          <Tooltip :text="step.label">
            <button
              type="button"
              class="block h-2 w-full rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 disabled:cursor-default"
              :class="
                i === position
                  ? 'bg-[var(--gamcs-yellow)]'
                  : position >= 0 && i < position
                    ? 'bg-[var(--gamcs-navy)]'
                    : 'bg-surface-gray-3 hover:bg-surface-gray-4'
              "
              :aria-label="__('Move to {0}', [step.label])"
              :aria-current="i === position ? 'step' : undefined"
              :disabled="i === position || step.locked"
              @click="step.onClick?.()"
            />
          </Tooltip>
        </li>
      </ol>
      <div v-if="facts.length" class="flex flex-wrap gap-x-6 gap-y-1">
        <div v-for="f in facts" :key="f.label" class="text-sm">
          <span class="text-ink-gray-6">{{ f.label }}</span>
          <span class="gamcs-num ml-1.5 font-semibold text-ink-gray-9">{{ f.value }}</span>
        </div>
      </div>
    </div>

    <div
      class="gamcs-card gamcs-next-action flex flex-col justify-between gap-3 p-4 lg:w-80"
      data-testid="next-action-card"
    >
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-ink-gray-7">{{ __('Next action') }}</span>
          <span
            v-if="nextActionDate"
            class="gamcs-pill"
            :class="overdue ? 'gamcs-pill-yellow' : 'gamcs-pill-soft'"
          >
            {{ dueLabel(nextActionDate) }}
          </span>
        </div>
        <div class="line-clamp-2 text-base font-semibold text-ink-gray-9">
          {{ nextActionText || (nextActionDate ? __('Follow up') : __('No next action yet')) }}
        </div>
        <div v-if="nextActionDate" class="text-sm text-ink-gray-6">
          {{ formatDay(nextActionDate) }}
          <template v-if="ownerName"> · {{ ownerName }}</template>
        </div>
      </div>
      <Button
        :label="__('Log activity')"
        icon-left="lucide-plus"
        class="self-start"
        @click="emit('log')"
      />
    </div>
  </div>
</template>

<script setup>
import { usersStore } from '@/stores/users'
import { daysFromToday, dueLabel, formatDay } from '@/utils/gamcs'
import { Tooltip } from 'frappe-ui'
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: '' },
  // statusOptions() output: [{ label, value, onClick }]
  options: { type: Array, default: () => [] },
  // name -> { type } from the statuses store
  getStatus: { type: Function, required: true },
  nextActionType: { type: String, default: '' },
  nextStep: { type: String, default: '' },
  nextActionDate: { type: String, default: '' },
  nextActionOwner: { type: String, default: '' },
  // statuses of these types are reached by their own flow (e.g. Convert), not the track
  lockedTypes: { type: Array, default: () => [] },
  facts: { type: Array, default: () => [] },
})
const emit = defineEmits(['log'])
const { getUser } = usersStore()

const OFF_TRACK = ['Lost', 'On Hold']
const track = computed(() =>
  props.options
    .filter((o) => !OFF_TRACK.includes(props.getStatus(o.value)?.type))
    .map((o) => ({
      ...o,
      locked: props.lockedTypes.includes(props.getStatus(o.value)?.type),
    })),
)
const position = computed(() =>
  track.value.findIndex((s) => s.value === props.status),
)
const sideState = computed(() => {
  const type = props.getStatus(props.status)?.type
  if (type === 'Lost') return __('Closed, not won')
  if (type === 'On Hold') return __('On hold')
  return ''
})

const nextActionText = computed(() =>
  [props.nextActionType, props.nextStep].filter(Boolean).join(' · '),
)
const overdue = computed(() => (daysFromToday(props.nextActionDate) ?? 0) < 0)
const ownerName = computed(() =>
  props.nextActionOwner ? getUser(props.nextActionOwner)?.full_name : '',
)
</script>
