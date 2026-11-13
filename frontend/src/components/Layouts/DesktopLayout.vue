<template>
  <!-- GAMCS: the content column floats as a white panel on the mist canvas (gamcs_brand.css) -->
  <div class="gamcs-shell flex h-screen w-screen">
    <AppSidebar />
    <div
      class="gamcs-panel flex-1 flex flex-col overflow-auto bg-surface-base sm:my-2 sm:mr-2 h-[calc(100%-1rem)]"
    >
      <AppHeader />
      <slot />
    </div>
    <GlobalModals />
  </div>
</template>
<script setup>
import AppSidebar from '@/components/Layouts/AppSidebar.vue'
import AppHeader from '@/components/Layouts/AppHeader.vue'
import GlobalModals from '@/components/Modals/GlobalModals.vue'
import { availabilityStore } from '@/stores/availability'

// listen for status changes from the start, not only once a picker opens
availabilityStore()
</script>
