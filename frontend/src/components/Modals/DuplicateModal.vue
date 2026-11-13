<!-- GAMCS F11: probable duplicates found before creating a record; open one, or create anyway (recorded) -->
<template>
  <Dialog v-model:open="show" :title="__('Looks like a duplicate')" @close="cancel">
    <template #default>
      <div class="-mt-3 mb-3 text-p-base text-ink-gray-7">
        {{ __('These records match on company, email or phone. Open one instead, or create anyway.') }}
      </div>
      <div class="flex flex-col divide-y" data-testid="duplicate-list">
        <a
          v-for="m in matches"
          :key="m.doctype + m.name"
          :href="m.route"
          target="_blank"
          class="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-base hover:bg-surface-gray-1"
        >
          <div class="flex min-w-0 items-center gap-2">
            <span class="truncate font-medium text-ink-gray-9">{{ m.title }}</span>
            <span class="gamcs-pill gamcs-pill-gray">{{ m.doctype.replace('CRM ', '').replace('GAMCS ', '') }}</span>
          </div>
          <div class="shrink-0 text-sm text-ink-gray-6">{{ __('Same {0}', [m.matched_on.join(', ')]) }}</div>
        </a>
      </div>
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button :label="__('Cancel')" @click="cancel" />
        <Button variant="solid" :label="__('Create anyway')" @click="proceed" />
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import { Dialog } from 'frappe-ui'

const props = defineProps({ matches: { type: Array, default: () => [] } })
const emit = defineEmits(['proceed', 'cancel'])
const show = defineModel({ type: Boolean })

function cancel() {
  show.value = false
  emit('cancel')
}
function proceed() {
  show.value = false
  const first = props.matches[0]
  emit('proceed', first ? `${first.doctype}:${first.name}` : 'override')
}
</script>
