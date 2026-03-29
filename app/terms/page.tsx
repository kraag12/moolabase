import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-900 transition p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Terms of Use</h1>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <p className="text-gray-600 leading-relaxed">
            Moolabase is provided as a free platform for connecting job posters and service providers.
            Users are responsible for the accuracy of the information they post and for any interactions they engage in.
            Moolabase does not guarantee job outcomes, service quality, or user conduct.
            Misuse of the platform, including fraud or harassment, may result in account suspension or removal.
          </p>
        </div>
      </div>
    </div>
  )
}
