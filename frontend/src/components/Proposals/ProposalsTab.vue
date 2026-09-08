<!-- GAMCS F6: proposal versions on the deal, newest first; approval gates Sent (D9); Accepted writes the deal's commercials -->
<template>
  <div
    class="flex h-full flex-col overflow-y-auto px-3 pb-3 sm:px-10 sm:pb-5"
    data-testid="proposals-tab"
  >
    <div class="flex items-center justify-between py-4">
      <div class="text-lg-medium text-ink-gray-9">{{ __('Proposals') }}</div>
      <div class="flex gap-2">
        <Button
          v-if="proposals.data?.length"
          :label="__('Revise latest')"
          icon-left="copy"
          @click="reviseLatest"
        />
        <Button
          variant="solid"
          :label="__('New proposal')"
          icon-left="plus"
          @click="openForm()"
        />
      </div>
    </div>
    <div
      v-if="proposals.data && !proposals.data.length"
      class="text-base text-ink-gray-5"
    >
      {{ __('No proposals yet. Amounts are exclusive of tax.') }}
    </div>
    <div
      v-for="p in proposals.data"
      :key="p.name"
      class="flex flex-wrap items-center gap-3 border-b py-3 text-base"
      :data-testid="`proposal-v${p.version}`"
    >
      <div class="w-8 font-medium text-ink-gray-9">V{{ p.version }}</div>
      <div class="w-32 text-ink-gray-9" data-testid="proposal-amount">
        {{ money(p.amount) }}
      </div>
      <div class="w-24 text-ink-gray-5">{{ p.proposal_date }}</div>
      <Badge
        :label="p.approval_status"
        variant="subtle"
        :theme="{ Approved: 'green', Rejected: 'red' }[p.approval_status] || 'orange'"
      />
      <Badge
        :label="p.client_status"
        variant="subtle"
        :theme="
          { Accepted: 'green', Rejected: 'red', Sent: 'blue', 'Under Discussion': 'blue' }[
            p.client_status
          ] || 'gray'
        "
      />
      <a
        v-if="p.document"
        :href="p.document"
        target="_blank"
        class="text-sm text-ink-blue-6 underline"
        >{{ __('Document') }}</a
      >
      <div class="ml-auto flex gap-1">
        <Dropdown v-if="isManager()" :options="approvalOptions(p)">
          <Button :label="__('Approval')" icon-right="chevron-down" />
        </Dropdown>
        <Dropdown :options="clientOptions(p)">
          <Button :label="__('Client status')" icon-right="chevron-down" />
        </Dropdown>
        <Button variant="ghost" icon="edit" @click="openForm(p)" />
      </div>
    </div>

    <Dialog
      v-model:open="showForm"
      :title="form.name ? __('Proposal V{0}', [form.version]) : __('New proposal')"
    >
      <template #default>
        <div class="grid grid-cols-2 gap-3" data-testid="proposal-form">
          <FormControl
            type="number"
            :label="__('Amount (excl. tax)')"
            v-model="form.amount"
            :disabled="form.approval_status === 'Approved'"
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
                  icon-left="upload"
                  :loading="uploading"
                  :disabled="!form.name"
                  @click="openFileSelector"
                />
              </template>
            </FileUploader>
          </div>
          <FormControl
            class="col-span-2"
            type="textarea"
            :label="__('Scope')"
            v-model="form.scope"
          />
          <FormControl
            class="col-span-2"
            type="textarea"
            :label="__('Notes')"
            v-model="form.notes"
          />
        </div>
        <div v-if="!form.name" class="mt-2 text-sm text-ink-gray-5">
          {{ __('Save first, then upload the PDF.') }}
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
import { reactive, ref } from 'vue'

const props = defineProps({
  deal: { type: String, required: true },
  currency: { type: String, default: 'INR' },
})
const emit = defineEmits(['changed'])
const { isManager } = usersStore()

const proposals = createResource({
  url: 'gamcs_crm.api.proposal.get_proposals',
  params: { deal: props.deal },
  cache: ['gamcs-proposals', props.deal],
  auto: true,
})

function money(v) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: props.currency || 'INR',
    maximumFractionDigits: 0,
  }).format(v || 0)
}

async function apply(name, values) {
  try {
    await call('gamcs_crm.api.proposal.update_proposal', { name, values })
    proposals.reload()
    emit('changed')
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
