import { Link } from "react-router-dom";

function ContactCard({ icon, title, subtitle, buttonLabel, href, buttonColor }) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto") ? undefined : "_blank"}
      rel="noopener noreferrer"
      className="flex-1 bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center text-center hover:shadow-md transition-shadow group"
    >
      <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${buttonColor}`}>
        {icon}
      </div>
      <h3 className="font-bold text-[#1e2d3d] mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4 flex-1">{subtitle}</p>
      <span className={`w-full text-center font-bold text-sm py-2.5 rounded-2xl transition-opacity group-hover:opacity-90 ${buttonColor} text-white`}>
        {buttonLabel}
      </span>
    </a>
  );
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:py-14">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1e2d3d] mb-2">Contact Us</h1>
          <p className="text-gray-500 text-sm sm:text-base">
            We'd love to hear from you. Reach out to us through any of the channels below.
          </p>
        </div>

        {/* Contact cards */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <ContactCard
            icon={
              <svg viewBox="0 0 24 24" width="26" height="26" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.558 4.133 1.532 5.87L.057 23.5l5.77-1.513A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.575-.504-5.055-1.381l-.363-.215-3.762.986 1.003-3.663-.236-.375A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            }
            title="Chat on WhatsApp"
            subtitle="Send us a message and we'll respond as soon as possible."
            buttonLabel="Open WhatsApp"
            href="https://wa.me/233202697541"
            buttonColor="bg-[#25D366]"
          />

          <ContactCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            }
            title="Send an Email"
            subtitle="missbettyimportkumasi@gmail.com"
            buttonLabel="Send Email"
            href="mailto:missbettyimportkumasi@gmail.com"
            buttonColor="bg-[#F2AA25]"
          />

          <ContactCard
            icon={
              <svg viewBox="0 0 24 24" width="26" height="26" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.558 4.133 1.532 5.87L.057 23.5l5.77-1.513A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.575-.504-5.055-1.381l-.363-.215-3.762.986 1.003-3.663-.236-.375A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            }
            title="Join our Community"
            subtitle="Stay updated with new arrivals, deals, and offers."
            buttonLabel="Join WhatsApp Group"
            href="https://chat.whatsapp.com/IQYj3qmramL65pNMMi46ll"
            buttonColor="bg-[#25D366]"
          />
        </div>

        {/* Business info */}
        <div className="bg-white rounded-2xl shadow-sm p-5 text-center text-sm text-gray-500 leading-relaxed mb-6">
          <p className="font-semibold text-[#1e2d3d] mb-1">Miss Betty Import</p>
          <p>Kumasi, Ghana</p>
          <p className="mt-1">Mon – Sat &nbsp;·&nbsp; 8:00 AM – 6:00 PM</p>
        </div>

        <div className="text-center">
          <Link to="/shop" className="text-[#F2AA25] font-semibold hover:underline text-sm">
            ← Back to Shop
          </Link>
        </div>
      </div>
    </div>
  );
}
