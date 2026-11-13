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
          <span class="gamcs-pill" :class="tone[p.approval_status] || 'gamcs-pill-yellow'" data-testid="proposal-approval">
            <span class="opacity-75">{{ __('Approval') }}:</span>
            <span>{{ __(p.approval_status) }}</span>
          </span>
          <span class="gamcs-pill" :class="tone[p.client_status] || 'gamcs-pill-gray'" data-testid="proposal-client">
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
          <!-- GAMCS L3: e-signature state -->
          <a
            v-if="p.signed_document"
            :href="p.signed_document"
            target="_blank"
            class="inline-flex items-center gap-1 text-sm text-ink-blue-link hover:underline"
            data-testid="proposal-signed-pdf"
          >
            <span class="lucide-signature size-3.5" aria-hidden="true" />{{ __('Signed PDF') }}
          </a>
          <span
            v-if="p.signature?.status === 'Pending'"
            class="gamcs-pill gamcs-pill-yellow"
            data-testid="proposal-signature"
          >
            {{ __('Awaiting signature') }}
          </span>
          <span
            v-else-if="p.signature?.status === 'Signed'"
            class="gamcs-pill gamcs-pill-soft"
            data-testid="proposal-signature"
          >
            {{ __('Signed by {0}', [p.signature.signer_name]) }}
          </span>
        </div>
        <div class="flex flex-wrap gap-1">
          <Tooltip v-if="canGenerate(p)" :text="__('Generate the PDF from the GAMCS template')">
            <Button
              :label="p.document ? __('Regenerate PDF') : __('Generate PDF')"
              icon-left="lucide-file-down"
              :loading="generating === p.name"
              data-testid="proposal-generate"
              @click="generatePdf(p)"
            />
          </Tooltip>
          <Button
            v-if="canSign(p)"
            :label="p.signature?.status === 'Pending' ? __('New signing link') : __('Send for signature')"
            icon-left="lucide-signature"
            data-testid="proposal-send-signature"
            @click="openSign(p)"
          />
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

    <!-- GAMCS L3: send for signature; the link is shown once for the copy-link fallback -->
    <Dialog v-model:open="showSign" :title="__('Send V{0} for signature', [signTarget?.version])">
      <template #default>
        <div v-if="!signResult" class="flex flex-col gap-4" data-testid="sign-form">
          <p class="text-p-base text-ink-gray-7">
            {{ __('The client opens a single-use link, reads the PDF, types their full name and ticks consent. Signing marks this version Accepted and attaches a signed copy with a certificate page.') }}
          </p>
          <FormControl
            type="email"
            :label="__('Client email')"
            v-model="signEmail"
            :placeholder="__('Leave blank to use the primary contact')"
            :description="__('Without an outgoing email account you get a link to send yourself.')"
          />
          <ErrorMessage :message="signError" />
        </div>
        <div v-else class="flex flex-col gap-4" data-testid="sign-result">
          <p class="text-p-base text-ink-gray-8">
            {{
              signResult.emailed
                ? __('Emailed to {0}. You can also send the link yourself:', [signResult.signer_email])
                : __('No email was sent. Copy the link and send it to the client:')
            }}
          </p>
          <div class="flex items-center gap-2">
            <input
              readonly
              :value="signResult.link"
              class="h-8 min-w-0 flex-1 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-2 text-sm text-ink-gray-8"
              data-testid="sign-link"
              @focus="(e) => e.target.select()"
            />
            <Button :label="__('Copy link')" icon-left="lucide-copy" @click="copyLink" />
          </div>
          <p class="text-sm text-ink-gray-6">
            {{ __('The link works once and expires on {0}. Sending a new link withdraws this one.', [formatDay(signResult.expires_on)]) }}
          </p>
        </div>
      </template>
      <template #actions>
        <div class="flex justify-end gap-2">
          <template v-if="!signResult">
            <Button :label="__('Cancel')" @click="showSign = false" />
            <Button variant="solid" :label="__('Create signing link')" :loading="signing" @click="sendForSignature" />
          </template>
          <template v-else>
            <Button
              v-if="signResult.request"
              :label="__('Withdraw link')"
              theme="red"
              variant="subtle"
              @click="withdraw"
            />
            <Button variant="solid" :label="__('Done')" @click="showSign = false" />
          </template>
        </div>
      </template>
    </Dialog>

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
                  :disabled="saving"
                  @click="attachPdf(openFileSelector)"
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
        <div v-if="!form.name" class="mt-2 text-sm text-ink-gray-6">
          {{ __('Attaching the PDF saves this version first.') }}
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
import { nextTick, reactive, ref } from 'vue'

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

// GAMCS L3: generation and e-signature
const FROZEN = ['Sent', 'Under Discussion', 'Revised', 'Accepted', 'Rejected']
const canGenerate = (p) => !FROZEN.includes(p.client_status) || (isManager() && p.client_status !== 'Accepted')
const canSign = (p) => ['Sent', 'Under Discussion'].includes(p.client_status) && p.document
const generating = ref('')

async function generatePdf(p) {
  generating.value = p.name
  try {
    await call('gamcs_crm.api.esign.generate_pdf', { name: p.name })
    toast.success(__('V{0} PDF generated and attached. Next: get it approved and send it.', [p.version]))
    proposals.reload()
    emit('changed')
  } catch (e) {
    toast.error(e.messages?.[0] || e.message)
  } finally {
    generating.value = ''
  }
}

const showSign = ref(false)
const signTarget = ref(null)
const signEmail = ref('')
const signError = ref('')
const signing = ref(false)
const signResult = ref(null)

function openSign(p) {
  signTarget.value = p
  signEmail.value = p.signature?.signer_email || ''
  signError.value = ''
  signResult.value = null
  showSign.value = true
}

async function sendForSignature() {
  signing.value = true
  signError.value = ''
  try {
    signResult.value = await call('gamcs_crm.api.esign.send_for_signature', {
      proposal: signTarget.value.name,
      email: signEmail.value || undefined,
    })
    proposals.reload()
    emit('changed')
  } catch (e) {
    signError.value = e.messages?.[0] || e.message
  } finally {
    signing.value = false
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(signResult.value.link)
    toast.success(__('Link copied. It works once.'))
  } catch {
    toast.error(__('Select the link and copy it.'))
  }
}

async function withdraw() {
  try {
    await call('gamcs_crm.api.esign.revoke_request', { name: signResult.value.request })
    toast.success(__('Link withdrawn. The client can no longer sign with it.'))
    showSign.value = false
    proposals.reload()
  } catch (e) {
    toast.error(e.messages?.[0] || e.message)
  }
}

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

// GAMCS (UI_REVIEW P6): attaching a PDF to a new version saves it first, keeping the dialog open
async function attachPdf(openFileSelector) {
  if (!form.name) await save({ keepOpen: true })
  if (form.name) nextTick(() => openFileSelector())
}

async function save({ keepOpen = false } = {}) {
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
        __('V{0} saved at {1}.', [
          doc.version,
          money(doc.amount),
        ]),
      )
    }
    proposals.reload()
    emit('changed')
    if (!keepOpen) showForm.value = false
  } catch (e) {
    error.value = e.messages?.[0] || e.message
  } finally {
    saving.value = false
  }
}
</script>
