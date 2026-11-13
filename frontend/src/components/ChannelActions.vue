<!-- GAMCS L3 (D15, D16): one-click manual logging for WhatsApp and LinkedIn. Each channel is a
     subtle button that opens the quick-log pre-set to that type, plus an icon link that opens the
     chat (wa.me, E.164, +91 by default) or the stored profile in a new tab. No API, no new dialog. -->
<template>
  <div class="flex flex-wrap items-center gap-1" data-testid="channel-actions">
    <div v-for="c in channels" :key="c.type" class="flex items-center">
      <Button
        v-if="compact"
        :size="size"
        variant="subtle"
        :tooltip="c.aria"
        :aria-label="c.aria"
        :class="{ 'rounded-r-none': c.link }"
        :data-testid="`log-${c.key}`"
        @click="emit('log', c.type)"
      >
        <template #icon><component :is="c.icon" /></template>
      </Button>
      <Button
        v-else
        :size="size"
        variant="subtle"
        :label="c.label"
        :aria-label="c.aria"
        :class="{ 'rounded-r-none': c.link }"
        :data-testid="`log-${c.key}`"
        @click="emit('log', c.type)"
      >
        <template #prefix><component :is="c.icon" /></template>
      </Button>
      <Tooltip v-if="c.link" :text="c.open">
        <a
          :href="c.link"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center justify-center rounded-r-lg border-l border-outline-gray-2 bg-surface-gray-2 px-2 text-ink-gray-7 hover:bg-surface-gray-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          :class="size === 'sm' ? 'h-7' : 'h-8'"
          :aria-label="c.open"
          :data-testid="`open-${c.key}`"
        >
          <span class="lucide-external-link size-3.5" aria-hidden="true" />
        </a>
      </Tooltip>
    </div>
  </div>
</template>

<script setup>
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import { linkedinUrl, whatsappUrl } from '@/utils/channels'
import { Tooltip } from 'frappe-ui'
import { computed, h } from 'vue'

const props = defineProps({
  phone: { type: String, default: '' },
  linkedin: { type: String, default: '' },
  size: { type: String, default: 'md' },
  // icon-only buttons (Follow-ups rows); the name stays as aria-label and tooltip
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['log'])

// lucide has no LinkedIn mark; a boxed "in" reads as LinkedIn without a brand asset
const LinkedInMark = () =>
  h(
    'span',
    {
      'aria-hidden': 'true',
      class:
        'inline-grid size-4 place-items-center rounded-[3px] border border-current text-[9px] font-bold leading-none',
    },
    'in',
  )
const WhatsAppMark = () => h(WhatsAppIcon, { class: 'size-4' })

const channels = computed(() => [
  {
    key: 'whatsapp',
    type: 'WhatsApp',
    label: __('WhatsApp'),
    aria: __('Log a WhatsApp message'),
    open: __('Open in WhatsApp'),
    icon: WhatsAppMark,
    link: whatsappUrl(props.phone),
  },
  {
    key: 'linkedin',
    type: 'LinkedIn',
    label: __('LinkedIn'),
    aria: __('Log a LinkedIn touch'),
    open: __('Open LinkedIn profile'),
    icon: LinkedInMark,
    link: linkedinUrl(props.linkedin),
  },
])
</script>
