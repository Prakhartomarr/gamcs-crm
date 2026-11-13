<!-- GAMCS E56/E57: the record's email and calendar tools in the side panel: Schedule meeting, the
     follow-up sequence (start, status, un-enrol) and a proposed nudge the owner sends with one click.
     Secondary buttons only: the page's one primary action stays in the header. -->
<template>
  <section class="flex flex-col gap-3 border-b px-5 py-4" data-testid="email-tools">
    <div class="flex flex-wrap gap-2">
      <Button
        :label="__('Schedule meeting')"
        icon-left="lucide-calendar-plus"
        data-testid="schedule-meeting"
        @click="openMeeting"
      />
      <Button
        v-if="!active"
        :label="__('Start sequence')"
        icon-left="lucide-mails"
        data-testid="start-sequence"
        @click="showEnrol = true"
      />
    </div>

    <div
      v-if="active"
      class="flex flex-col gap-2 rounded-2xl gamcs-tint p-3"
      data-testid="sequence-status"
    >
      <div class="text-base font-medium text-ink-gray-8">
        {{ __('In sequence: {0}', [enrolment.sequence]) }}
      </div>
      <div class="text-sm text-ink-gray-6">
        {{ __('{0} of {1} sent', [enrolment.sent, enrolment.steps]) }} ·
        <template v-if="!state.data.sending_enabled">
          {{ __('sending is switched off') }}
        </template>
        <template v-else-if="enrolment.waiting_reason">
          {{ enrolment.waiting_reason }}
        </template>
        <template v-else-if="enrolment.next_send_on">
          {{ __('next email {0}', [formatWhen(enrolment.next_send_on)]) }}
        </template>
      </div>
      <div>
        <Button
          variant="subtle"
          size="sm"
          :label="__('Un-enrol')"
          :loading="busy"
          data-testid="sequence-unenrol"
          @click="unenrol"
        />
      </div>
    </div>
    <div
      v-else-if="enrolment"
      class="text-sm text-ink-gray-6"
      data-testid="sequence-ended"
    >
      {{ endedText }}
    </div>

    <div
      v-if="nudge.data"
      class="flex flex-col gap-2 rounded-2xl gamcs-tint p-3"
      data-testid="nudge-card"
    >
      <div class="text-base font-medium text-ink-gray-8">
        {{ __('No reply since {0}', [formatWhen(nudge.data.last_sent_on)]) }}
      </div>
      <div class="text-sm text-ink-gray-6 truncate" :title="nudge.data.subject">
        {{ __('Nudge ready: {0}', [nudge.data.subject]) }}
      </div>
      <div class="flex gap-2">
        <Button
          variant="subtle"
          size="sm"
          :label="__('Send nudge')"
          :loading="busy"
          :disabled="!nudge.data.has_mailbox"
          :tooltip="nudge.data.has_mailbox ? '' : __('Connect your mailbox first')"
          data-testid="nudge-send"
          @click="sendNudge"
        />
        <Button variant="ghost" size="sm" :label="__('Dismiss')" @click="dismissNudge" />
      </div>
    </div>

    <SequenceEnrolModal
      v-if="state.data"
      v-model="showEnrol"
      :doctype="doctype"
      :docname="docname"
      :sequences="state.data.sequences"
      :recipient="recipient"
      :sendingEnabled="state.data.sending_enabled"
      @enrolled="(s) => (state.setData(s), emit('changed'))"
    />
    <ScheduleMeetingModal
      v-model="showMeeting"
      :doctype="doctype"
      :docname="docname"
      :title="title"
      :state="calendar.data || {}"
      @scheduled="emit('changed')"
    />
  </section>
</template>
<script setup>
import SequenceEnrolModal from '@/components/EmailTools/SequenceEnrolModal.vue'
import ScheduleMeetingModal from '@/components/EmailTools/ScheduleMeetingModal.vue'
import { call, createResource, dayjs, toast } from 'frappe-ui'
import { computed, ref, watch } from 'vue'

const props = defineProps({
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
  title: { type: String, default: '' },
  recipient: { type: String, default: '' },
})
const emit = defineEmits(['changed'])
const showEnrol = ref(false)
const showMeeting = ref(false)
const busy = ref(false)
const params = computed(() => ({ reference_doctype: props.doctype, reference_docname: props.docname }))

const state = createResource({ url: 'gamcs_crm.api.sequences.get_state', params: params.value, auto: true })
const nudge = createResource({ url: 'gamcs_crm.api.nudges.get_nudge', params: params.value, auto: true })
const calendar = createResource({ url: 'gamcs_crm.api.calendar.get_state', params: params.value })

watch(params, (p) => {
  state.update({ params: p })
  state.reload()
  nudge.update({ params: p })
  nudge.reload()
})

const enrolment = computed(() => state.data?.enrolment)
const active = computed(() => enrolment.value?.status === 'Active')
const endedText = computed(() => {
  const e = enrolment.value
  if (!e) return ''
  if (e.status === 'Completed') return __('Sequence {0} finished: all {1} emails sent.', [e.sequence, e.steps])
  const why = {
    Replied: __('they replied'),
    Closed: __('the record was closed'),
    'Un-enrolled': __('it was un-enrolled'),
    'No email': __('there was no email address'),
  }[e.stop_reason] || __('it was stopped')
  return __('Sequence {0} stopped because {1}.', [e.sequence, why])
})

function formatWhen(value) {
  if (!value) return ''
  const d = dayjs(value)
  return d.isSame(dayjs(), 'day') ? d.format('h:mm A') : d.format('ddd, D MMM')
}

async function openMeeting() {
  await calendar.reload()
  showMeeting.value = true
}

async function unenrol() {
  busy.value = true
  try {
    state.setData(await call('gamcs_crm.api.sequences.unenrol', params.value))
    toast.success(__('Un-enrolled. No more sequence emails go out.'))
    emit('changed')
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Could not un-enrol'))
  } finally {
    busy.value = false
  }
}

async function sendNudge() {
  busy.value = true
  try {
    await call('gamcs_crm.api.nudges.send_nudge', { name: nudge.data.name })
    toast.success(__('Nudge sent'))
    nudge.setData(null)
    emit('changed')
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Could not send the nudge'))
  } finally {
    busy.value = false
  }
}

async function dismissNudge() {
  await call('gamcs_crm.api.nudges.dismiss_nudge', { name: nudge.data.name })
  nudge.setData(null)
}
</script>
