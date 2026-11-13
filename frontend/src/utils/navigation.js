import ContactsIcon from '@/components/Icons/ContactsIcon.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import OrganizationsIcon from '@/components/Icons/OrganizationsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import LucideLayoutDashboard from '~icons/lucide/layout-dashboard'
import LucideHandshake from '~icons/lucide/handshake' // GAMCS
import LucideListChecks from '~icons/lucide/list-checks' // GAMCS
import LucideScrollText from '~icons/lucide/scroll-text' // GAMCS
import LucideClipboardCheck from '~icons/lucide/clipboard-check' // GAMCS E65
import { usersStore } from '@/stores/users' // GAMCS
import { getActivePinia } from 'pinia' // GAMCS
import router from '@/router'

// GAMCS: grouped and ordered by how the team works (today → pipeline → people → activity)
export const navigationItems = [
  {
    label: 'Dashboard',
    icon: LucideLayoutDashboard,
    route: 'Dashboard',
    desktopOnly: true,
    group: 'Today',
  },
  // GAMCS F2: follow-up queue (sidebar adds the count badge)
  { label: 'Follow-ups', icon: LucideListChecks, route: 'FollowUps', group: 'Today' },
  { label: 'Tasks', icon: TaskIcon, route: 'Tasks', group: 'Today' },
  { label: 'Leads', icon: LeadsIcon, route: 'Leads', group: 'Pipeline' },
  { label: 'Deals', icon: DealsIcon, route: 'Deals', group: 'Pipeline' },
  // GAMCS F1
  { label: 'Relationships', icon: LucideHandshake, route: 'Relationships', group: 'Pipeline' },
  // GAMCS E65: onboarding and billed revenue after Won
  { label: 'Engagements', icon: LucideClipboardCheck, route: 'Engagements', group: 'Pipeline' },
  { label: 'Contacts', icon: ContactsIcon, route: 'Contacts', group: 'People' },
  { label: 'Organizations', icon: OrganizationsIcon, route: 'Organizations', group: 'People' },
  { label: 'Notes', icon: NoteIcon, route: 'Notes', group: 'Records' },
  { label: 'Call logs', icon: PhoneIcon, route: 'Call Logs', group: 'Records' },
  // GAMCS F16
  {
    label: 'Audit log',
    icon: LucideScrollText,
    route: 'AuditLog',
    // no store outside the app (unit tests): hide rather than throw
    condition: () => Boolean(getActivePinia()) && usersStore().isManager(),
    group: 'Records',
  },
]

export function getNavigationItems({ mobile = false } = {}) {
  return navigationItems.filter(
    (item) =>
      router.hasRoute(item.route) &&
      (!mobile || !item.desktopOnly) &&
      (!item.condition || item.condition()), // GAMCS: condition
  )
}
