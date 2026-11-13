<!-- GAMCS F7: Won needs eleven facts; everything derivable is pre-filled server-side (D35, D36)
     so the BD user confirms two or three things instead of typing eleven.
     Grouped into four short sections; ends on a success state (peak-end), not a raw ID. -->
<template>
  <Dialog
    v-model:open="show"
    :title="done ? '' : __('Mark as won')"
    :size="'2xl'"
    @close="close"
  >
    <template #default>
      <div v-if="done" class="flex flex-col items-start gap-4 py-2" data-testid="won-success">
        <span class="grid size-12 place-items-center rounded-full bg-[var(--gamcs-yellow)]">
          <span class="lucide-trophy size-6 text-[var(--gamcs-midnight)]" aria-hidden="true" />
        </span>
        <div class="flex flex-col gap-1">
          <h2 class="text-2xl font-semibold text-ink-gray-9">
            {{ __('Won: {0}', [form.client_legal_name || dealId]) }}
          </h2>
          <p class="text-p-base text-ink-gray-6">
            {{ __('Expected annual revenue {0}. The engagement is set up and {1} owns delivery.', [money(done.acv ?? form.expected_annual_revenue), ownerName]) }}
          </p>
        </div>
        <dl class="grid w-full grid-cols-2 gap-4 rounded-2xl gamcs-tint p-4 sm:grid-cols-3">
          <div>
            <dt class="text-sm text-ink-gray-6">{{ __('Final value') }}</dt>
            <dd class="gamcs-num text-lg font-semibold text-ink-gray-9">{{ money(form.final_value) }}</dd>
          </div>
          <div>
            <dt class="text-sm text-ink-gray-6">{{ __('Starts') }}</dt>
            <dd class="text-lg font-semibold text-ink-gray-9">{{ formatDay(form.start_date) }}</dd>
          </div>
          <div>
            <dt class="text-sm text-ink-gray-6">{{ __('Term') }}</dt>
            <dd class="text-lg font-semibold text-ink-gray-9">{{ __('{0} months', [form.contract_duration_months || 0]) }}</dd>
          </div>
        </dl>
      </div>

      <div v-else-if="!defaults.data && !error" class="py-6 text-base text-ink-gray-5">
        {{ __('Loading the deal…') }}
      </div>

      <form v-else-if="defaults.data" class="flex flex-col gap-6" data-testid="won-dialog" @submit.prevent="confirm">
        <section class="flex flex-col gap-4">
          <h3 class="text-base font-semibold text-ink-gray-8">{{ __('Client and value') }}</h3>
          <FormControl
            type="text"
            :label="__('Client legal name (as on the contract)')"
            v-model="form.client_legal_name"
          />
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormControl
              type="number"
              :label="__('Final value (excl. tax)')"
              v-model="form.final_value"
              :disabled="Boolean(form.final_value_locked)"
              :description="
                form.final_value_locked
                  ? __('{0}, from the accepted proposal', [money(form.final_value)])
                  : __('{0}. Pre-filled with the total contract value', [money(form.final_value)])
              "
            />
            <div class="flex flex-col gap-1.5" data-testid="won-acv">
              <span class="text-xs text-ink-gray-5">{{ __('Expected annual revenue (ACV)') }}</span>
              <span class="gamcs-num flex h-7 items-center text-lg font-semibold text-ink-gray-9">
                {{ money(form.expected_annual_revenue) }}
              </span>
              <span class="text-p-xs text-ink-gray-5">{{ __('Worked out from the contract terms below') }}</span>
            </div>
          </div>
        </section>

        <section class="flex flex-col gap-4">
          <h3 class="text-base font-semibold text-ink-gray-8">{{ __('Contract') }}</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker :label="__('Start date')" v-model="form.start_date" :placeholder="__('Pick a date')" />
            <FormControl type="number" :label="__('Duration (months)')" v-model="form.contract_duration_months" />
            <Link :label="__('Billing frequency')" doctype="GAMCS Billing Frequency" v-model="form.billing_frequency" />
            <FormControl
              type="number"
              :label="__('Billed amount per period (excl. tax)')"
              v-model="form.billed_amount"
              :description="form.billed_amount ? money(form.billed_amount) : ''"
            />
          </div>
          <div v-if="form.services?.length">
            <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Services') }}</div>
            <div class="flex flex-wrap gap-1">
              <span v-for="s in form.services" :key="s" class="gamcs-pill gamcs-pill-soft">{{ s }}</span>
            </div>
          </div>
          <Link v-else :label="__('Service')" doctype="GAMCS Service" v-model="form.service" />
        </section>

        <section class="flex flex-col gap-4">
          <h3 class="text-base font-semibold text-ink-gray-8">{{ __('Team and paperwork') }}</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link :label="__('Delivery owner')" doctype="User" v-model="form.delivery_owner" />
            <Link :label="__('Account manager')" doctype="User" v-model="form.account_manager" />
            <FormControl type="checkbox" :label="__('Contract signed')" v-model="form.contract_signed" data-testid="won-contract-signed" />
            <FormControl type="checkbox" :label="__('PO received')" v-model="form.po_received" />
          </div>
        </section>

        <div
          v-if="form.needs_reconciliation"
          class="flex flex-col gap-3 rounded-2xl bg-surface-amber-1 p-4 text-base"
          data-testid="won-variance"
        >
          <div class="text-ink-gray-8">
            {{ __('The billing terms add up to {0}, but the agreed final value is {1}. Fix the terms, or say why they differ.', [money(form.tcv), money(form.final_value)]) }}
          </div>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <FormControl class="flex-1" type="textarea" :label="__('Why they differ')" v-model="form.variance_reason" data-testid="won-variance-reason" />
            <Button :label="__('Fix the terms first')" @click="emit('reconcile')" />
          </div>
        </div>

        <div v-if="form.referral" class="rounded-2xl bg-surface-gray-1 p-4 text-base" data-testid="won-fee">
          <div class="mb-2 text-sm text-ink-gray-6">{{ __('Referral fee to {0}', [form.referral.partner]) }}</div>
          <div class="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <span class="text-ink-gray-6">{{ __('Base ({0})', [form.referral.base]) }}</span>
              <span class="gamcs-num ml-2 font-medium text-ink-gray-9">{{ money(form.referral.base_amount) }}</span>
            </div>
            <div>
              <span class="text-ink-gray-6">{{
                form.referral.fee_type === 'Percentage' ? __('Fee ({0}%)', [form.referral.pct]) : __('Fixed fee')
              }}</span>
              <span class="gamcs-num ml-2 font-medium text-ink-gray-9">{{ money(form.referral.fee_amount) }}</span>
            </div>
          </div>
        </div>

        <FormControl type="textarea" :label="__('Notes')" v-model="form.notes" />
        <button type="submit" class="hidden" tabindex="-1" aria-hidden="true" />
      </form>
      <ErrorMessage class="mt-3" :message="error" />
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <template v-if="done">
          <Button variant="solid" :label="__('Done')" @click="finish" />
        </template>
        <template v-else>
          <Button :label="__('Cancel')" @click="close" />
          <Button
            variant="solid"
            :label="__('Confirm won')"
            :loading="saving"
            :disabled="!defaults.data"
            @click="confirm"
          />
        </template>
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import Link from '@/components/Controls/Link.vue'
import { usersStore } from '@/stores/users'
import { formatDay, formatMoney } from '@/utils/gamcs'
import {
  Dialog,
  DatePicker,
  FormControl,
  ErrorMessage,
  createResource,
  call,
} from 'frappe-ui'
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  dealId: { type: String, required: true },
  status: { type: String, default: '' },
})
const emit = defineEmits(['won', 'cancel', 'reconcile'])
const show = defineModel({ type: Boolean })
const { getUser } = usersStore()

const form = reactive({})
const error = ref('')
const saving = ref(false)
const done = ref(null)

const defaults = createResource({
  url: 'gamcs_crm.api.won.get_won_defaults',
  params: { deal: props.dealId },
  auto: true,
  onSuccess: (d) => Object.assign(form, d),
  onError: (e) => (error.value = e.messages?.[0] || e.message),
})

const ownerName = computed(() => getUser(form.delivery_owner)?.full_name || form.delivery_owner || __('the delivery owner'))

function money(v) {
  return formatMoney(v, form.currency)
}

// closing after a successful confirm must never read as a cancel (Kanban reverts on cancel),
// and the dialog's own close event must not emit twice
let closed = false
function close() {
  if (done.value) return finish()
  if (closed) return
  closed = true
  show.value = false
  emit('cancel')
}

function finish() {
  if (closed) return
  closed = true
  show.value = false
  emit('won', done.value)
}

async function confirm() {
  error.value = ''
  saving.value = true
  try {
    done.value = await call('gamcs_crm.api.won.mark_won', {
      deal: props.dealId,
      values: { ...form, contract_signed: form.contract_signed ? 1 : 0, po_received: form.po_received ? 1 : 0 },
      status: props.status || undefined,
    })
  } catch (e) {
    error.value = e.messages?.[0] || e.message
  } finally {
    saving.value = false
  }
}
</script>
