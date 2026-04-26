'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BOOST_PLANS } from '@/lib/boosts/plans'

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
  const [boostError, setBoostError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [boostPlan, setBoostPlan] = useState<string>('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBoostError(null)
    setSuccess(false)
    setRedirecting(false)

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

      if (boostPlan) {
        const boostRes = await fetch('/api/boosts/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listing_type: 'job',
            listing_id: data?.id,
            plan: boostPlan,
          }),
        })

        if (!boostRes.ok) {
          const boostData = await boostRes.json().catch(() => ({}))
          if (boostData?.code === 'payments_not_configured') {
            setBoostError('Job posted. Boost payments are not configured yet.')
            setSuccess(true)
            setRedirecting(true)
            setLoading(false)
            setTimeout(() => {
              router.push('/jobs')
            }, 900)
            return
          }
          setBoostError(boostData?.error || 'Failed to boost job')
          setLoading(false)
          return
        }

        const boostData = await boostRes.json().catch(() => ({}))
        const checkoutUrl = String(boostData?.checkout_url || '').trim()
        if (!checkoutUrl) {
          setBoostError('Payment checkout URL missing')
          setLoading(false)
          return
        }
        setLoading(false)
        window.location.href = checkoutUrl
        return
      }
      setSuccess(true)
      setRedirecting(true)
      setLoading(false)
      setTimeout(() => {
        router.push('/jobs')
      }, 700)
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

        <form className="space-y-6 bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm" onSubmit={handleSubmit}>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="font-semibold block mb-2 text-neutral-900">Location *</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                type="text"
                className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                placeholder="City or area"
              />
            </div>

            <div>
              <label className="font-semibold block mb-2 text-neutral-900">Offer (R) *</label>
              <input
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                type="number"
                className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                placeholder="0"
                min="0"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="font-semibold block mb-2 text-neutral-900">Work type *</label>
              <select value={workType} onChange={(e) => setWorkType(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition">
                <option value="local">Local</option>
                <option value="remote">Remote</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-2 text-neutral-900">Response time *</label>
              <select value={responseTime} onChange={(e) => setResponseTime(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition">
                <option value="urgent">Urgent</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-2 text-neutral-900">
                Job post duration
              </label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition">
                <option value="3_days">3 days</option>
                <option value="1_week">1 week</option>
                <option value="2_weeks">2 weeks</option>
                <option value="1_month">1 month</option>
                <option value="max">Max</option>
              </select>
            </div>
          </div>

          <div className="border-t border-neutral-200 pt-6">
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-neutral-900">Boost this post (optional)</h3>
              <p className="text-sm text-neutral-600">Boosted posts appear in intervals and get extra visibility.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {BOOST_PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setBoostPlan(plan.id)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    boostPlan === plan.id
                      ? 'border-black bg-black text-white'
                      : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300'
                  }`}
                >
                  <div className="text-sm font-semibold">{plan.label}</div>
                  <div className={`text-xs ${boostPlan === plan.id ? 'text-neutral-200' : 'text-neutral-500'}`}>
                    R {Math.round(plan.priceCents / 100)}
                  </div>
                </button>
              ))}
            </div>
            {boostPlan && (
              <button
                type="button"
                onClick={() => setBoostPlan('')}
                className="mt-3 text-sm text-neutral-600 hover:text-neutral-900"
              >
                Remove boost
              </button>
            )}
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
          {boostError && <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg">{boostError}</div>}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between gap-4">
              <span>Job posted successfully!</span>
              {redirecting && (
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <span className="h-2 w-2 rounded-full bg-green-600 animate-pulse"></span>
                  Redirecting...
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              type="submit"
              className="w-full sm:w-auto flex-1 bg-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
              disabled={loading || redirecting}
            >
              {loading ? 'Posting...' : 'Post Job'}
            </button>
            <Link
              href="/"
              className="w-full sm:w-auto flex-1 border border-neutral-300 py-3 px-6 rounded-lg font-semibold hover:bg-neutral-50 transition text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
