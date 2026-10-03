import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage"

export const metadata: Metadata = {
  title: "Refund Policy | Hayesh",
  description:
    "When you can get a refund on Hayesh: tuition subscriptions, marketplace gigs held in escrow, AI Studio orders and registration fees.",
}

const sections: LegalSection[] = [
  {
    id: "tuition",
    heading: "Tuition",
    body: (
      <>
        <p>Every parent can book a free demo lesson first, so you can decide before you pay.</p>
        <ul>
          <li><strong>Before the first paid lesson:</strong> cancel and receive a full refund.</li>
          <li><strong>After lessons have started:</strong> the unused part of the month may be refunded pro-rata, at Hayesh&apos;s discretion, after we consider lessons already delivered and the reason for cancelling.</li>
          <li>If a teacher cannot deliver lessons or is removed from the platform, we will refund the unused balance or help you move to another teacher.</li>
          <li>Cancelling stops future renewals. A renewal that has already been paid is refunded only under the rules above.</li>
        </ul>
      </>
    ),
  },
  {
    id: "gigs",
    heading: "Marketplace gigs",
    body: (
      <>
        <p>
          Your payment is held in escrow by Hayesh until you accept the delivery, so the seller is not paid yet.
        </p>
        <ul>
          <li><strong>Before acceptance:</strong> if the work does not match the order, first request a revision. If that does not solve it, open a dispute. A Hayesh admin reviews it and either refunds you or releases the payment to the seller.</li>
          <li><strong>After acceptance:</strong> payments are final and not refundable. Delivery also counts as accepted automatically after the auto-accept period (3 days by default) unless you act.</li>
          <li>If a seller does not deliver on time, you can cancel and be refunded through a dispute.</li>
        </ul>
      </>
    ),
  },
  {
    id: "ai-studio",
    heading: "HayeshAI Studio",
    body: (
      <ul>
        <li>If generation fails, we will regenerate your output or refund you.</li>
        <li>Once an output has been delivered it is not refundable, unless it is defective, for example empty, broken or clearly not what the service describes.</li>
        <li>Dissatisfaction with the style or accuracy of an AI output alone is not a defect.</li>
      </ul>
    ),
  },
  {
    id: "registration",
    heading: "Registration fees",
    body: (
      <ul>
        <li>Teacher and seller registration fees are <strong>refundable if your application is rejected</strong>.</li>
        <li>Once you are approved, the fee is <strong>non-refundable</strong>.</li>
      </ul>
    ),
  },
  {
    id: "timelines",
    heading: "How refunds are paid",
    body: (
      <>
        <p>
          Approved refunds are returned through the original payment channel within 5 to 10 business days. Bank,
          IBFT, JazzCash and Easypaisa refunds go back to the account you paid from; card refunds go back to your
          card via Stripe and may take longer to show on your statement.
        </p>
        <p>
          To ask for a refund, open a dispute on your order or contact us through the{" "}
          <Link href="/contact">Contact page</Link>, quoting your payment reference code.
        </p>
      </>
    ),
  },
]

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund Policy"
      intro={
        <p>
          This policy explains when and how you can get your money back on Hayesh. It applies together with our{" "}
          <Link href="/terms" className="text-accent-secondary underline">
            Terms of Service
          </Link>
          .
        </p>
      }
      sections={sections}
    />
  )
}
