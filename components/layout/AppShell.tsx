import { DashboardLayoutShell } from "@/components/layout/DashboardLayoutShell"
import type { UserRole } from "@/types/database"

const ALL_ROLES: UserRole[] = ["admin", "teacher", "parent", "seller", "buyer"]

/**
 * Dashboard chrome for pages every role uses (meetings, messages, orders,
 * checkout). The sidebar follows the signed-in user's real role, so these
 * pages never "drop you out" of your dashboard.
 */
export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <DashboardLayoutShell role="buyer" title={title} allowedRoles={ALL_ROLES}>
      {children}
    </DashboardLayoutShell>
  )
}
