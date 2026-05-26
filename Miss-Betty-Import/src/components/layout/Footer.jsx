export default function Footer() {
  return (
    <footer className="bg-[#1e2d3d] text-white px-4 py-10">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-gray-300 text-sm leading-relaxed mb-6">
          Miss Betty Import is a duly registered business with the Office of the
          Registrar of Companies, Republic of Ghana, under the Registration of
          Business Names Act, 1962 (Act 151).
        </p>
        <div className="flex justify-center items-center gap-4 sm:gap-8 flex-wrap mb-6 text-sm">
          <a
            href="https://wa.me/233200000000"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[#F2AA25] font-semibold hover:underline"
          >
            <span>💬</span> Chat with us
          </a>
          <span className="text-gray-600 hidden sm:inline">|</span>
          <a
            href="/terms"
            className="text-gray-300 hover:text-[#F2AA25] transition-colors"
          >
            Terms and conditions
          </a>
        </div>
        <p className="text-gray-500 text-xs">
          © {new Date().getFullYear()} Miss Betty Import. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
