<!-- GAMCS F7: Won needs eleven facts; everything derivable is pre-filled server-side (D35, D36)
     so the BD user confirms two or three things instead of typing eleven. -->
<template>
  <Dialog
    v-model:open="show"
    :title="__('Mark as Won')"
    :options="{ size: '2xl' }"
    @close="cancel"
  >
    <template #default>
      <div v-if="!defaults.data" class="py-6 text-center text-ink-gray-5">
        {{ __('Loading') }}
      </div>
      <div v-else class="grid grid-cols-2 gap-3" data-testid="won-dialog">
        <FormControl
          class="col-span-2"
          type="text"
          :label="__('Final client name (legal entity on the contract)')"
          v-model="form.client_legal_name"
        />
        <FormControl
          type="number"
          :label="__('Final commercial (excl. tax)')"
          v-model="form.final_value"
          :disabled="Boolean(form.final_value_locked)"
          :description="
            form.final_value_locked
              ? __('From the accepted proposal {0}', [form.accepted_proposal])
              : __('Pre-filled with the total contract value (TCV)')
          "
        />
        <FormControl
          type="text"
          :label="__('Expected annual revenue (ACV, excl. tax)')"
          :modelValue="money(form.expected_annual_revenue)"
          disabled
          data-testid="won-acv"
          :description="
            __('Computed from the commercials below; correct those to change it')
          "
        />
        <DatePicker
          :label="__('Start date')"
          v-model="form.start_date"
          :placeholder="__('Pick a date')"
        />
        <FormControl
          type="number"
          :label="__('Contract duration (months)')"
          v-model="form.contract_duration_months"
        />
        <Link
          :label="__('Billing frequency')"
          doctype="GAMCS Billing Frequency"
          v-model="form.billing_frequency"
        />
        <FormControl
          type="number"
          :label="__('Billed amount per period (excl. tax)')"
          v-model="form.billed_amount"
        />
        <div v-if="form.services?.length">
          <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Services') }}</div>
          <div class="flex flex-wrap gap-1">
            <Badge
              v-for="s in form.services"
              :key="s"
              :label="s"
              variant="subtle"
            />
          </div>
        </div>
        <Link
          v-else
          :label="__('Service')"
          doctype="GAMCS Service"
          v-model="form.service"
        />
        <div />
        <Link
          :label="__('Delivery owner')"
          doctype="User"
          v-model="form.delivery_owner"
        />
        <Link
          :label="__('Account manager')"
          doctype="User"
          v-model="form.account_manager"
        />
        <FormControl
          type="checkbox"
          :label="__('Contract signed')"
          v-model="form.contract_signed"
          data-testid="won-contract-signed"
        />
        <FormControl
          type="checkbox"
          :label="__('PO received')"
          v-model="form.po_received"
        />
        <div
          v-if="form.referral"
          class="col-span-2 rounded border p-3 text-base"
          data-testid="won-fee"
        >
          <div class="mb-1 text-sm text-ink-gray-5">
            {{ __('Referral fee to {0}', [form.referral.partner]) }}
          </div>
          <div class="flex gap-8">
            <div>
              <span class="text-ink-gray-5">{{ __('Base ({0})', [form.referral.base]) }}</span>
              <span class="ml-2 font-medium text-ink-gray-9">{{ money(form.referral.base_amount) }}</span>
            </div>
            <div>
              <span class="text-ink-gray-5">{{
                form.referral.fee_type === 'Percentage' ? __('Fee ({0}%)', [form.referral.pct]) : __('Fixed fee')
              }}</span>
              <span class="ml-2 font-medium text-ink-gray-9">{{ money(form.referral.fee_amount) }}</span>
            </div>
          </div>
        </div>
        <FormControl
          class="col-span-2"
          type="textarea"
          :label="__('Notes')"
          v-model="form.notes"
        />
      </div>
      <ErrorMessage class="mt-3" :message="error" />
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button :label="__('Cancel')" @click="cancel" />
        <Button
          variant="solid"
          :label="__('Confirm Won')"
          :loading="saving"
          :disabled="!defaults.data"
          @click="confirm"
        />
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import Link from '@/components/Controls/Link.vue'
import {
  Dialog,
  DatePicker,
  FormControl,
  ErrorMessage,
  createResource,
  call,
  toast,
} from 'frappe-ui'
import { reactive, ref } from 'vue'

const props = defineProps({
  dealId: { type: String, required: true },
  status: { type: String, default: '' },
})
const emit = defineEmits(['won', 'cancel'])
const show = defineModel({ type: Boolean })

const form = reactive({})
const error = ref('')
const saving = ref(false)

const defaults = createResource({
  url: 'gamcs_crm.api.won.get_won_defaults',
  params: { deal: props.dealId },
  auto: true,
  onSuccess: (d) => Object.assign(form, d),
  onError: (e) => (error.value = e.messages?.[0] || e.message),
})

function money(v) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: form.currency || 'INR',
    maximumFractionDigits: 0,
  }).format(v || 0)
}

function cancel() {
  show.value = false
  emit('cancel')
}

async function confirm() {
  error.value = ''
  saving.value = true
  try {
    const out = await call('gamcs_crm.api.won.mark_won', {
      deal: props.dealId,
      values: { ...form, contract_signed: form.contract_signed ? 1 : 0, po_received: form.po_received ? 1 : 0 },
      status: props.status || undefined,
    })
    show.value = false
    toast.success(__('Won. Engagement {0} created', [out.engagement]))
    emit('won', out)
  } catch (e) {
    error.value = e.messages?.[0] || e.message
  } finally {
    saving.value = false
  }
}
</script>
