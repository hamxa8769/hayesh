import type { UserRole } from "@/types/database"

export type JarvisMessageRole = "user" | "assistant"

export interface JarvisMessage {
  id: string
  role: JarvisMessageRole
  content: string
  isError?: boolean
}

export interface JarvisSuggestion {
  label: string
  query: string
}

const ROLE_SUGGESTIONS: Record<UserRole, JarvisSuggestion[]> = {
  admin: [
    { label: "What needs attention?", query: "What needs my attention today?" },
    { label: "Revenue this month", query: "Show me platform revenue for this month" },
    { label: "Pending approvals", query: "What teacher and seller approvals are pending?" },
    { label: "Open disputes", query: "Are there any open disputes I should look at?" },
  ],
  teacher: [
    { label: "My earnings", query: "How much have I earned?" },
    { label: "Upcoming lessons", query: "What lessons do I have coming up?" },
    { label: "My students", query: "Who are my active students?" },
    { label: "Unread updates", query: "Do I have any unread notifications?" },
  ],
  parent: [
    { label: "Child's progress", query: "How is my child doing?" },
    { label: "Payments due", query: "Any payments due?" },
    { label: "Next lesson", query: "When is my next lesson?" },
    { label: "Find a teacher", query: "Help me find a teacher" },
  ],
  seller: [
    { label: "Orders due soon", query: "Which orders are due soon?" },
    { label: "My earnings", query: "How much have I earned?" },
    { label: "Unread updates", query: "Do I have any unread notifications?" },
    { label: "Improve my gig", query: "How can I improve my gig listing?" },
  ],
  buyer: [
    { label: "My orders", query: "Show my orders" },
    { label: "Payments due", query: "Any payments due?" },
    { label: "Find a service", query: "Recommend a service for me" },
    { label: "Find a teacher", query: "Help me find a teacher" },
  ],
}

export function getSuggestionsForRole(role: UserRole | undefined): JarvisSuggestion[] {
  if (!role) return ROLE_SUGGESTIONS.buyer
  return ROLE_SUGGESTIONS[role] ?? ROLE_SUGGESTIONS.buyer
}
