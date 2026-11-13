<template>
  <!-- GAMCS (UI_REVIEW W5): sentence case, outcome-named primary, success toast -->
  <Dialog v-model:open="show" :title="__('Mark as lost')" @close="cancel">
    <template #default>
      <div class="-mt-3 mb-4 text-p-base text-ink-gray-7">
        {{
          __('Why was this {0} lost? The reason feeds the lost-reasons report.', [
            doctype.toLowerCase().replace('crm ', ''),
          ])
        }}
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <div class="mb-2 text-sm text-ink-gray-5">
            {{ __('Reason') }}
            <span class="text-ink-red-4">*</span>
          </div>
          <Link
            ref="linkRef"
            class="form-control flex-1 truncate"
            :value="lostReason"
            doctype="CRM Lost Reason"
            :onCreate="onCreate"
            @change="(v) => (lostReason = v)"
          />
        </div>
        <div>
          <div class="mb-2 text-sm text-ink-gray-5">
            {{ lostReason == 'Other' ? __('What happened') : __('What happened (optional)') }}
            <span v-if="lostReason == 'Other'" class="text-ink-red-4">*</span>
          </div>
          <FormControl
            class="form-control flex-1 truncate"
            type="textarea"
            :value="lostNotes"
            @change="(e) => (lostNotes = e.target.value)"
          />
        </div>
      </div>
    </template>
    <template #actions>
      <div class="flex justify-between items-center gap-2">
        <div><ErrorMessage :message="error" /></div>
        <div class="flex gap-2">
          <Button :label="__('Cancel')" @click="cancel" />
          <Button variant="solid" :label="__('Mark as lost')" @click="save" />
        </div>
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import Link from '@/components/Controls/Link.vue'
import { createDocument } from '@/composables/document'
import { Dialog, toast } from 'frappe-ui'
import { ref } from 'vue'

const props = defineProps({
  doctype: { type: String, default: 'CRM Lead' },
  document: { type: Object, default: null },
})

const emit = defineEmits(['save', 'cancel'])

const show = defineModel({ type: Boolean })

const linkRef = ref(null)
const doc = props.document?.doc
const lostReason = ref(doc?.lost_reason || '')
const lostNotes = ref(doc?.lost_notes || '')
const error = ref('')

function cancel() {
  show.value = false
  error.value = ''
  lostReason.value = ''
  lostNotes.value = ''
  if (doc) {
    doc.status = props.document.originalDoc.status
  }
  emit('cancel')
}

function save() {
  if (!lostReason.value) {
    error.value = __('Pick a reason')
    return
  }
  if (lostReason.value === 'Other' && !lostNotes.value) {
    error.value = __('Say what happened when the reason is "Other"')
    return
  }

  error.value = ''
  show.value = false

  if (doc) {
    doc.lost_reason = lostReason.value
    doc.lost_notes = lostNotes.value
    props.document.save.submit(null, {
      onSuccess: () =>
        toast.success(
          __('Marked lost: {0}. It stays in the lost-reasons report.', [
            doc.lost_reason,
          ]),
        ),
    })
  }
  emit('save', { lost_reason: lostReason.value, lost_notes: lostNotes.value })
  lostReason.value = ''
  lostNotes.value = ''
}

function onCreate(value, close) {
  let doc = { lost_reason: value }
  createDocument('CRM Lost Reason', doc, close, (doc) => {
    lostReason.value = doc.name
    linkRef.value?.reload('', true)
  })
}
</script>
