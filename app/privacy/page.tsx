import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage"
import { SITE_INFO } from "@/lib/site-info"

export const metadata: Metadata = {
  title: "Privacy Policy | Hayesh",
  description:
    "What personal data Hayesh collects, including children's data and payment proofs, how it is used and protected, and your rights.",
}

const sections: LegalSection[] = [
  {
    id: "collect",
    heading: "What we collect",
    body: (
      <>
        <ul>
          <li><strong>Account data:</strong> name, email, phone, country, role and password (stored hashed by our auth provider).</li>
          <li><strong>Teacher and seller data:</strong> qualifications, profile text, photos, identity documents and payout details. Bank account numbers are encrypted.</li>
          <li><strong>Children&apos;s data:</strong> a child&apos;s name, subject, grade and lesson progress, provided by their parent or guardian. We collect it only from the parent.</li>
          <li><strong>Payment data:</strong> transaction records, reference codes and the proof of payment you upload (screenshots or receipts). Card details are handled by Stripe and never stored by us.</li>
          <li><strong>Orders and messages:</strong> gig requirements, deliveries, AI Studio inputs and outputs, and messages sent on the platform.</li>
          <li><strong>Video sessions:</strong> live lessons run over video. Recordings are made only when the feature is enabled, and participants are told when recording is on.</li>
          <li><strong>Technical data:</strong> device, browser, IP address and usage logs.</li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    heading: "How we use it",
    body: (
      <ul>
        <li>To run the platform: accounts, bookings, lessons, orders, escrow and payouts.</li>
        <li>To verify teachers, sellers and payments, and to prevent fraud and abuse.</li>
        <li>To resolve disputes and provide support.</li>
        <li>To send service emails such as receipts, renewal reminders and order updates.</li>
        <li>To generate AI Studio outputs and power in-app assistants.</li>
        <li>To improve security and performance. We do not sell personal data.</li>
      </ul>
    ),
  },
  {
    id: "processors",
    heading: "Who processes data for us",
    body: (
      <>
        <p>We share data only with providers that help us run Hayesh:</p>
        <ul>
          <li><strong>Supabase</strong> for database, authentication and file storage.</li>
          <li><strong>Stripe</strong> for card payments.</li>
          <li><strong>LiveKit</strong> for video lessons.</li>
          <li><strong>Anthropic and OpenRouter</strong> for AI features. AI Studio inputs are sent to them to generate your output.</li>
          <li><strong>Resend</strong> for sending email.</li>
        </ul>
        <p>
          These providers may process data outside Pakistan. We may also disclose data when required by law or to
          protect people&apos;s safety.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    heading: "How long we keep it",
    body: (
      <p>
        We keep account data while your account is open. Transaction and payment records are kept for as long as
        needed for accounting, tax and dispute purposes. Payment proofs and recordings are kept only as long as
        necessary for verification, disputes and safety, then deleted. When you delete your account we remove or
        anonymise personal data, except what we must keep by law.
      </p>
    ),
  },
  {
    id: "security",
    heading: "Security",
    body: (
      <p>
        Data is stored with access controls so people only see what they should: payment proofs are in private
        storage, bank account numbers are encrypted, and connections use HTTPS. No system is perfectly secure; if
        a breach affects you, we will tell you as the law requires.
      </p>
    ),
  },
  {
    id: "rights",
    heading: "Your rights",
    body: (
      <>
        <p>
          You can ask to access, correct or delete your personal data, and to withdraw consent. Parents can do this
          for their children&apos;s data, and can ask us to delete it at any time. Contact us using the details
          below and we will respond within a reasonable time. Some data we must keep by law, and deleting data
          needed to deliver an active order or plan may end that service.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies",
    body: (
      <p>
        We use essential cookies and similar storage to keep you signed in and remember preferences. We do not use
        advertising cookies. You can block cookies in your browser, but sign-in will not work without them.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <p>
        For privacy requests or questions, use the <Link href="/contact">Contact page</Link>
        {SITE_INFO.supportEmail ? <> or email {SITE_INFO.supportEmail}</> : null}. We may update this policy; the
        date at the top shows the current version.
      </p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what personal data {SITE_INFO.legalName} (&quot;Hayesh&quot;) collects when you use
          our tutoring, marketplace and AI services, why we collect it, and the choices you have.
        </p>
      }
      sections={sections}
    />
  )
}
