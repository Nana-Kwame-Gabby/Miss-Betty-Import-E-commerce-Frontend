import { Link } from "react-router-dom";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1e2d3d] text-white py-10 px-4 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-300 text-sm">Last updated: June 2025</p>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14 space-y-8 text-gray-700 text-sm sm:text-base leading-relaxed">

        <section>
          <p>
            Miss Betty Import (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a duly registered business
            under the laws of the Republic of Ghana. We are committed to protecting the personal
            information of our customers and operating in compliance with Ghana&rsquo;s{" "}
            <strong>Data Protection Act, 2012 (Act 843)</strong>. This Privacy Policy explains
            what data we collect, why we collect it, and how it is used.
          </p>
        </section>

        <Section title="1. Information We Collect">
          <p>When you create an account or place an order, we collect the following personal information:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Full name</strong></li>
            <li><strong>Email address</strong></li>
            <li><strong>Phone number</strong></li>
            <li><strong>Delivery region and town/city</strong> (within Ghana)</li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> collect or store payment card details. All payment
            transactions are handled directly by <strong>Hubtel</strong>, our third-party
            payment processor. Please refer to Hubtel&rsquo;s privacy policy for details on how
            they process your payment information.
          </p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use your personal information solely for the following purposes:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Processing and fulfilling your orders</li>
            <li>Coordinating delivery to your specified location</li>
            <li>Communicating with you about your orders (status updates, confirmations)</li>
            <li>Responding to enquiries and customer support requests</li>
            <li>Maintaining records as required for legitimate business operations</li>
          </ul>
          <p className="mt-3">
            We do not use your data for marketing without your explicit consent, and we do not
            sell or rent your personal information to any third party.
          </p>
        </Section>

        <Section title="3. Third-Party Services">
          <p>We use the following trusted third-party services to operate our platform:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Supabase</strong> — our database and authentication provider. Your account
              and order data is stored on Supabase infrastructure hosted in the European Union
              (Stockholm, Sweden). Supabase complies with GDPR and maintains appropriate
              security standards.
            </li>
            <li>
              <strong>Hubtel</strong> — our payment processor for mobile money and card payments.
              Payment data is processed and held by Hubtel and is not shared with us beyond
              transaction confirmation.
            </li>
            <li>
              <strong>Vercel</strong> — our website hosting provider. Vercel may process request
              logs (including IP addresses) as part of serving the website.
            </li>
          </ul>
        </Section>

        <Section title="4. Data Retention">
          <p>
            We retain your personal information for as long as your account is active or as
            needed to fulfil the purposes described in this policy. Order records may be
            retained for up to <strong>7 years</strong> to comply with Ghana&rsquo;s business
            record-keeping requirements. You may request deletion of your account and associated
            data at any time (see Section 5).
          </p>
        </Section>

        <Section title="5. Your Rights">
          <p>
            Under Ghana&rsquo;s Data Protection Act, 2012 (Act 843), you have the following rights
            regarding your personal data:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Right of access</strong> — request a copy of the personal data we hold about you</li>
            <li><strong>Right to correction</strong> — ask us to correct inaccurate or incomplete data</li>
            <li><strong>Right to deletion</strong> — request that we delete your personal data, subject to legal retention obligations</li>
            <li><strong>Right to object</strong> — object to the processing of your data in certain circumstances</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, please contact us using the details in Section 7.
          </p>
        </Section>

        <Section title="6. Data Security">
          <p>
            We take reasonable technical and organisational measures to protect your personal
            information from unauthorised access, loss, or misuse. These include encrypted
            data transmission (HTTPS), secure authentication via Supabase Auth, and
            restricted access to personal data within our systems. However, no online platform
            can guarantee absolute security, and you use our services at your own risk.
          </p>
        </Section>

        <Section title="7. Contact Us">
          <p>
            If you have any questions about this Privacy Policy, wish to exercise your data
            rights, or have a complaint about how we handle your personal information, please
            contact us:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>WhatsApp:</strong>{" "}
              <a
                href="https://wa.me/233202697541"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#F2AA25] hover:underline"
              >
                +233 20 269 7541
              </a>
            </li>
            <li>
              <strong>Contact form:</strong>{" "}
              <Link to="/contact" className="text-[#F2AA25] hover:underline">
                missbettyimport.vercel.app/contact
              </Link>
            </li>
          </ul>
          <p className="mt-3">
            We aim to respond to all data-related requests within <strong>14 days</strong>.
          </p>
        </Section>

        <Section title="8. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our
            practices or legal obligations. The &ldquo;Last updated&rdquo; date at the top of this page
            will reflect the most recent revision. Continued use of our platform after any
            changes constitutes your acceptance of the updated policy.
          </p>
        </Section>

        {/* Back link */}
        <div className="pt-4 border-t border-gray-200">
          <Link to="/" className="text-[#F2AA25] hover:underline text-sm">
            &larr; Back to Home
          </Link>
        </div>
      </div>

      {/* Simple footer */}
      <div className="bg-[#1e2d3d] text-center text-gray-500 text-xs py-5 px-4">
        © {new Date().getFullYear()} Miss Betty Import. All rights reserved.
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base sm:text-lg font-semibold text-[#1e2d3d]">{title}</h2>
      {children}
    </section>
  );
}
