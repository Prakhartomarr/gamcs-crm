<!-- GAMCS: create a partner relationship (F1, D1), adapted from LeadModal.vue -->
<template>
  <Dialog v-model:open="show" :size="'3xl'">
    <template #body>
      <div class="bg-surface-elevation-1 px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-5 flex items-center justify-between">
          <h3 class="text-3xl-semibold leading-6 text-ink-gray-9">
            {{ __('Create Relationship') }}
          </h3>
          <div class="flex items-center gap-1">
            <Button
              v-if="isManager() && !isMobileView"
              variant="ghost"
              class="w-7"
              :tooltip="__('Edit Fields Layout')"
              :icon="EditIcon"
              @click="openQuickEntryModal"
            />
            <Button
              variant="ghost"
              class="w-7"
              icon="lucide-x"
              @click="show = false"
            />
          </div>
        </div>
        <div>
          <FieldLayout
            v-if="tabs.data"
            :tabs="tabs.data"
            :data="relationship.doc"
            doctype="GAMCS Relationship"
          />
          <ErrorMessage v-if="error" class="mt-4" :message="__(error)" />
        </div>
      </div>
      <div class="px-4 pb-7 pt-4 sm:px-6">
        <div class="flex flex-row-reverse gap-2">
          <Button
            variant="solid"
            :label="__('Create')"
            :loading="isCreating"
            @click="createRelationship"
          />
        </div>
      </div>
    </template>
  </Dialog>
  <DuplicateModal
    v-if="showDuplicates"
    v-model="showDuplicates"
    :matches="duplicates"
    @proceed="createAnyway"
  /><!-- GAMCS F11 -->
</template>
<script setup>
// GAMCS F11: ask the server for probable duplicates before inserting; "Create anyway" records the override
import DuplicateModal from '@/components/Modals/DuplicateModal.vue'
import { call as checkDuplicatesCall } from 'frappe-ui'
import EditIcon from '@/components/Icons/EditIcon.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import { usersStore } from '@/stores/users'
import { relationshipStagesStore } from '@/stores/relationshipStages'
import { isMobileView } from '@/composables/settings'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { createResource } from 'frappe-ui'
import { useDocument } from '@/data/document'
import { onMounted, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  defaults: { type: Object, default: () => ({}) },
})

const { getUser, isManager } = usersStore()
const { getStage, stageOptions } = relationshipStagesStore()

const show = defineModel({ type: Boolean })
const router = useRouter()
const error = ref(null)
const isCreating = ref(false)

const { document: relationship } = useDocument('GAMCS Relationship')

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'GAMCS Relationship'],
  params: { doctype: 'GAMCS Relationship', type: 'Quick Entry' },
  auto: true,
  transform: (_tabs) => {
    return _tabs.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          column.fields.forEach((field) => {
            if (field.fieldname == 'stage') {
              field.fieldtype = 'Select'
              field.options = stageOptions()
              field.prefix = getStage(relationship.doc.stage).color
            }
            if (field.fieldtype === 'Table') {
              relationship.doc[field.fieldname] = []
            }
          })
        })
      })
    })
  },
})

const duplicates = ref([]) // GAMCS F11
const showDuplicates = ref(false)
async function hasDuplicates() {
  if (relationship.doc.duplicate_override_of) return false
  const matches = await checkDuplicatesCall('gamcs_crm.api.duplicates.check', {
    doctype: 'GAMCS Relationship',
    values: relationship.doc,
  })
  if (!matches?.length) return false
  duplicates.value = matches
  showDuplicates.value = true
  return true
}
function createAnyway(ref) {
  relationship.doc.duplicate_override_of = ref
  createRelationship()
}
const insert = createResource({ url: 'frappe.client.insert' })

async function createRelationship() {
  if (await hasDuplicates()) return // GAMCS F11
  insert.submit(
    { doc: { doctype: 'GAMCS Relationship', ...relationship.doc } },
    {
      validate() {
        error.value = null
        if (!relationship.doc.organization)
          return (error.value = __('Organization is mandatory'))
        if (!relationship.doc.relationship_type)
          return (error.value = __('Relationship Type is mandatory'))
        if (!relationship.doc.stage)
          return (error.value = __('Stage is mandatory'))
        isCreating.value = true
      },
      onSuccess(data) {
        isCreating.value = false
        show.value = false
        relationship.doc = {}
        router.push({
          name: 'Relationship',
          params: { relationshipId: data.name },
        })
      },
      onError(err) {
        isCreating.value = false
        error.value = err.messages?.join('\n') || err.message
      },
    },
  )
}

function openQuickEntryModal() {
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: 'GAMCS Relationship' }
  nextTick(() => (show.value = false))
}

onMounted(() => {
  Object.assign(relationship.doc, props.defaults)
  if (!relationship.doc.relationship_owner) {
    relationship.doc.relationship_owner = getUser().name
  }
  if (!relationship.doc.stage && stageOptions()[0]?.value) {
    relationship.doc.stage = stageOptions()[0].value
  }
})
</script>
