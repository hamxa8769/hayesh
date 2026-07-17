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
    { label: "Revenue this month", query: "Show me revenue for this month" },
    { label: "Pending approvals", query: "What teacher and seller approvals are pending?" },
    { label: "Platform health", query: "Give me a summary of platform health right now" },
    { label: "Open disputes", query: "Are there any open disputes I should look at?" },
  ],
  teacher: [
    { label: "This week's sessions", query: "What sessions do I have this week?" },
    { label: "My earnings", query: "How much have I earned this month?" },
    { label: "Rating trend", query: "How is my rating trending?" },
    { label: "Grow my students", query: "How can I get more students on my profile?" },
  ],
  parent: [
    { label: "Child's progress", query: "How is my child progressing?" },
    { label: "Find a teacher", query: "Help me find a teacher" },
    { label: "Next session", query: "When is my next session?" },
    { label: "Payment history", query: "Show my payment history" },
  ],
  seller: [
    { label: "Gig performance", query: "How are my gigs performing?" },
    { label: "Pending orders", query: "Show my pending orders" },
    { label: "Improve my gig", query: "How can I improve my gig listing?" },
    { label: "Earnings this month", query: "How much have I earned this month?" },
  ],
  buyer: [
    { label: "My orders", query: "Show my orders" },
    { label: "Track an order", query: "Track my latest order" },
    { label: "Recommend a gig", query: "Recommend a gig for me" },
    { label: "Refund policy", query: "How do refunds work?" },
  ],
}

export function getSuggestionsForRole(role: UserRole | undefined): JarvisSuggestion[] {
  if (!role) return ROLE_SUGGESTIONS.buyer
  return ROLE_SUGGESTIONS[role] ?? ROLE_SUGGESTIONS.buyer
}
