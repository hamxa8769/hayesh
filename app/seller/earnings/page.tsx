// Sellers use the same escrow-aware earnings view as teachers: balance,
// withdrawal request, withdrawal history. Everything is keyed on the signed-in
// user's id (transactions.payee_id / payouts.recipient_id), not the role.
export { default } from "@/app/teacher/earnings/page"
