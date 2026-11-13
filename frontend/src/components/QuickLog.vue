<!-- GAMCS F15: one-click activity logging with the next action set in the same dialog.
     Two short sections (what happened / what's next), Enter or ⌘/Ctrl+Enter saves,
     Cancel secondary, one primary button bottom right. -->
<template>
  <Dialog
    v-model:open="show"
    :title="__('Log activity')"
    :size="'xl'"
  >
    <template #default>
      <form
        class="flex flex-col gap-6"
        data-testid="quick-log"
        @submit.prevent="submit"
        @keydown.meta.enter.prevent="submit"
        @keydown.ctrl.enter.prevent="submit"
      >
        <fieldset class="flex flex-col gap-4">
          <legend class="mb-3 text-base font-semibold text-ink-gray-8">
            {{ __('What happened') }}
          </legend>
          <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="__('Type')">
            <button
              v-for="t in typeOptions"
              :key="t.value"
              type="button"
              role="radio"
              :aria-checked="form.activity_type === t.value"
              class="h-7 rounded-full px-3 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
              :class="
                form.activity_type === t.value
                  ? 'bg-surface-gray-10 text-ink-base'
                  : 'bg-surface-gray-2 text-ink-gray-7 hover:bg-surface-gray-3'
              "
              @click="form.activity_type = t.value"
            >
              {{ t.label }}
            </button>
          </div>
          <FormControl
            ref="subjectInput"
            type="text"
            :label="__('Subject')"
            v-model="form.subject"
            :placeholder="__('e.g. Connected with the CFO')"
          />
          <FormControl
            type="textarea"
            :label="__('Notes')"
            v-model="form.description"
            :placeholder="__('What was said, what was agreed')"
          />
          <FormControl
            type="text"
            :label="__('Outcome')"
            v-model="form.outcome"
            :placeholder="__('e.g. Interested, reconnect next week')"
          />
        </fieldset>

        <fieldset class="flex flex-col gap-4 rounded-2xl bg-[var(--gamcs-ice)] p-4">
          <legend class="sr-only">{{ __("What's next") }}</legend>
          <div class="text-base font-semibold text-ink-gray-8" aria-hidden="true">
            {{ __("What's next") }}
          </div>
          <FormControl
            type="text"
            :label="__('Next action')"
            v-model="form.next_step"
            :placeholder="__('e.g. Call to walk through the proposal')"
          />
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <DatePicker
                :label="__('When')"
                v-model="form.next_action_date"
                :placeholder="__('Pick a date')"
              />
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="q in quickDates"
                  :key="q.label"
                  type="button"
                  class="h-6 rounded-full bg-surface-base px-2.5 text-sm text-ink-gray-7 shadow-sm hover:bg-surface-gray-2"
                  @click="form.next_action_date = q.value"
                >
                  {{ q.label }}
                </button>
              </div>
            </div>
            <FormControl
              type="select"
              :label="__('Type')"
              v-model="form.next_action_type"
              :options="[{ label: __('Same as above'), value: '' }, ...typeOptions]"
            />
          </div>
          <Link
            :label="__('Owner')"
            doctype="User"
            v-model="form.next_action_owner"
            :placeholder="__('Owner')"
          />
        </fieldset>
        <ErrorMessage v-if="error" :message="error" />
        <!-- Enter in a single-line field submits -->
        <button type="submit" class="hidden" tabindex="-1" aria-hidden="true" />
      </form>
    </template>
    <template #actions>
      <div class="flex items-center justify-end gap-2">
        <Button :label="__('Cancel')" @click="show = false" />
        <Button
          variant="solid"
          :label="__('Log activity')"
          :loading="saving"
          @click="submit"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import Link from '@/components/Controls/Link.vue'
import { usersStore } from '@/stores/users'
import { dueLabel, formatDay } from '@/utils/gamcs'
import {
  createListResource,
  createResource,
  DatePicker,
  Dialog,
  FormControl,
  ErrorMessage,
  toast,
} from 'frappe-ui'
import { useStorage } from '@vueuse/core'
import { computed, nextTick, reactive, ref, watch } from 'vue'

const props = defineProps({
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
  defaults: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['logged'])
const show = defineModel({ type: Boolean })

const { getUser } = usersStore()
const subjectInput = ref(null)
const saving = ref(false)
const error = ref('')
const lastType = useStorage('gamcs-quicklog-type', 'Call')

const types = createListResource({
  doctype: 'GAMCS Activity Type',
  fields: ['name'],
  cache: 'gamcs-activity-types',
  auto: true,
})
const typeOptions = computed(() =>
  (types.data || []).map((t) => ({ label: t.name, value: t.name })),
)

function isoIn(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const quickDates = [
  { label: __('Tomorrow'), value: isoIn(1) },
  { label: __('In 3 days'), value: isoIn(3) },
  { label: __('Next week'), value: isoIn(7) },
  { label: __('In 2 weeks'), value: isoIn(14) },
]

function blank() {
  return {
    activity_type: lastType.value || 'Call',
    subject: '',
    description: '',
    outcome: '',
    next_step: '',
    next_action_date: isoIn(3),
    next_action_type: '',
    next_action_owner: getUser().name,
    ...props.defaults,
  }
}
const form = reactive(blank())

watch(show, (open) => {
  if (open) {
    Object.assign(form, blank())
    error.value = ''
    nextTick(() => subjectInput.value?.$el?.querySelector('input')?.focus())
  }
})

const log = createResource({ url: 'gamcs_crm.api.activity.log_activity' })

function submit() {
  if (saving.value) return
  error.value = ''
  saving.value = true
  lastType.value = form.activity_type
  log.submit(
    {
      reference_doctype: props.doctype,
      reference_docname: props.docname,
      ...form,
      next_action_type: form.next_action_type || form.activity_type,
    },
    {
      onSuccess() {
        saving.value = false
        show.value = false
        // peak-end: say what was saved and what happens next
        toast.success(
          form.next_action_date
            ? __('{0} logged. Next: {1}, {2}', [
                form.activity_type,
                form.next_step || form.next_action_type || form.activity_type,
                `${dueLabel(form.next_action_date).toLowerCase()} (${formatDay(form.next_action_date)})`,
              ])
            : __('{0} logged', [form.activity_type]),
        )
        emit('logged')
      },
      onError(err) {
        saving.value = false
        error.value = err.messages?.join('\n') || err.message
      },
    },
  )
}
</script>
