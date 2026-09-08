<!-- GAMCS: About panel reads brand from FCRM Settings, shows our versions and links to the licences page -->
<template>
  <Dialog v-model:open="show" :size="'sm'">
    <template #body>
      <div class="p-4 pt-5">
        <div class="flex justify-center">
          <div class="flex flex-col items-center">
            <img
              v-if="brand.logo"
              :src="brand.logo"
              class="mb-3 size-12 rounded-lg"
              :alt="brand.name"
            />
            <CRMLogo v-else class="mb-3 size-12" />
            <h3 class="text-2xl-semibold text-ink-gray-9">
              {{ brand.name || __('CRM') }}
            </h3>
            <p v-if="versions.data" class="mt-1 text-sm text-ink-gray-6">
              {{ __('Version {0}', [versions.data.gamcs_crm]) }}
            </p>
          </div>
        </div>
        <hr class="border-t my-3 mx-2" />
        <div>
          <a
            v-for="link in links"
            :key="link.label"
            class="flex py-2 px-2 hover:bg-surface-gray-1 rounded cursor-pointer"
            target="_blank"
            :href="link.url"
          >
            <component
              :is="link.icon"
              v-if="link.icon"
              class="size-4 mr-2 text-ink-gray-7"
            />
            <span class="text-base text-ink-gray-8">
              {{ link.label }}
            </span>
          </a>
        </div>
        <hr class="border-t my-3 mx-2" />
        <p class="text-sm text-ink-gray-6 px-2 mt-2">
          © GA Management Consultants LLP
        </p>
        <p v-if="versions.data" class="text-xs text-ink-gray-5 px-2 mt-1">
          {{
            __('Built on open-source components (Frappe CRM {0}, Frappe {1}); see licences.', [
              versions.data.crm,
              versions.data.frappe,
            ])
          }}
        </p>
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import CRMLogo from '@/components/Icons/CRMLogo.vue'
import { getSettings } from '@/stores/settings'
import LucideScale from '~icons/lucide/scale'
import LucideBug from '~icons/lucide/bug'
import { createResource } from 'frappe-ui'

const { brand } = getSettings()

let show = defineModel({ type: Boolean })

const versions = createResource({
  url: 'gamcs_crm.api.about.get_versions',
  cache: 'gamcs-versions',
  auto: true,
})

let links = [
  {
    label: __('Open-source licences'),
    url: '/licences',
    icon: LucideScale,
  },
  {
    label: __('Report an Issue'),
    url: 'https://github.com/Prakhartomarr/gamcs_crm/issues',
    icon: LucideBug,
  },
]
</script>
