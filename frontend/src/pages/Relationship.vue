<!-- GAMCS: partner relationship detail page (F1), adapted and trimmed from Deal.vue -->
<template>
  <LayoutHeader>
    <template #left-header>
      <Breadcrumbs :items="breadcrumbs">
        <template #prefix="{ item }">
          <Icon v-if="item.icon" :icon="item.icon" class="mr-2 h-4" />
        </template>
      </Breadcrumbs>
    </template>
    <template v-if="!errorTitle" #right-header>
      <AssignTo
        v-model="assignees.data"
        doctype="GAMCS Relationship"
        :docname="relationshipId"
      />
      <Dropdown
        v-if="doc.stage"
        :options="stageOptions(triggerStageChange)"
        placement="right"
      >
        <template #default="{ open }">
          <Button
            :label="doc.stage"
            :iconRight="open ? 'chevron-up' : 'chevron-down'"
          >
            <template #prefix>
              <IndicatorIcon :class="getStage(doc.stage).color" />
            </template>
          </Button>
        </template>
      </Dropdown>
    </template>
  </LayoutHeader>
  <div v-if="doc.name" class="flex h-full overflow-hidden">
    <Tabs
      v-model="tabIndex"
      as="div"
      :tabs="tabs"
      class="flex flex-1 overflow-hidden flex-col [&_[role='tab']]:px-0 [&_[role='tab']]:shrink-0 [&_[role='tablist']]:px-5 [&_[role='tablist']::-webkit-scrollbar]:h-0 [&_[role='tablist']]:min-h-[45px] [&_[role='tablist']]:gap-7.5 [&_[role='tabpanel']:not([hidden])]:flex [&_[role='tabpanel']:not([hidden])]:grow"
    >
      <template #tab-panel>
        <Activities
          ref="activities"
          v-model:reload="reload"
          v-model:tabIndex="tabIndex"
          doctype="GAMCS Relationship"
          :docname="relationshipId"
          :tabs="tabs"
          @afterSave="reloadResources"
        />
      </template>
    </Tabs>
    <Resizer side="right" class="flex flex-col justify-between border-l">
      <div
        class="flex h-[45px] cursor-copy items-center border-b px-5 py-2.5 text-lg-medium text-ink-gray-9"
        @click="copyToClipboard(relationshipId)"
      >
        {{ relationshipId }}
      </div>
      <div class="flex items-center justify-start gap-5 border-b p-5">
        <Avatar
          size="3xl"
          class="size-12"
          :label="title"
          :image="organization?.organization_logo"
        />
        <div class="flex flex-col gap-2.5 truncate text-ink-gray-9">
          <div class="truncate text-3xl-medium">{{ title }}</div>
          <div class="flex gap-1.5">
            <Button
              :tooltip="__('Go to Organization')"
              :icon="ArrowUpRightIcon"
              @click="
                router.push({
                  name: 'Organization',
                  params: { organizationId: doc.organization },
                })
              "
            />
            <Button
              :tooltip="__('Go to Website')"
              :icon="LinkIcon"
              @click="
                organization?.website
                  ? openWebsite(organization.website)
                  : toast.error(__('No website on the organization'))
              "
            />
            <Button
              v-if="canDelete"
              :tooltip="__('Delete')"
              variant="subtle"
              icon="lucide-trash-2"
              theme="red"
              @click="showDeleteLinkedDocModal = true"
            />
          </div>
        </div>
      </div>
      <div data-testid="rollup" class="border-b px-5 py-4 text-base">
        <div class="mb-2 text-sm text-ink-gray-5">
          {{ __('Opportunities from this partner') }}
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div>
            <div
              data-testid="rollup-count"
              class="text-2xl-semibold text-ink-gray-9"
            >
              {{ opportunities.data?.count ?? 0 }}
            </div>
            <div class="text-sm text-ink-gray-5">{{ __('Opportunities') }}</div>
          </div>
          <div>
            <div class="text-2xl-semibold text-ink-gray-9">
              {{ inr(opportunities.data?.won_value) }}
            </div>
            <div class="text-sm text-ink-gray-5">{{ __('Won (INR)') }}</div>
          </div>
          <div>
            <div class="text-2xl-semibold text-ink-gray-9">
              {{ inr(opportunities.data?.fees_due) }}
            </div>
            <div class="text-sm text-ink-gray-5">
              {{ __('Fees due (INR)') }}
            </div>
          </div>
        </div>
        <div
          v-for="d in opportunities.data?.deals || []"
          :key="d.name"
          data-testid="rollup-deal"
          class="mt-2 flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-surface-gray-1"
          @click="router.push({ name: 'Deal', params: { dealId: d.name } })"
        >
          <div class="truncate">
            <span class="text-ink-gray-9">{{ d.organization || d.name }}</span>
            <span class="ml-2 text-ink-gray-5">{{ d.status }}</span>
          </div>
          <div class="whitespace-nowrap text-ink-gray-7">
            {{ d.currency }} {{ d.deal_value }}
          </div>
        </div>
      </div>
      <div
        v-if="sections.data"
        class="flex flex-1 flex-col justify-between overflow-hidden"
      >
        <SidePanelLayout
          :sections="sections.data"
          doctype="GAMCS Relationship"
          :docname="relationshipId"
          @reload="sections.reload"
          @afterFieldChange="reloadResources"
        >
        </SidePanelLayout>
      </div>
    </Resizer>
  </div>
  <ErrorPage
    v-else-if="errorTitle"
    :errorTitle="errorTitle"
    :errorMessage="errorMessage"
  />
  <DeleteLinkedDocModal
    v-if="showDeleteLinkedDocModal"
    v-model="showDeleteLinkedDocModal"
    :doctype="'GAMCS Relationship'"
    :docname="relationshipId"
    :title="title"
    name="Relationships"
  />
</template>

<script setup>
import DeleteLinkedDocModal from '@/components/DeleteLinkedDocModal.vue'
import ErrorPage from '@/components/ErrorPage.vue'
import Icon from '@/components/Icon.vue'
import Resizer from '@/components/Resizer.vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import LinkIcon from '@/components/Icons/LinkIcon.vue'
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import AssignTo from '@/components/AssignTo.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import { openWebsite, copyToClipboard } from '@/utils'
import { getView } from '@/utils/view'
import { getSettings } from '@/stores/settings'
import { relationshipStagesStore } from '@/stores/relationshipStages'
import { useDocument } from '@/data/document'
import {
  createResource,
  Dropdown,
  Avatar,
  Tabs,
  Breadcrumbs,
  usePageMeta,
  toast,
} from 'frappe-ui'
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import { useUnsavedChangesWarning } from '@/composables/useUnsavedChangesWarning'
import { useVisitedRecords } from '@/composables/useVisitedRecords'

const { brand } = getSettings()
const { getStage, stageOptions } = relationshipStagesStore()
const route = useRoute()
const router = useRouter()

const props = defineProps({
  relationshipId: { type: String, required: true },
})

const errorTitle = ref('')
const errorMessage = ref('')
const showDeleteLinkedDocModal = ref(false)
const reload = ref(false)
const activities = ref(null)

const { assignees, permissions, document, error } = useDocument(
  'GAMCS Relationship',
  props.relationshipId,
)
const canDelete = computed(() => permissions.data?.permissions?.delete || false)
const doc = computed(() => document.doc || {})

useUnsavedChangesWarning(() => document.isDirty)

watch(error, (err) => {
  errorTitle.value = err
    ? __(
        err.exc_type == 'DoesNotExistError'
          ? 'Document Not Found'
          : 'Error Occurred',
      )
    : ''
  errorMessage.value = err ? __(err.messages?.[0] || 'An Error Occurred') : ''
})

const organizationDocument = ref(null)
watch(
  () => doc.value.organization,
  (org) => {
    if (org && !organizationDocument.value?.doc) {
      organizationDocument.value = useDocument('CRM Organization', org).document
    }
  },
  { immediate: true },
)
const organization = computed(() => organizationDocument.value?.doc || {})

const title = computed(() => doc.value?.organization || props.relationshipId)

const { markVisited } = useVisitedRecords('GAMCS Relationship')
onMounted(() => markVisited(props.relationshipId))

usePageMeta(() => ({ title: title.value, icon: brand.favicon }))

const breadcrumbs = computed(() => {
  const items = [
    { label: __('Relationships'), route: { name: 'Relationships' } },
  ]
  if (route.query.view || route.query.viewType) {
    const view = getView(
      route.query.view,
      route.query.viewType,
      'GAMCS Relationship',
    )
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'Relationships',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }
  items.push({
    label: title.value,
    route: {
      name: 'Relationship',
      params: { relationshipId: props.relationshipId },
      query: route.query,
    },
  })
  return items
})

const tabs = computed(() => [
  { name: 'Activity', label: __('Activity'), icon: ActivityIcon },
  { name: 'Comments', label: __('Comments'), icon: CommentIcon },
  { name: 'Data', label: __('Data'), icon: DetailsIcon },
  { name: 'Tasks', label: __('Tasks'), icon: TaskIcon },
  { name: 'Notes', label: __('Notes'), icon: NoteIcon },
  { name: 'Attachments', label: __('Attachments'), icon: AttachmentIcon },
])
const { tabIndex } = useActiveTabManager(tabs, 'lastRelationshipTab')

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  params: { doctype: 'GAMCS Relationship' },
  cache: ['sidepanel', 'GAMCS Relationship'],
  auto: true,
})

const opportunities = createResource({
  url: 'gamcs_crm.api.relationship.get_opportunities',
  params: { name: props.relationshipId },
  cache: ['relationship-opportunities', props.relationshipId],
  auto: true,
})

function inr(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
    value || 0,
  )
}

async function triggerStageChange(stage) {
  document.doc.stage = stage
  await document.save.submit()
  reloadResources()
}

function reloadResources() {
  assignees.reload()
  reload.value = true
  opportunities.reload()
}
</script>
