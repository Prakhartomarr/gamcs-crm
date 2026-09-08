<!-- GAMCS D42: the accepted amount beside the structure's TCV; save the structure that makes them agree -->
<template>
  <Dialog v-model:open="show" :title="__('Reconcile billing structure')" :options="{ size: 'xl' }">
    <template #default>
      <div v-if="!suggestion.data" class="py-6 text-center text-ink-gray-5">{{ __('Loading') }}</div>
      <div v-else data-testid="reconcile-dialog">
        <div class="mb-4 grid grid-cols-3 gap-3 rounded border p-3 text-base">
          <div>
            <div class="text-sm text-ink-gray-5">{{ __('Accepted final value') }}</div>
            <div class="font-medium text-ink-gray-9">{{ money(suggestion.data.amount) }}</div>
          </div>
          <div>
            <div class="text-sm text-ink-gray-5">{{ __('TCV from current structure') }}</div>
            <div class="font-medium text-ink-gray-9">{{ money(suggestion.data.preview?.tcv ?? current.tcv) }}</div>
          </div>
          <div>
            <div class="text-sm text-ink-gray-5">{{ __('TCV after this change') }}</div>
            <div class="font-medium" :class="live?.needs_reconciliation ? 'text-ink-red-5' : 'text-ink-green-5'" data-testid="reconcile-preview">
              {{ live ? money(live.tcv) : '—' }}
            </div>
          </div>
        </div>
        <div class="mb-3 text-p-base text-ink-gray-7">
          {{ __('The suggested change keeps the frequency and term and adjusts the amount so TCV equals the accepted value. Edit any field; the preview uses the same arithmetic as the save.') }}
        </div>
        <div class="grid grid-cols-2 gap-3">
          <Link :label="__('Billing frequency')" doctype="GAMCS Billing Frequency" v-model="form.billing_frequency" @update:modelValue="refresh" />
          <FormControl type="number" :label="__('Contract duration (months)')" v-model="form.contract_duration_months" @update:modelValue="refresh" />
          <FormControl type="number" :label="__('Billed amount per period (excl. tax)')" v-model="form.billed_amount" @update:modelValue="refresh" data-testid="reconcile-billed" />
          <FormControl v-if="form.billing_frequency === 'Hourly'" type="number" :label="__('Cap amount')" v-model="form.cap_amount" @update:modelValue="refresh" />
          <FormControl v-if="form.billing_frequency === 'Hourly'" type="number" :label="__('Estimated hours / month')" v-model="form.estimated_hours_per_month" @update:modelValue="refresh" />
          <FormControl v-if="form.billing_frequency === 'Hourly'" type="number" :label="__('Hourly rate')" v-model="form.hourly_rate" @update:modelValue="refresh" />
        </div>
        <div v-if="live" class="mt-3 text-sm text-ink-gray-5">
          {{ __('Monthly {0} · ACV {1} · TCV {2}', [money(live.monthly_value), money(live.acv), money(live.tcv)]) }}
        </div>
        <ErrorMessage class="mt-3" :message="error" />
      </div>
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button :label="__('Not now')" @click="show = false" />
        <Button variant="solid" :label="__('Save structure')" :loading="saving" :disabled="!live || live.needs_reconciliation" @click="save" />
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import Link from '@/components/Controls/Link.vue'
import { Dialog, FormControl, ErrorMessage, createResource, call, debounce } from 'frappe-ui'
import { reactive, ref } from 'vue'

const props = defineProps({ dealId: { type: String, required: true } })
const emit = defineEmits(['saved'])
const show = defineModel({ type: Boolean })

const form = reactive({})
const current = reactive({})
const live = ref(null)
const error = ref('')
const saving = ref(false)

const suggestion = createResource({
  url: 'gamcs_crm.api.money.suggest',
  params: { deal: props.dealId },
  auto: true,
  onSuccess: (d) => {
    Object.assign(current, d.current, d.preview || {})
    Object.assign(form, d.current, d.change || {})
    live.value = d.preview
  },
})

function money(v) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: current.currency || window.sysdefaults?.currency || 'INR', maximumFractionDigits: 0 }).format(v || 0)
}

const refresh = debounce(async () => {
  error.value = ''
  const out = await call('gamcs_crm.api.money.preview', { deal: props.dealId, values: form })
  if (out.error) {
    error.value = out.error
    live.value = null
    return
  }
  live.value = out
}, 300)

async function save() {
  saving.value = true
  error.value = ''
  try {
    await call('frappe.client.set_value', { doctype: 'CRM Deal', name: props.dealId, fieldname: { ...form } })
    show.value = false
    emit('saved')
  } catch (e) {
    error.value = e.messages?.[0] || e.message
  } finally {
    saving.value = false
  }
}
</script>
