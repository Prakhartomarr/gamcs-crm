<!-- GAMCS E56: enrol this lead or opportunity in a follow-up sequence. One choice, one primary button. -->
<template>
  <Dialog v-model:open="show" :title="__('Start a follow-up sequence')" :size="'lg'">
    <template #default>
      <div class="flex flex-col gap-4" data-testid="sequence-dialog">
        <p class="text-p-base text-ink-gray-6">
          {{
            __(
              'Emails go from the owner’s mailbox to {0}. Sending stops when they reply, when the record is won or lost, or when you un-enrol.',
              [recipient || __('the contact')],
            )
          }}
        </p>
        <div v-if="!sequences.length" class="rounded-2xl gamcs-tint p-4 text-base text-ink-gray-7">
          {{ __('No sequences yet. An admin can add one in the desk under GAMCS Email Sequence.') }}
        </div>
        <div v-else class="flex flex-col gap-2" role="radiogroup" :aria-label="__('Sequence')">
          <button
            v-for="s in sequences"
            :key="s.name"
            type="button"
            role="radio"
            :aria-checked="chosen === s.name"
            :data-testid="`sequence-option-${s.name}`"
            class="flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
            :class="chosen === s.name ? 'border-outline-gray-4 bg-surface-gray-2' : 'border-outline-gray-1 hover:bg-surface-gray-1'"
            @click="chosen = s.name"
          >
            <span class="text-base font-medium text-ink-gray-8">{{ s.name }}</span>
            <span class="text-sm text-ink-gray-6">
              {{ s.steps == 1 ? __('1 email') : __('{0} emails', [s.steps]) }}<template v-if="s.description"> · {{ s.description }}</template>
            </span>
          </button>
        </div>
        <p v-if="!sendingEnabled" class="text-sm text-ink-gray-6">
          {{ __('Sending is switched off for now, so nothing goes out until an admin turns sequences on.') }}
        </p>
      </div>
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button :label="__('Cancel')" @click="show = false" />
        <Button
          variant="solid"
          :label="__('Enrol')"
          :loading="saving"
          :disabled="!chosen"
          data-testid="sequence-enrol"
          @click="enrol"
        />
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import { Dialog, call, toast } from 'frappe-ui'
import { ref, watch } from 'vue'

const props = defineProps({
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
  sequences: { type: Array, default: () => [] },
  recipient: { type: String, default: '' },
  sendingEnabled: { type: Boolean, default: false },
})
const emit = defineEmits(['enrolled'])
const show = defineModel({ type: Boolean })
const chosen = ref('')
const saving = ref(false)

watch(show, (open) => {
  if (open) chosen.value = props.sequences.length === 1 ? props.sequences[0].name : ''
})

async function enrol() {
  saving.value = true
  try {
    const state = await call('gamcs_crm.api.sequences.enrol', {
      reference_doctype: props.doctype,
      reference_docname: props.docname,
      sequence: chosen.value,
    })
    toast.success(__('Enrolled in {0}', [chosen.value]))
    show.value = false
    emit('enrolled', state)
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Could not enrol this record'))
  } finally {
    saving.value = false
  }
}
</script>
