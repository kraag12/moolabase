import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AboutPage() {
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">About MoolaBase</h1>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <p className="text-gray-600 leading-relaxed">
            Moolabase is a free community-driven platform that connects people who need jobs done with individuals offering local or remote services.
            Users can post jobs, offer services, apply to opportunities, and connect directly, without fees, middlemen, or commissions.
            The goal is simple: make it easier for people to find work and get things done.
          </p>
        </div>
      </div>
    </div>
  )
}
