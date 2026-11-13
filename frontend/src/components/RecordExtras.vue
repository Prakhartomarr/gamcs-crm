<!-- GAMCS E65 (PRD §23): the contact block (email, phone, LinkedIn, website) and the Documents
     section (proposal versions plus attachments tagged Scope or Contract) on a lead or deal. -->
<template>
  <div class="flex flex-col gap-4 border-b px-5 py-4 text-base" data-testid="record-extras">
    <section v-if="contactRows.length" :aria-label="__('Contact')">
      <div class="mb-2 text-sm font-medium text-ink-gray-6">{{ __('Contact') }}</div>
      <ul class="flex flex-col gap-1.5">
        <li v-for="r in contactRows" :key="r.key" class="flex min-w-0 items-center gap-2.5">
          <span :class="r.icon" class="size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
          <a
            v-if="r.href"
            :href="r.href"
            :target="r.external ? '_blank' : undefined"
            rel="noopener"
            class="truncate text-ink-gray-8 hover:underline"
            :data-testid="'contact-' + r.key"
            >{{ r.label }}</a
          >
        </li>
      </ul>
    </section>

    <section :aria-label="__('Documents')" data-testid="documents">
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="text-sm font-medium text-ink-gray-6">{{ __('Documents') }}</span>
        <Dropdown v-if="docs.data?.can_tag && tagOptions.length" :options="tagOptions" align="end">
          <Button variant="ghost" size="sm" :label="__('Tag a file')" data-testid="tag-file" />
        </Dropdown>
      </div>
      <ul v-if="items.length" class="flex flex-col gap-1.5">
        <li v-for="d in items" :key="d.key" class="flex min-w-0 items-center gap-2">
          <span class="gamcs-pill gamcs-pill-soft shrink-0 text-xs">{{ d.badge }}</span>
          <a
            v-if="d.url"
            :href="d.url"
            target="_blank"
            rel="noopener"
            class="min-w-0 flex-1 truncate text-ink-gray-8 hover:underline"
            >{{ d.label }}</a
          >
          <span v-else class="min-w-0 flex-1 truncate text-ink-gray-8">{{ d.label }}</span>
          <span v-if="d.meta" class="shrink-0 text-sm text-ink-gray-6">{{ d.meta }}</span>
        </li>
      </ul>
      <div v-else-if="docs.data" class="text-sm text-ink-gray-6">
        {{ __('No proposals or tagged files yet. Attach a file, then tag it Scope or Contract.') }}
      </div>
    </section>
  </div>
</template>

<script setup>
import { formatMoney, formatPhone } from '@/utils/gamcs'
import { Dropdown, createResource, call, toast } from 'frappe-ui'
import { computed, watch } from 'vue'

const props = defineProps({
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
  doc: { type: Object, default: () => ({}) },
  // a deal keeps email and phone on its contacts: the primary one fills the gaps
  contact: { type: Object, default: null },
  // bump to refetch (after an upload or a proposal change)
  reload: { type: Number, default: 0 },
})

const docs = createResource({
  url: 'gamcs_crm.api.documents.get_documents',
  makeParams: () => ({ doctype: props.doctype, name: props.docname }),
  auto: true,
})
watch(
  () => [props.docname, props.reload],
  () => docs.reload(),
)

function withScheme(url) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
function shortUrl(url) {
  return String(url).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')
}

const contactRows = computed(() => {
  const d = props.doc || {}
  const c = props.contact || {}
  const email = d.email || c.email
  const phone = d.mobile_no || d.phone || c.mobile_no
  return [
    email && { key: 'email', icon: 'lucide-mail', label: email, href: `mailto:${email}` },
    phone && { key: 'phone', icon: 'lucide-phone', label: formatPhone(phone), href: `tel:${String(phone).replace(/\s/g, '')}` },
    d.linkedin && { key: 'linkedin', icon: 'lucide-linkedin', label: shortUrl(d.linkedin), href: withScheme(d.linkedin), external: true },
    d.website && { key: 'website', icon: 'lucide-globe', label: shortUrl(d.website), href: withScheme(d.website), external: true },
  ].filter(Boolean)
})

const items = computed(() => {
  const data = docs.data || {}
  const proposals = (data.proposals || []).map((p) => ({
    key: p.name,
    badge: `V${p.version}`,
    label: __('Proposal {0}', [formatMoney(p.amount, p.currency)]),
    url: p.document,
    meta: __(p.client_status || ''),
  }))
  const files = (data.files || []).map((f) => ({
    key: f.name,
    badge: __(f.gamcs_document_tag),
    label: f.file_name,
    url: f.file_url,
  }))
  return [...proposals, ...files]
})

const tagOptions = computed(() =>
  (docs.data?.untagged || []).flatMap((f) =>
    ['Scope', 'Contract'].map((tag) => ({
      label: __('{0} as {1}', [f.file_name, __(tag)]),
      onClick: () => setTag(f.name, tag),
    })),
  ),
)

async function setTag(file, tag) {
  try {
    await call('gamcs_crm.api.documents.set_document_tag', { file, tag })
    docs.reload()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Could not tag the file'))
  }
}
</script>
