'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PostJobPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [offer, setOffer] = useState<string | number>('')
  const [workType, setWorkType] = useState('local')
  const [responseTime, setResponseTime] = useState('flexible')
  const [duration, setDuration] = useState('1_week')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validation
    if (!title.trim()) {
      setError('Job title is required')
      return
    }
    if (!description.trim()) {
      setError('Description is required')
      return
    }
    if (!location.trim()) {
      setError('Location is required')
      return
    }
    if (!offer) {
      setError('Offer amount is required')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            location: location.trim(),
            offer: Number(offer),
            work_type: workType,
            response_time: responseTime,
            duration,
          }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to post job')
        setLoading(false)
        return
      }

      const data = await response.json()
      setSuccess(true)
      setTimeout(() => {
        router.push('/jobs')
      }, 600)
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-block text-neutral-600 hover:text-neutral-900 mb-8 text-sm">
          ← Back to home
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Post a Job</h1>
          <p className="text-neutral-600">Fill in the details below to post your job listing.</p>
        </div>

        <form className="space-y-6 bg-white p-8 rounded-lg border border-neutral-200" onSubmit={handleSubmit}>
          <div>
            <label className="font-semibold block mb-2 text-neutral-900">Job Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              type="text"
              className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              placeholder="e.g. Need a carpenter for home renovation"
            />
          </div>

          <div>
            <label className="font-semibold block mb-2 text-neutral-900">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              rows={5}
              placeholder="Describe the job in detail. What needs to be done?"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              type="text"
              className="w-full border rounded-md px-3 py-2"
              placeholder="City or area"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Offer (R)</label>
            <input
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              type="number"
              className="w-full border rounded-md px-3 py-2"
              placeholder="Amount you’re offering"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">
              How long should this job be up?
            </label>
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full border rounded-md px-3 py-2">
              <option value="3_days">3 days</option>
              <option value="1_week">1 week</option>
              <option value="2_weeks">2 weeks</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1">Work type *</label>
            <select value={workType} onChange={(e) => setWorkType(e.target.value)} className="w-full border rounded-md px-3 py-2">
              <option value="local">Local</option>
              <option value="remote">Remote</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1">Response time *</label>
            <select value={responseTime} onChange={(e) => setResponseTime(e.target.value)} className="w-full border rounded-md px-3 py-2">
              <option value="urgent">Urgent</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">Job posted successfully! Redirecting...</div>}

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 bg-black text-white py-3 rounded-lg font-semibold hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
              disabled={loading}
            >
              {loading ? 'Posting...' : 'Post Job'}
            </button>
            <Link
              href="/"
              className="flex-1 border border-neutral-300 py-3 rounded-lg font-semibold hover:bg-neutral-50 transition text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
