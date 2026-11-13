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
import { usersStore } from '@/stores/users' // GAMCS
import { getActivePinia } from 'pinia' // GAMCS
import router from '@/router'

export const navigationItems = [
  {
    label: 'Dashboard',
    icon: LucideLayoutDashboard,
    route: 'Dashboard',
    desktopOnly: true,
  },
  { label: 'Leads', icon: LeadsIcon, route: 'Leads' },
  { label: 'Deals', icon: DealsIcon, route: 'Deals' },
  { label: 'Contacts', icon: ContactsIcon, route: 'Contacts' },
  { label: 'Organizations', icon: OrganizationsIcon, route: 'Organizations' },
  // GAMCS: F1 relationships, F2 follow-up queue (sidebar adds the count badge), F16 audit log
  { label: 'Relationships', icon: LucideHandshake, route: 'Relationships' },
  { label: 'Follow-ups', icon: LucideListChecks, route: 'FollowUps' },
  {
    label: 'Audit log',
    icon: LucideScrollText,
    route: 'AuditLog',
    // no store outside the app (unit tests): hide rather than throw
    condition: () => Boolean(getActivePinia()) && usersStore().isManager(),
  },
  { label: 'Notes', icon: NoteIcon, route: 'Notes' },
  { label: 'Tasks', icon: TaskIcon, route: 'Tasks' },
  { label: 'Call Logs', icon: PhoneIcon, route: 'Call Logs' },
]

export function getNavigationItems({ mobile = false } = {}) {
  return navigationItems.filter(
    (item) =>
      router.hasRoute(item.route) &&
      (!mobile || !item.desktopOnly) &&
      (!item.condition || item.condition()), // GAMCS: condition
  )
}
