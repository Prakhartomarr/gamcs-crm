<!-- GAMCS F15: one-click activity logging with the next action set in the same dialog -->
<template>
  <Dialog v-model:open="show" :size="'xl'">
    <template #body>
      <div
        class="bg-surface-elevation-1 px-4 pb-6 pt-5 sm:px-6"
        @keydown.meta.enter="submit"
        @keydown.ctrl.enter="submit"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-3xl-semibold leading-6 text-ink-gray-9">
            {{ __('Log activity') }}
          </h3>
          <Button
            variant="ghost"
            class="w-7"
            icon="lucide-x"
            @click="show = false"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <FormControl
            ref="typeInput"
            type="select"
            :label="__('Type')"
            v-model="form.activity_type"
            :options="typeOptions"
          />
          <FormControl
            type="text"
            :label="__('Subject')"
            v-model="form.subject"
            :placeholder="__('Connected with the CFO')"
          />
          <div class="col-span-2">
            <FormControl
              type="textarea"
              :label="__('Notes')"
              v-model="form.description"
              :placeholder="__('What was said, what was agreed')"
            />
          </div>
          <FormControl
            type="text"
            :label="__('Outcome')"
            v-model="form.outcome"
            :placeholder="__('Interested, reconnect next week')"
          />
          <div />
          <div
            class="col-span-2 border-t pt-3 text-base font-medium text-ink-gray-7"
          >
            {{ __('Next action') }}
          </div>
          <FormControl
            type="text"
            :label="__('Next action')"
            v-model="form.next_step"
            :placeholder="__('Call to walk through the proposal')"
          />
          <DatePicker
            :label="__('Next action date')"
            v-model="form.next_action_date"
            :placeholder="__('Pick a date')"
          />
          <FormControl
            type="select"
            :label="__('Next action type')"
            v-model="form.next_action_type"
            :options="typeOptions"
          />
          <Link
            :label="__('Next action owner')"
            doctype="User"
            v-model="form.next_action_owner"
            :placeholder="__('Owner')"
          />
        </div>
        <ErrorMessage v-if="error" class="mt-3" :message="error" />
      </div>
      <div class="flex flex-row-reverse gap-2 px-4 pb-6 sm:px-6">
        <Button
          variant="solid"
          :label="__('Log') + ' (⌘⏎)'"
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
import {
  createListResource,
  createResource,
  DatePicker,
  FormControl,
  ErrorMessage,
  toast,
} from 'frappe-ui'
import { computed, nextTick, reactive, ref, watch } from 'vue'

const props = defineProps({
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
  defaults: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['logged'])
const show = defineModel({ type: Boolean })

const { getUser } = usersStore()
const typeInput = ref(null)
const saving = ref(false)
const error = ref('')

const types = createListResource({
  doctype: 'GAMCS Activity Type',
  fields: ['name'],
  cache: 'gamcs-activity-types',
  auto: true,
})
const typeOptions = computed(() =>
  (types.data || []).map((t) => ({ label: t.name, value: t.name })),
)

function blank() {
  return {
    activity_type: 'LinkedIn',
    subject: '',
    description: '',
    outcome: '',
    next_step: '',
    next_action_date: '',
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
    nextTick(() => typeInput.value?.$el?.querySelector('select')?.focus())
  }
})

const log = createResource({ url: 'gamcs_crm.api.activity.log_activity' })

function submit() {
  if (saving.value) return
  error.value = ''
  saving.value = true
  log.submit(
    {
      reference_doctype: props.doctype,
      reference_docname: props.docname,
      ...form,
    },
    {
      onSuccess() {
        saving.value = false
        show.value = false
        toast.success(__('Activity logged'))
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
