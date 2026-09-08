<template>
  <div
    class="flex flex-col items-center justify-center min-h-screen bg-surface-gray-1"
  >
    <div class="text-center max-w-md">
      <h1 class="text-ink-gray-5 text-4xl-semibold">
        {{ __('Access Denied') }}
      </h1>
      <div class="border-t w-full my-[15px]" />
      <p class="text-ink-gray-4 text-p-base">
        <!-- GAMCS: brand from FCRM Settings -->
        {{
          __(
            'You do not have enough permissions to access {0}. Please contact your administrator if you believe this is an error.',
            [brand.name || __('the CRM')],
          )
        }}
      </p>

      <Button
        class="mt-5 w-full"
        variant="solid"
        :label="__('Login with Different Account')"
        @click="logout.submit()"
      />
    </div>
  </div>
</template>
<script setup>
import { sessionStore } from '@/stores/session'
import { getSettings } from '@/stores/settings'
const { logout } = sessionStore()
const { brand } = getSettings() // GAMCS
</script>
