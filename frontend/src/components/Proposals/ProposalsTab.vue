<!-- GAMCS F6: proposal versions on the deal, newest first; approval gates Sent (D9); Accepted writes the deal's commercials -->
<template>
  <div
    class="flex h-full flex-col overflow-y-auto px-3 pb-3 sm:px-10 sm:pb-5"
    data-testid="proposals-tab"
  >
    <div class="flex flex-wrap items-center justify-between gap-2 py-4">
      <div class="text-lg-medium text-ink-gray-9">{{ __('Proposals') }}</div>
      <div class="flex gap-2">
        <Button
          v-if="proposals.data?.length"
          :label="__('Revise latest')"
          icon-left="lucide-copy"
          @click="reviseLatest"
        />
        <Button
          variant="solid"
          :label="__('New proposal')"
          icon-left="lucide-plus"
          @click="openForm()"
        />
      </div>
    </div>
    <div
      v-if="proposals.data && !proposals.data.length"
      class="flex flex-col items-start gap-1 rounded-2xl bg-surface-gray-1 p-5"
    >
      <div class="text-base font-medium text-ink-gray-8">
        {{ __('No proposals yet') }}
      </div>
      <div class="text-p-base text-ink-gray-6">
        {{ __('Create the first version here. Amounts are exclusive of tax; a manager approves a version before it is sent.') }}
      </div>
    </div>
    <div class="flex flex-col gap-3">
      <div
        v-for="p in proposals.data"
        :key="p.name"
        class="flex flex-col gap-3 rounded-2xl border border-outline-gray-1 p-4 text-base sm:flex-row sm:items-center"
        :data-testid="`proposal-v${p.version}`"
      >
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
          <span class="gamcs-pill gamcs-pill-soft font-semibold">V{{ p.version }}</span>
          <span
            class="gamcs-num text-lg font-semibold text-ink-gray-9"
            data-testid="proposal-amount"
            >{{ money(p.amount) }}</span
          >
          <span class="text-ink-gray-6">{{ formatDay(p.proposal_date) }}</span>
          <span class="gamcs-pill" :class="tone[p.approval_status] || 'gamcs-pill-yellow'">
            <span class="opacity-75">{{ __('Approval') }}:</span>
            <span>{{ __(p.approval_status) }}</span>
          </span>
          <span class="gamcs-pill" :class="tone[p.client_status] || 'gamcs-pill-gray'">
            <span class="opacity-75">{{ __('Client') }}:</span>
            <span>{{ __(p.client_status) }}</span>
          </span>
          <a
            v-if="p.document"
            :href="p.document"
            target="_blank"
            class="inline-flex items-center gap-1 text-sm text-ink-blue-link hover:underline"
          >
            <span class="lucide-file-text size-3.5" aria-hidden="true" />{{ __('PDF') }}
          </a>
        </div>
        <div class="flex gap-1">
          <Dropdown v-if="isManager()" :options="approvalOptions(p)">
            <Button :label="__('Approval')" icon-right="lucide-chevron-down" />
          </Dropdown>
          <Dropdown :options="clientOptions(p)">
            <Button :label="__('Client status')" icon-right="lucide-chevron-down" />
          </Dropdown>
          <Tooltip :text="__('Edit V{0}', [p.version])">
            <Button
              variant="ghost"
              icon="lucide-pencil"
              :aria-label="__('Edit V{0}', [p.version])"
              @click="openForm(p)"
            />
          </Tooltip>
        </div>
      </div>
    </div>

    <Dialog
      v-model:open="showForm"
      :title="form.name ? __('Proposal V{0}', [form.version]) : __('New proposal')"
    >
      <template #default>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="proposal-form">
          <FormControl
            type="number"
            :label="__('Amount (excl. tax)')"
            v-model="form.amount"
            :disabled="form.approval_status === 'Approved'"
            :description="form.amount ? money(form.amount) : ''"
            data-testid="proposal-amount-input"
          />
          <DatePicker
            :label="__('Proposal date')"
            v-model="form.proposal_date"
            :placeholder="__('Pick a date')"
          />
          <FormControl
            type="number"
            :label="__('Validity (days)')"
            v-model="form.validity_days"
          />
          <div class="flex items-end">
            <FileUploader
              :upload-args="{
                doctype: 'GAMCS Proposal',
                docname: form.name,
                private: true,
              }"
              :fileTypes="['.pdf']"
              @success="(f) => (form.document = f.file_url)"
            >
              <template #default="{ openFileSelector, uploading }">
                <Button
                  :label="form.document ? __('Replace PDF') : __('Upload PDF')"
                  icon-left="lucide-upload"
                  :loading="uploading"
                  :disabled="!form.name"
                  @click="openFileSelector"
                />
              </template>
            </FileUploader>
          </div>
          <FormControl
            class="sm:col-span-2"
            type="textarea"
            :label="__('Scope')"
            v-model="form.scope"
          />
          <FormControl
            class="sm:col-span-2"
            type="textarea"
            :label="__('Notes')"
            v-model="form.notes"
          />
        </div>
        <div v-if="!form.name" class="mt-2 text-sm text-ink-gray-5">
          {{ __('You can attach the PDF once this version is saved.') }}
        </div>
        <ErrorMessage class="mt-2" :message="error" />
      </template>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button :label="__('Cancel')" @click="showForm = false" />
          <Button
            variant="solid"
            :label="__('Save')"
            :loading="saving"
            @click="save"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>
<script setup>
import { usersStore } from '@/stores/users'
import {
  Dialog,
  DatePicker,
  Dropdown,
  FileUploader,
  FormControl,
  ErrorMessage,
  createResource,
  call,
  toast,
} from 'frappe-ui'
import { formatDay, formatMoney } from '@/utils/gamcs'
import { Tooltip } from 'frappe-ui'
import { reactive, ref } from 'vue'

// pill colours; amber/yellow means "waiting on someone"
const tone = {
  Approved: 'gamcs-pill-soft',
  Accepted: 'gamcs-pill-soft',
  Sent: 'gamcs-pill-soft',
  'Under Discussion': 'gamcs-pill-soft',
  Rejected: 'gamcs-pill-red',
  Revised: 'gamcs-pill-gray',
  Draft: 'gamcs-pill-gray',
  'Not Required': 'gamcs-pill-gray',
  Pending: 'gamcs-pill-yellow',
}

const props = defineProps({
  deal: { type: String, required: true },
  currency: { type: String, default: 'INR' },
})
const emit = defineEmits(['changed', 'accepted'])
const { isManager } = usersStore()

const proposals = createResource({
  url: 'gamcs_crm.api.proposal.get_proposals',
  params: { deal: props.deal },
  cache: ['gamcs-proposals', props.deal],
  auto: true,
})

function money(v) {
  return formatMoney(v, props.currency)
}

// peak-end: every status change says what it means and what comes next
function outcome(p, values) {
  const v = p?.version ?? ''
  if (values.approval_status === 'Approved')
    return __('V{0} approved. It can now be sent to the client.', [v])
  if (values.approval_status === 'Rejected')
    return __('V{0} sent back. Revise it and ask again.', [v])
  if (values.client_status === 'Sent')
    return __('V{0} sent. Log the follow-up so it shows in your queue.', [v])
  if (values.client_status === 'Accepted')
    return __('V{0} accepted at {1}. Next: line the billing terms up with it.', [v, money(p?.amount)])
  const status = values.client_status || values.approval_status
  return __('V{0}: {1}', [v, status])
}

async function apply(name, values) {
  try {
    await call('gamcs_crm.api.proposal.update_proposal', { name, values })
    const p = proposals.data?.find((x) => x.name === name)
    toast.success(outcome(p, values))
    proposals.reload()
    emit('changed')
    if (values.client_status === 'Accepted') emit('accepted', name) // D42
  } catch (e) {
    toast.error(e.messages?.[0] || e.message)
  }
}

const approvalOptions = (p) =>
  ['Approved', 'Rejected', 'Pending']
    .filter((s) => s !== p.approval_status)
    .map((s) => ({ label: s, onClick: () => apply(p.name, { approval_status: s }) }))

const clientOptions = (p) =>
  ['Draft', 'Sent', 'Under Discussion', 'Accepted', 'Rejected', 'Not Required']
    .filter((s) => s !== p.client_status)
    .map((s) => ({ label: s, onClick: () => apply(p.name, { client_status: s }) }))

async function reviseLatest() {
  try {
    const latest = proposals.data[0]
    const doc = await call('gamcs_crm.api.proposal.revise', { name: latest.name })
    proposals.reload()
    emit('changed')
    openForm(doc)
  } catch (e) {
    toast.error(e.messages?.[0] || e.message)
  }
}

const showForm = ref(false)
const form = reactive({})
const error = ref('')
const saving = ref(false)

function openForm(p = null) {
  Object.keys(form).forEach((k) => delete form[k])
  Object.assign(
    form,
    p || { proposal_date: new Date().toISOString().slice(0, 10), validity_days: 30 },
  )
  error.value = ''
  showForm.value = true
}

async function save() {
  error.value = ''
  saving.value = true
  const values = {
    amount: form.amount,
    proposal_date: form.proposal_date,
    validity_days: form.validity_days,
    scope: form.scope,
    notes: form.notes,
    document: form.document,
  }
  try {
    if (form.name) {
      await call('gamcs_crm.api.proposal.update_proposal', { name: form.name, values })
    } else {
      const doc = await call('gamcs_crm.api.proposal.create_proposal', {
        deal: props.deal,
        values,
      })
      Object.assign(form, doc)
      toast.success(
        __('V{0} saved at {1}. Open it again to attach the PDF.', [
          doc.version,
          money(doc.amount),
        ]),
      )
    }
    proposals.reload()
    emit('changed')
    showForm.value = false
  } catch (e) {
    error.value = e.messages?.[0] || e.message
  } finally {
    saving.value = false
  }
}
</script>
