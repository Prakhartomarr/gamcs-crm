<!-- GAMCS D29: when the rate service is unreachable the save stops and asks for the rate; never 1.0 -->
<template>
  <Dialog v-model:open="show" :title="__('Exchange rate needed')">
    <template #default>
      <div class="-mt-3 mb-4 text-p-base text-ink-gray-7">
        {{
          __(
            'The exchange rate service is unreachable for {0}. Enter today\'s rate; it is frozen once saved and only an Admin can change it later.',
            [currency],
          )
        }}
      </div>
      <FormControl
        type="number"
        :label="__('1 {0} in {1}', [currency, baseCurrency])"
        v-model="rate"
        :placeholder="__('e.g. 83.25')"
        data-testid="manual-rate"
      />
      <ErrorMessage class="mt-2" :message="error" />
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button :label="__('Cancel')" @click="show = false" />
        <Button
          variant="solid"
          :label="__('Save rate')"
          :loading="saving"
          @click="save"
        />
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import { Dialog, FormControl, ErrorMessage, call } from 'frappe-ui'
import { ref } from 'vue'

const props = defineProps({
  dealId: { type: String, required: true },
  currency: { type: String, required: true },
})
const emit = defineEmits(['saved'])
const show = defineModel({ type: Boolean })

const baseCurrency = window.sysdefaults?.currency || 'INR'
const rate = ref('')
const error = ref('')
const saving = ref(false)

async function save() {
  error.value = ''
  if (!(parseFloat(rate.value) > 0)) {
    error.value = __('Enter a rate greater than zero')
    return
  }
  saving.value = true
  try {
    await call('frappe.client.set_value', {
      doctype: 'CRM Deal',
      name: props.dealId,
      fieldname: {
        currency: props.currency,
        exchange_rate: parseFloat(rate.value),
      },
    })
    show.value = false
    emit('saved')
  } catch (e) {
    error.value = e.messages?.[0] || e.message
  } finally {
    saving.value = false
  }
}
</script>
