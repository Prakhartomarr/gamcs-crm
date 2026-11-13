<!-- GAMCS E55/E57: each user connects their own Outlook mailbox and calendar (BD has no desk, where
     Frappe's own Authorise button lives). Admin switches stay in GAMCS Email Settings. -->
<template>
  <div class="flex h-full flex-col gap-6 py-8 px-6 text-ink-gray-8">
    <div class="flex flex-col gap-1 px-2">
      <h2 class="flex gap-2 text-2xl-semibold leading-none h-5">
        {{ __('Connections') }}
      </h2>
      <p class="text-p-base text-ink-gray-6">
        {{ __('Connect your own Microsoft 365 account so CRM email and meetings use your mailbox and calendar.') }}
      </p>
    </div>
    <div class="flex-1 flex flex-col overflow-y-auto" data-testid="connections-settings">
      <div v-if="!rows.data" class="px-2 py-3 text-base text-ink-gray-5">
        {{ __('Loading...') }}
      </div>
      <template v-for="(row, index) in rows.data || []" :key="row.kind">
        <div v-if="index" class="h-px border-t mx-2 border-outline-elevation-2" />
        <div class="flex items-center justify-between gap-8 py-3 px-2" :data-testid="`connection-${row.kind}`">
          <div class="flex flex-col">
            <div class="text-p-base-medium text-ink-gray-7 truncate">{{ row.label }}</div>
            <div class="text-p-sm text-ink-gray-5">{{ describe(row) }}</div>
          </div>
          <Badge v-if="row.connected" :label="__('Connected')" theme="green" variant="subtle" />
          <Button
            v-else-if="row.available"
            :label="__('Connect')"
            :loading="busy === row.kind"
            @click="connect(row)"
          />
        </div>
      </template>
    </div>
  </div>
</template>
<script setup>
import { Badge, call, createResource, toast } from 'frappe-ui'
import { ref } from 'vue'

const busy = ref('')
const rows = createResource({ url: 'gamcs_crm.api.connections.get_connections', auto: true })

function describe(row) {
  if (!row.available) return __('Not set up yet. An admin follows docs/OUTLOOK.md once the Microsoft 365 tenant exists.')
  if (row.kind === 'mail') {
    if (!row.mailbox) return __('An admin still needs to add an Email Account for your address.')
    return row.connected ? __('Emails you send from leads and opportunities go from your mailbox.') : __('Sign in once with Microsoft to authorise your mailbox.')
  }
  if (!row.enabled) return __('The calendar integration is switched off for now.')
  return row.connected ? __('Schedule meeting creates events on your Outlook calendar.') : __('Sign in once with Microsoft to authorise your calendar.')
}

async function connect(row) {
  busy.value = row.kind
  try {
    window.location.href = await call('gamcs_crm.api.connections.connect', { kind: row.kind })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Could not start the Microsoft sign-in'))
    busy.value = ''
  }
}
</script>
