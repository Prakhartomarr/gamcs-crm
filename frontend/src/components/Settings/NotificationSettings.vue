<!-- GAMCS PRD §21 / F13 (E46): the session user's switch for each GAMCS notification type.
     Saved on toggle; Management-critical types are shown locked on. -->
<template>
  <div class="flex h-full flex-col gap-6 py-8 px-6 text-ink-gray-8">
    <div class="flex flex-col gap-1 px-2">
      <h2 class="flex gap-2 text-2xl-semibold leading-none h-5">
        {{ __('Notifications') }}
      </h2>
      <p class="text-p-base text-ink-gray-6">
        {{ __('Choose which reminders you get, in the notifications panel or by email.') }}
      </p>
    </div>

    <div
      class="flex-1 flex flex-col overflow-y-auto"
      data-testid="notification-settings"
    >
      <div v-if="!preferences.data" class="px-2 py-3 text-base text-ink-gray-5">
        {{ __('Loading...') }}
      </div>
      <template v-for="(row, index) in preferences.data || []" :key="row.key">
        <div
          v-if="index"
          class="h-px border-t mx-2 border-outline-elevation-2"
        />
        <div
          class="flex items-center justify-between gap-8 py-3 px-2"
          :data-testid="`notification-${row.key}`"
        >
          <div class="flex flex-col">
            <div class="text-p-base-medium text-ink-gray-7 truncate">
              {{ row.label }}
            </div>
            <div class="text-p-sm text-ink-gray-5">
              {{ row.description }}
            </div>
          </div>
          <Switch
            :modelValue="row.enabled"
            :disabled="row.forced || saving === row.key"
            :aria-label="row.label"
            size="sm"
            @update:modelValue="(v) => toggle(row, v)"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { Switch, call, createResource, toast } from 'frappe-ui'
import { ref } from 'vue'

const saving = ref('')

const preferences = createResource({
  url: 'gamcs_crm.api.notification_settings.get_preferences',
  auto: true,
})

async function toggle(row, enabled) {
  if (row.forced) return
  saving.value = row.key
  const previous = row.enabled
  row.enabled = enabled
  try {
    preferences.setData(
      await call('gamcs_crm.api.notification_settings.set_preference', {
        key: row.key,
        enabled: enabled ? 1 : 0,
      }),
    )
    toast.success(
      enabled ? __('{0} on', [row.label]) : __('{0} off', [row.label]),
    )
  } catch (e) {
    row.enabled = previous
    toast.error(e.messages?.[0] || e.message)
  } finally {
    saving.value = ''
  }
}
</script>
