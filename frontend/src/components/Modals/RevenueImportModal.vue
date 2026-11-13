<!-- GAMCS E65: monthly billed revenue from a CSV. All or nothing: any bad row and nothing is
     saved; the dialog lists each problem by row number. -->
<template>
  <Dialog v-model:open="show" :title="__('Import billed revenue')" :size="'lg'">
    <template #default>
      <div class="flex flex-col gap-4 text-base" data-testid="revenue-import">
        <p class="text-p-base text-ink-gray-7">
          {{ __('One row per engagement per month, with a header row: engagement (the ID or the client legal name), month (2026-04 or Apr 2026) and amount (excl. tax, in the engagement currency). Optional: exchange_rate, notes. A month already entered is updated.') }}
        </p>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm text-ink-gray-6">{{ __('CSV file') }}</span>
          <input type="file" accept=".csv,text/csv" class="text-base" data-testid="revenue-csv" @change="pick" />
        </label>
        <div v-if="result && !result.errors.length" class="rounded-2xl bg-surface-gray-1 p-3 text-ink-gray-8" data-testid="revenue-import-done">
          {{ __('{0} month(s) added, {1} updated.', [result.imported, result.updated]) }}
        </div>
        <div v-if="result?.errors.length" class="rounded-2xl bg-surface-gray-1 p-3" data-testid="revenue-import-errors">
          <div class="mb-1 font-medium text-ink-gray-8">{{ __('Nothing was saved. Fix these rows and import again:') }}</div>
          <ul class="list-disc pl-5 text-sm text-ink-gray-7">
            <li v-for="e in result.errors" :key="e.row + e.error">{{ __('Row {0}: {1}', [e.row, e.error]) }}</li>
          </ul>
        </div>
        <ErrorMessage :message="error" />
      </div>
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button :label="result && !result.errors.length ? __('Close') : __('Cancel')" @click="show = false" />
        <Button
          v-if="!(result && !result.errors.length)"
          variant="solid"
          :label="__('Import')"
          :disabled="!content"
          :loading="loading"
          @click="run"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { Dialog, ErrorMessage, call } from 'frappe-ui'
import { ref } from 'vue'

const show = defineModel({ type: Boolean })
const emit = defineEmits(['imported'])
const content = ref('')
const result = ref(null)
const error = ref('')
const loading = ref(false)

function pick(e) {
  const file = e.target.files?.[0]
  result.value = null
  error.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => (content.value = String(reader.result || ''))
  reader.readAsText(file)
}

async function run() {
  loading.value = true
  error.value = ''
  try {
    result.value = await call('gamcs_crm.api.engagement.import_revenue_csv', { content: content.value })
    if (!result.value.errors.length) emit('imported')
  } catch (e) {
    error.value = e?.messages?.[0] || e?.message || __('Import failed')
  } finally {
    loading.value = false
  }
}
</script>
