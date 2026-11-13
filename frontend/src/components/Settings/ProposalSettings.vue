<!-- GAMCS L3: the proposal template's editable text (terms and scope boilerplate), the signatory and
     how long a signing link lasts. The layout itself is the GAMCS Proposal print format. Admin only. -->
<template>
  <div class="flex h-full flex-col gap-6 py-8 px-6 text-ink-gray-8">
    <div class="flex items-start justify-between gap-4 px-2">
      <div class="flex flex-col gap-1">
        <h2 class="flex gap-2 text-2xl-semibold leading-none h-5">
          {{ __('Proposal template') }}
        </h2>
        <p class="text-p-base text-ink-gray-6">
          {{ __('Printed on every generated proposal, under the scope. Amounts and client details come from the opportunity.') }}
        </p>
      </div>
      <Button
        variant="solid"
        :label="__('Save')"
        :loading="saving"
        :disabled="!settings.data"
        data-testid="proposal-settings-save"
        @click="save"
      />
    </div>
    <div v-if="!settings.data" class="px-2 text-base text-ink-gray-5">
      {{ __('Loading...') }}
    </div>
    <div
      v-else
      class="flex flex-1 flex-col gap-6 overflow-y-auto px-2"
      data-testid="proposal-settings"
    >
      <div class="flex flex-col gap-2">
        <div class="text-base font-medium text-ink-gray-7">
          {{ __('Terms and scope boilerplate') }}
        </div>
        <TextEditorControl
          :value="form.proposal_terms"
          size="md"
          :placeholder="__('e.g. Fees are payable within 15 days of invoice. Out-of-scope work is billed at agreed hourly rates.')"
          @change="(v) => (form.proposal_terms = v)"
        />
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormControl
          type="text"
          :label="__('Signatory name')"
          v-model="form.signatory_name"
          :placeholder="__('Blank prints the company name')"
        />
        <FormControl
          type="text"
          :label="__('Signatory designation')"
          v-model="form.signatory_designation"
          :placeholder="__('Authorised signatory')"
        />
        <FormControl
          type="number"
          :label="__('Signing link lasts (days)')"
          v-model="form.signature_link_days"
          :description="__('Between 1 and 90. A link also stops working once it is used or withdrawn.')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import TextEditorControl from '@/components/Controls/TextEditorControl.vue'
import { FormControl, call, createResource, toast } from 'frappe-ui'
import { reactive, ref } from 'vue'

const form = reactive({})
const saving = ref(false)

const settings = createResource({
  url: 'gamcs_crm.api.esign.get_proposal_settings',
  auto: true,
  onSuccess: (d) => Object.assign(form, d),
})

async function save() {
  saving.value = true
  try {
    Object.assign(form, await call('gamcs_crm.api.esign.save_proposal_settings', { values: { ...form } }))
    toast.success(__('Proposal template saved. The next generated PDF uses it.'))
  } catch (e) {
    toast.error(e.messages?.[0] || e.message)
  } finally {
    saving.value = false
  }
}
</script>
