import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage"
import { SITE_INFO } from "@/lib/site-info"

export const metadata: Metadata = {
  title: "Terms of Service | Hayesh",
  description:
    "The rules for using Hayesh: accounts, tutoring subscriptions, marketplace orders and escrow, AI Studio, payments, commissions and disputes.",
}

const sections: LegalSection[] = [
  {
    id: "accounts",
    heading: "Accounts and roles",
    body: (
      <>
        <p>
          Hayesh offers three things on one platform: verified tutors, a freelance services marketplace, and
          HayeshAI Studio (AI-generated services). You can hold one or more roles: parent or student, teacher,
          seller, or buyer.
        </p>
        <ul>
          <li>You must provide accurate information and keep your login details private.</li>
          <li>You must be at least 18 to hold an account. Minors may only use Hayesh through a parent or guardian account.</li>
          <li>You are responsible for everything done through your account.</li>
        </ul>
      </>
    ),
  },
  {
    id: "verification",
    heading: "Teacher and seller verification",
    body: (
      <>
        <p>
          Teachers and sellers must be approved by Hayesh before they can be listed. We review profiles,
          qualifications and identity information, and we may refuse or revoke approval at our discretion.
        </p>
        <p>
          A one-time registration fee, set by Hayesh and shown before you pay, applies to teachers and sellers. See
          the <Link href="/refund-policy">Refund Policy</Link> for when it is refundable. Approval is not an
          endorsement or guarantee of any teacher&apos;s or seller&apos;s work.
        </p>
      </>
    ),
  },
  {
    id: "tuition",
    heading: "Tuition billing and cancellation",
    body: (
      <>
        <ul>
          <li>Parents may book a free demo lesson with a teacher before paying anything.</li>
          <li>Tuition is billed monthly, in advance. A renewal charge is issued 3 days before the current period ends.</li>
          <li>If a renewal is not paid by the end of the period, the plan becomes past due and lessons may be paused.</li>
          <li>You can cancel at any time; cancellation stops future renewals. Refunds for the current month follow the Refund Policy.</li>
        </ul>
        <p>Lessons take place on video through Hayesh. Missed lessons and rescheduling are arranged between parent and teacher.</p>
      </>
    ),
  },
  {
    id: "marketplace",
    heading: "Marketplace orders, escrow and disputes",
    body: (
      <>
        <p>
          Sellers list services as gigs with Basic, Standard and Premium packages. When you order, you pay Hayesh,
          not the seller. We hold the payment in escrow until you accept the delivery.
        </p>
        <ul>
          <li>The seller delivers within the package&apos;s delivery time. You may request revisions up to the number included in the package.</li>
          <li>You can accept the delivery at any time. If you do not respond, it is accepted automatically after a set number of days (3 by default).</li>
          <li>If something goes wrong, either party can open a dispute before acceptance. A Hayesh admin reviews the order and decides to release the payment to the seller or refund the buyer. That decision is final on the platform.</li>
        </ul>
      </>
    ),
  },
  {
    id: "ai-studio",
    heading: "HayeshAI Studio outputs",
    body: (
      <>
        <p>
          AI Studio services generate results automatically after payment, using third-party AI models. Outputs
          may contain errors, may be similar to other outputs, and are not professional advice.
        </p>
        <ul>
          <li>We do not guarantee accuracy, fitness for a purpose, or originality.</li>
          <li>You are responsible for checking an output and for how you use it.</li>
          <li>Do not submit personal data of others, or content you have no right to use, as inputs.</li>
        </ul>
      </>
    ),
  },
  {
    id: "payments",
    heading: "Payments and verification",
    body: (
      <>
        <p>
          You can pay by bank transfer, IBFT/Raast, JazzCash or Easypaisa, or by card through Stripe. Manual
          payments (bank, IBFT, JazzCash, Easypaisa) require you to submit a payment reference and proof; Hayesh
          verifies each one by hand, which can take time. Your order or plan is activated only after payment is
          confirmed.
        </p>
        <p>
          Submitting false, altered or reused proof is fraud and will lead to account suspension and possible legal
          action. Prices are shown in PKR or USD at checkout.
        </p>
      </>
    ),
  },
  {
    id: "commissions",
    heading: "Commissions and payouts",
    body: (
      <>
        <ul>
          <li>Hayesh deducts a commission from teacher earnings (15% by default) and seller earnings (18% by default). Rates may be changed by Hayesh and apply to future payments.</li>
          <li>Teacher and seller earnings become available after the relevant lesson payment is settled or the gig order is completed.</li>
          <li>Withdrawals are reviewed by Hayesh admins before payout. We may delay or withhold payouts that are under dispute, suspected of fraud, or required by law.</li>
        </ul>
      </>
    ),
  },
  {
    id: "conduct",
    heading: "Prohibited conduct",
    body: (
      <>
        <p>You must not:</p>
        <ul>
          <li>Ask for, offer or accept payment outside Hayesh for work or lessons found through Hayesh, or share contact details to avoid fees.</li>
          <li>Harass, threaten, deceive or discriminate against anyone.</li>
          <li>Post false qualifications, impersonate others, or create duplicate accounts to evade a ban.</li>
          <li>Upload illegal, infringing, sexual, hateful or malicious content.</li>
          <li>Scrape, attack or interfere with the platform, or abuse AI Studio to produce unlawful material.</li>
        </ul>
      </>
    ),
  },
  {
    id: "child-safety",
    heading: "Child safety and parental consent",
    body: (
      <>
        <p>
          Children can only be enrolled by a parent or legal guardian, who gives consent for the child&apos;s
          lessons and for us to process the child&apos;s information. Parents are responsible for supervising
          their child&apos;s use of video lessons.
        </p>
        <p>
          Teachers must keep all contact with children on Hayesh, behave professionally, and never ask for private
          contact details or meet a student outside agreed lessons. Report any concern through Support; we act on
          safety reports immediately and may suspend accounts while we investigate.
        </p>
      </>
    ),
  },
  {
    id: "content",
    heading: "Content and intellectual property",
    body: (
      <>
        <p>
          You keep ownership of content you upload. You give Hayesh a limited licence to host, display and process
          it to run the platform. Sellers grant buyers the rights described in the gig on payment completion.
          Hayesh&apos;s name, logo and software remain ours. Outputs from AI Studio are provided for your use,
          subject to these terms and any rights of third parties.
        </p>
        <p>Video lessons may be recorded when this feature is enabled; participants are informed when recording is on.</p>
      </>
    ),
  },
  {
    id: "suspension",
    heading: "Suspension and termination",
    body: (
      <p>
        We may suspend or close an account, remove listings, or withhold funds if you break these terms, put
        others at risk, or if required by law. You may close your account at any time, subject to settling open
        orders and plans.
      </p>
    ),
  },
  {
    id: "liability",
    heading: "Limits of liability",
    body: (
      <>
        <p>
          Teachers and sellers are independent providers, not employees of Hayesh. We do not guarantee any
          learning result or the quality of any service. The platform is provided &quot;as is&quot;.
        </p>
        <p>
          To the extent permitted by law, Hayesh is not liable for indirect or consequential loss, and our total
          liability for any claim is limited to the amount you paid through Hayesh for the transaction in question.
        </p>
      </>
    ),
  },
  {
    id: "law",
    heading: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of {SITE_INFO.jurisdiction}. Disputes that cannot be resolved through
        our dispute process are subject to the courts of {SITE_INFO.jurisdiction}.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    body: (
      <p>
        We may update these terms. The date at the top shows the latest version. Continuing to use Hayesh after a
        change means you accept it; for material changes we will notify you in-app or by email.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <p>
        Questions about these terms? See our <Link href="/contact">Contact page</Link>.
        {SITE_INFO.supportEmail ? <> You can also email {SITE_INFO.supportEmail}.</> : null}
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These terms are an agreement between you and {SITE_INFO.legalName} (&quot;Hayesh&quot;, &quot;we&quot;).
          By creating an account or using Hayesh you agree to them. Please read them together with the{" "}
          <Link href="/privacy" className="text-accent-secondary underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/refund-policy" className="text-accent-secondary underline">
            Refund Policy
          </Link>
          .
        </p>
      }
      sections={sections}
    />
  )
}
