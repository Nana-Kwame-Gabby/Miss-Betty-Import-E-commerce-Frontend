import { Link } from "react-router-dom";

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-base sm:text-lg font-semibold text-[#1e2d3d] mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1e2d3d] text-white py-10 px-4 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Terms and Conditions</h1>
        <p className="text-[#F2AA25] text-sm font-semibold">
          !! Read, understand and agree before placing an order !!
        </p>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14 space-y-8 text-gray-700 text-sm sm:text-base leading-relaxed">

        <Section title="1. Shipping Duration">
          <p>
            Sea shipping typically takes <strong>2–3 months</strong> to arrive in Ghana, excluding
            the month for taking orders. Air shipping takes <strong>2–3 weeks</strong>. Customers
            are advised to plan accordingly.
          </p>
        </Section>

        <Section title="2. Shipping Fee Payment">
          <p>
            Shipping fees will be communicated <strong>one month before</strong> the arrival of
            goods and must be paid in full <strong>within two weeks</strong> of notification.
            Failure to pay shipping fees may result in delays or penalties.
          </p>
          <p>
            Shipping fees are billed individually and given in Ghana Cedis. We calculate fees using
            the dollar rate provided by the shipping company — not banks, forex, or Google.
          </p>
        </Section>

        <Section title="3. Failure to Pay Shipping Fee">
          <p>
            If a customer fails to pay the shipping fee within the stipulated two-week period, the
            goods will be <strong>auctioned off</strong> and the customer will be entitled to a{" "}
            <strong>full refund</strong>.
          </p>
        </Section>

        <Section title="4. Delivery / Pickup">
          <p>
            Customers are responsible for providing accurate delivery details. Miss Betty Import
            will not be liable for any losses resulting from incorrect delivery information.
          </p>
          <p>
            Mode of delivery will be by <strong>Speedaf</strong>, <strong>VIP parcel office</strong>,
            or <strong>station cars</strong>, unless the customer specifies otherwise.
          </p>
          <p>
            Bulk delivery and pickup will be completed within <strong>two weeks</strong> after all
            goods have arrived successfully at our destination. Goods will be stored for a period of{" "}
            <strong>one (1) week</strong> after bulk delivery.
          </p>
          <p>
            Customers who opt for delivery after the bulk delivery period are expected to pay the
            riders&rsquo; fee to the station.
          </p>
        </Section>

        <Section title="5. Order Accuracy / Invoice Confirmation">
          <p>
            Miss Betty Import will not be responsible for any errors or discrepancies in orders,
            including but not limited to <strong>size</strong>, <strong>colour</strong>, and{" "}
            <strong>style</strong> of the product. Customers are mandated to recheck the items in
            their cart before placing orders.
          </p>
        </Section>

        <Section title="7. Return Policy">
          <p>Returns are only accepted if goods are:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Damaged beyond use, or</li>
            <li>Significantly different from what was ordered</li>
          </ul>
          <p>
            Claims must be reported <strong>within 24 hours</strong> of receiving the goods, with
            clear photo or video evidence.
          </p>
          <p>
            <strong>No returns or refunds</strong> for change of mind, or wrong size/colour chosen
            by the customer. Customers are responsible for the cost of returns.
          </p>
        </Section>

        <Section title="9. Payment Terms">
          <p>
            All payments must be made <strong>in full</strong> before an order is placed. We accept
            various payment methods, including bank transfers and mobile money.
          </p>
        </Section>

        <Section title="10. Order Cancellation">
          <p>
            Orders may be cancelled <strong>within 24 hours</strong> of placement. Please contact
            our customer service team via WhatsApp to initiate the cancellation process.
          </p>
          <p>
            <a
              href="https://wa.me/233202697541"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#F2AA25] hover:underline font-medium"
            >
              💬 Chat with us on WhatsApp
            </a>
          </p>
        </Section>

        <section className="border-t border-gray-200 pt-6">
          <p className="italic text-gray-500 text-sm">
            By placing an order with Miss Betty Imports, customers acknowledge that they have read,
            understood, and agreed to these Terms and Conditions. Please note that these Terms and
            Conditions are subject to change without notice.
          </p>
        </section>

        <div className="pt-2">
          <Link to="/" className="text-[#F2AA25] hover:underline text-sm font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#1e2d3d] text-white px-4 py-6 text-center">
        <p className="text-gray-500 text-xs">
          © {new Date().getFullYear()} Miss Betty Import. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
