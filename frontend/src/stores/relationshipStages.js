// GAMCS: stage colours/options for GAMCS Relationship, same shape as stores/statuses.js
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import { parseColor } from '@/utils'
import { defineStore } from 'pinia'
import { createListResource } from 'frappe-ui'
import { reactive, h } from 'vue'

export const relationshipStagesStore = defineStore(
  'gamcs-relationship-stages',
  () => {
    const stagesByName = reactive({})

    const stages = createListResource({
      doctype: 'GAMCS Relationship Stage',
      fields: ['name', 'color', 'position', 'type'],
      orderBy: 'position asc',
      cache: 'gamcs-relationship-stages',
      initialData: [],
      auto: true,
      transform(rows) {
        for (let s of rows) {
          s.color = parseColor(s.color)
          stagesByName[s.name] = s
        }
        return rows
      },
    })

    function getStage(name) {
      if (!name) name = stages.data[0]?.name
      return stagesByName[name] || {}
    }

    function stageOptions(triggerChange = null) {
      return (stages.data || []).map((s) => ({
        label: s.name,
        value: s.name,
        icon: () => h(IndicatorIcon, { class: s.color }),
        onClick: async () => await triggerChange?.(s.name),
      }))
    }

    return { stages, getStage, stageOptions }
  },
)
