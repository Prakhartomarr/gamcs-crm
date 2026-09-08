<!-- GAMCS: partner relationships list + Kanban (F1), adapted from Deals.vue -->
<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs v-model="viewControls" routeName="Relationships" />
    </template>
    <template #right-header>
      <CustomActions
        v-if="listView?.customListActions"
        :actions="listView.customListActions"
      />
      <Button
        variant="solid"
        :label="__('Create')"
        iconLeft="plus"
        @click="showModal = true"
      />
    </template>
  </LayoutHeader>
  <ViewControls
    ref="viewControls"
    v-model="relationships"
    v-model:loadMore="loadMore"
    v-model:resizeColumn="triggerResize"
    v-model:updatedPageCount="updatedPageCount"
    doctype="GAMCS Relationship"
    :options="{ allowedViews: ['list', 'group_by', 'kanban'] }"
  />
  <KanbanView
    v-if="route.params.viewType == 'kanban'"
    v-model="relationships"
    :options="{
      getRoute: (row) => ({
        name: 'Relationship',
        params: { relationshipId: row.name },
        query: { view: route.query.view, viewType: route.params.viewType },
      }),
      onNewClick: (column) => onNewClick(column),
    }"
    @update="(data) => viewControls.updateKanbanSettings(data)"
    @loadMore="(columnName) => viewControls.loadMoreKanban(columnName)"
  >
    <template #title="{ titleField, itemName }">
      <div class="flex gap-2 items-center">
        <div v-if="titleField === 'stage'">
          <IndicatorIcon :class="getRow(itemName, titleField).color" />
        </div>
        <div
          v-else-if="
            titleField === 'organization' && getRow(itemName, titleField).label
          "
        >
          <Avatar
            class="flex items-center"
            :image="getRow(itemName, titleField).logo"
            :label="getRow(itemName, titleField).label"
            size="sm"
          />
        </div>
        <div
          v-if="['modified', 'creation'].includes(titleField)"
          class="truncate text-base"
        >
          <Tooltip :text="getRow(itemName, titleField).label">
            <div>{{ getRow(itemName, titleField).timeAgo }}</div>
          </Tooltip>
        </div>
        <div
          v-else-if="getRow(itemName, titleField).label"
          class="truncate text-base"
        >
          {{ getRow(itemName, titleField).label }}
        </div>
        <div v-else class="text-ink-gray-4">{{ __('No Title') }}</div>
      </div>
    </template>

    <template #fields="{ fieldName, itemName }">
      <div
        v-if="getRow(itemName, fieldName).label"
        class="truncate flex items-center gap-2"
      >
        <div v-if="fieldName === 'stage'">
          <IndicatorIcon :class="getRow(itemName, fieldName).color" />
        </div>
        <div v-else-if="fieldName === 'relationship_owner'">
          <Avatar
            v-if="getRow(itemName, fieldName).full_name"
            class="flex items-center"
            :image="getRow(itemName, fieldName).user_image"
            :label="getRow(itemName, fieldName).full_name"
            size="xs"
          />
        </div>
        <div
          v-if="['modified', 'creation'].includes(fieldName)"
          class="truncate text-base"
        >
          <Tooltip :text="getRow(itemName, fieldName).label">
            <div>{{ getRow(itemName, fieldName).timeAgo }}</div>
          </Tooltip>
        </div>
        <div
          v-else-if="fieldName === '_assign'"
          class="flex items-center truncate"
        >
          <MultipleAvatar
            :avatars="getRow(itemName, fieldName).label"
            size="xs"
          />
        </div>
        <div v-else class="truncate text-base">
          {{ getRow(itemName, fieldName).label }}
        </div>
      </div>
    </template>

    <template #actions="{ itemName }">
      <div class="flex gap-2 items-center justify-between">
        <div class="text-ink-gray-5 flex items-center gap-1.5">
          <NoteIcon class="h-4 w-4" />
          <span v-if="getRow(itemName, '_note_count').label">
            {{ getRow(itemName, '_note_count').label }}
          </span>
          <span class="text-4xl leading-[0]"> &middot; </span>
          <TaskIcon class="h-4 w-4" />
          <span v-if="getRow(itemName, '_task_count').label">
            {{ getRow(itemName, '_task_count').label }}
          </span>
        </div>
        <Dropdown
          class="flex items-center gap-2"
          :options="actions(itemName)"
          variant="ghost"
          @click.stop.prevent
        >
          <Button icon="lucide-plus" variant="ghost" />
        </Dropdown>
      </div>
    </template>
  </KanbanView>
  <RelationshipsListView
    v-else-if="relationships.data && rows.length"
    ref="listView"
    v-model="relationships.data.page_length_count"
    v-model:list="relationships"
    :rows="rows"
    :columns="columns"
    :options="{
      showTooltip: false,
      resizeColumn: true,
      rowCount: relationships.data.row_count,
      totalCount: relationships.data.total_count,
    }"
    @loadMore="() => loadMore++"
    @columnWidthUpdated="() => triggerResize++"
    @updatePageCount="(count) => (updatedPageCount = count)"
    @applyFilter="(data) => viewControls.applyFilter(data)"
    @selectionsChanged="
      (selections) => viewControls.updateSelections(selections)
    "
  />
  <EmptyState
    v-else-if="relationships.data && !rows.length"
    name="Relationships"
    :icon="LucideHandshake"
  />
  <RelationshipModal
    v-if="showModal"
    v-model="showModal"
    :defaults="defaults"
  />
</template>

<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import MultipleAvatar from '@/components/MultipleAvatar.vue'
import CustomActions from '@/components/CustomActions.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import LucideHandshake from '~icons/lucide/handshake'
import LayoutHeader from '@/components/LayoutHeader.vue'
import RelationshipsListView from '@/components/ListViews/RelationshipsListView.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import KanbanView from '@/components/Kanban/KanbanView.vue'
import RelationshipModal from '@/components/Modals/RelationshipModal.vue'
import ViewControls from '@/components/ViewControls.vue'
import { useDoctypeModal } from '@/composables/doctypeModal'
import { usersStore } from '@/stores/users'
import { organizationsStore } from '@/stores/organizations'
import { relationshipStagesStore } from '@/stores/relationshipStages'
import { formatDate } from '@/utils'
import { timestampCell } from '@/composables/useTimelinePreferences'
import { Tooltip, Avatar, Dropdown } from 'frappe-ui'
import { useRoute } from 'vue-router'
import { ref, reactive, computed, h } from 'vue'

const { getUser } = usersStore()
const { getOrganization } = organizationsStore()
const { getStage } = relationshipStagesStore()
const { showModal: showDoctypeModal } = useDoctypeModal()

const route = useRoute()

const listView = ref(null)
const showModal = ref(false)
const defaults = reactive({})

// data is loaded in the ViewControls component
const relationships = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)

function getRow(name, field) {
  const value = rows.value?.find((row) => row.name == name)?.[field]
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  return { label: value }
}

const rows = computed(() => {
  const data = relationships.value?.data
  if (!data?.data) return []
  if (data.view_type === 'group_by') {
    if (!data.group_by_field?.fieldname) return []
    return getGroupedByRows(data.data, data.group_by_field, data.columns)
  } else if (data.view_type === 'kanban') {
    return parseRows(
      data.data.flatMap((column) => column.data || []),
      data.fields,
    )
  }
  return parseRows(data.data, data.columns)
})

const columns = computed(() => {
  let _columns = relationships.value?.data?.columns || []
  return _columns.map((col, index) =>
    index === _columns.length - 1 ? { ...col, align: 'right' } : col,
  )
})

function getGroupedByRows(listRows, groupByField, columns) {
  return (groupByField.options || []).map((option) => {
    const filtered = option
      ? listRows.filter((row) => row[groupByField.fieldname] == option)
      : listRows.filter((row) => !row[groupByField.fieldname])
    const group = {
      label: groupByField.label,
      group: option || __(' '),
      collapsed: false,
      rows: parseRows(filtered, columns),
    }
    if (groupByField.fieldname == 'stage') {
      group.icon = () => h(IndicatorIcon, { class: getStage(option)?.color })
    }
    return group
  })
}

function parseRows(list, columns = []) {
  const view_type = relationships.value.data.view_type
  const key = view_type === 'kanban' ? 'fieldname' : 'key'
  const type = view_type === 'kanban' ? 'fieldtype' : 'type'

  return list.map((rel) => {
    const _row = {}
    relationships.value.data.rows.forEach((field) => {
      _row[field] = rel[field]
      const fieldType = columns?.find(
        (col) => (col[key] || col.value) == field,
      )?.[type]
      if (
        fieldType &&
        ['Date', 'Datetime'].includes(fieldType) &&
        !['modified', 'creation'].includes(field)
      ) {
        _row[field] = formatDate(rel[field], '', true, fieldType == 'Datetime')
      }
      if (field == 'organization') {
        _row[field] = {
          label: rel.organization,
          logo: getOrganization(rel.organization)?.organization_logo,
        }
      } else if (field == 'stage') {
        _row[field] = { label: rel.stage, color: getStage(rel.stage)?.color }
      } else if (field == 'relationship_owner') {
        _row[field] = {
          label:
            rel.relationship_owner && getUser(rel.relationship_owner).full_name,
          ...(rel.relationship_owner && getUser(rel.relationship_owner)),
        }
      } else if (field == '_assign') {
        _row[field] = JSON.parse(rel._assign || '[]').map((user) => ({
          name: user,
          image: getUser(user).user_image,
          label: getUser(user).full_name,
        }))
      } else if (['modified', 'creation'].includes(field)) {
        _row[field] = timestampCell(rel[field])
      }
    })
    _row['_note_count'] = rel._note_count
    _row['_task_count'] = rel._task_count
    return _row
  })
}

function onNewClick(column) {
  const column_field = relationships.value.params.column_field
  if (column_field) defaults[column_field] = column.column.name
  showModal.value = true
}

function actions(itemName) {
  return [
    {
      icon: h(NoteIcon, { class: 'h-4 w-4' }),
      label: __('New Note'),
      onClick: () => showLinked('FCRM Note', 'Note', itemName),
    },
    {
      icon: h(TaskIcon, { class: 'h-4 w-4' }),
      label: __('New Task'),
      onClick: () => showLinked('CRM Task', 'Task', itemName),
    },
  ]
}

function showLinked(doctype, title, name) {
  showDoctypeModal({
    doctype,
    title,
    defaults: {
      reference_doctype: 'GAMCS Relationship',
      reference_docname: name,
    },
  })
}
</script>
