<!-- GAMCS E57: create an Outlook event (Teams link when on) from the record; logs a Meeting and moves the
     next action to the meeting day. -->
<template>
  <Dialog v-model:open="show" :title="__('Schedule meeting')" :size="'xl'">
    <template #default>
      <div class="flex flex-col gap-4" data-testid="meeting-dialog">
        <div v-if="!state.enabled" class="rounded-2xl gamcs-tint p-4 text-base text-ink-gray-7" data-testid="meeting-off">
          {{ __('The Outlook calendar is not switched on yet. An admin turns it on in GAMCS Email Settings once Microsoft 365 is connected.') }}
        </div>
        <div v-else-if="!state.connected" class="flex flex-col items-start gap-3 rounded-2xl gamcs-tint p-4">
          <p class="text-base text-ink-gray-7">
            {{ __('Connect your Outlook calendar once, and meetings go straight onto it.') }}
          </p>
          <Button :label="__('Connect Outlook calendar')" icon-left="lucide-link" @click="connect" />
        </div>
        <template v-else>
          <FormControl
            type="text"
            :label="__('Subject')"
            v-model="form.subject"
            data-testid="meeting-subject"
          />
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormControl type="date" :label="__('Date')" v-model="form.date" data-testid="meeting-date" />
            <FormControl type="time" :label="__('Starts')" v-model="form.time" data-testid="meeting-time" />
            <FormControl
              type="select"
              :label="__('Length')"
              v-model="form.minutes"
              :options="lengths"
            />
          </div>
          <FormControl
            type="text"
            :label="__('Attendees')"
            v-model="form.attendees"
            :placeholder="__('name@client.com, another@client.com')"
            :description="__('Separate addresses with commas.')"
            data-testid="meeting-attendees"
          />
          <FormControl
            type="textarea"
            :label="__('Agenda')"
            v-model="form.body"
            :placeholder="__('Optional, goes into the invitation')"
          />
          <FormControl
            v-if="state.teams"
            type="checkbox"
            :label="__('Add a Teams link')"
            v-model="form.teams"
          />
        </template>
      </div>
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button :label="__('Cancel')" @click="show = false" />
        <Button
          v-if="state.enabled && state.connected"
          variant="solid"
          :label="__('Schedule')"
          :loading="saving"
          :disabled="!valid"
          data-testid="meeting-submit"
          @click="submit"
        />
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import { Dialog, FormControl, call, dayjs, toast } from 'frappe-ui'
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
  title: { type: String, default: '' },
  state: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['scheduled'])
const show = defineModel({ type: Boolean })
const saving = ref(false)
const lengths = [
  { label: __('30 minutes'), value: '30' },
  { label: __('45 minutes'), value: '45' },
  { label: __('1 hour'), value: '60' },
  { label: __('90 minutes'), value: '90' },
]
const form = reactive({ subject: '', date: '', time: '11:00', minutes: '30', attendees: '', body: '', teams: true })

watch(show, (open) => {
  if (!open) return
  form.subject = props.title ? __('Discovery call: {0}', [props.title]) : __('Discovery call')
  form.date = dayjs().add(2, 'day').format('YYYY-MM-DD')
  form.time = '11:00'
  form.minutes = '30'
  form.attendees = props.state.default_attendee || ''
  form.body = ''
  form.teams = !!props.state.teams
})

const valid = computed(() => form.subject && form.date && form.time && form.attendees.trim())

async function connect() {
  try {
    window.location.href = await call('gamcs_crm.api.connections.connect', { kind: 'calendar' })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Could not start the Microsoft sign-in'))
  }
}

async function submit() {
  saving.value = true
  const start = dayjs(`${form.date} ${form.time}`)
  try {
    const out = await call('gamcs_crm.api.calendar.schedule_meeting', {
      reference_doctype: props.doctype,
      reference_docname: props.docname,
      subject: form.subject,
      starts_on: start.format('YYYY-MM-DD HH:mm:ss'),
      ends_on: start.add(Number(form.minutes), 'minute').format('YYYY-MM-DD HH:mm:ss'),
      attendees: JSON.stringify(form.attendees.split(',').map((a) => a.trim()).filter(Boolean)),
      body: form.body,
      teams: form.teams ? 1 : 0,
    })
    toast.success(__('Meeting on {0} is in your Outlook calendar', [start.format('ddd, D MMM, h:mm A')]))
    show.value = false
    emit('scheduled', out)
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Could not schedule the meeting'))
  } finally {
    saving.value = false
  }
}
</script>
