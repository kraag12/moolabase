'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function PostServicePage() {
  const router = useRouter()

  const allowedImageTypes = ['image/jpeg', 'image/png']
  const storageBucket = 'avatars'

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [offer, setOffer] = useState<string | number>('')
  const [workType, setWorkType] = useState('local')
  const [tools, setTools] = useState('')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function uploadImages(): Promise<string[]> {
    if (imageFiles.length === 0) return []

    const urls: string[] = []
    setUploading(true)

    for (const file of imageFiles.slice(0, 3)) {
      if (!allowedImageTypes.includes(file.type)) {
        console.warn('Skipping unsupported file type:', file.type)
        continue
      }

      try {
        const timestamp = Date.now()
        const filename = `${timestamp}-${file.name}`
        const { data, error } = await supabase.storage
          .from(storageBucket)
          .upload(`service-images/${filename}`, file, { contentType: file.type })

        if (error) {
          console.error('Upload error:', error)
          continue
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(storageBucket).getPublicUrl(`service-images/${filename}`)

        urls.push(publicUrl)
      } catch (e) {
        console.error('Exception uploading image:', e)
      }
    }

    setUploading(false)
    return urls
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validation
    if (!title.trim()) {
      setError('Service title is required')
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

    // Upload images if provided
    const imageUrls = await uploadImages()

    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          offer: Number(offer),
          work_type: workType,
          tools: tools.trim() || null,
          image_url: imageUrls.length > 0 ? imageUrls : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to post service')
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 3)
      const invalid = files.find((file) => !allowedImageTypes.includes(file.type))
      if (invalid) {
        setImageFiles([])
        setImageError('Only JPG or PNG images are allowed.')
        return
      }
      setImageError(null)
      setImageFiles(files)
    }
  }

  useEffect(() => {
    const urls = imageFiles.map((file) => URL.createObjectURL(file))
    setPreviewUrls(urls)
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [imageFiles])

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-block text-neutral-600 hover:opacity-80 mb-8 text-sm text-transparent">
          ← Back to home
          <span className="text-neutral-600">Back to home</span>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Offer a Service</h1>
          <p className="text-neutral-600">Fill in the details below to list your service.</p>
        </div>

        <form className="space-y-6 bg-white p-8 rounded-lg border border-neutral-200" onSubmit={handleSubmit}>
          <div>
            <label className="font-semibold block mb-2 text-neutral-900">Service Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              type="text"
              className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              placeholder="e.g. Professional plumbing services"
            />
          </div>

          <div>
            <label className="font-semibold block mb-2 text-neutral-900">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              rows={5}
              placeholder="Describe the service in detail. What can clients expect?"
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

          <div>
            <label className="font-semibold block mb-2 text-neutral-900">Work Type *</label>
            <select
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
            >
              <option value="local">Local</option>
              <option value="remote">Remote</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-2 text-neutral-900">Tools & Equipment</label>
            <input
              value={tools}
              onChange={(e) => setTools(e.target.value)}
              type="text"
              className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              placeholder="e.g. Lawn mower, hedge trimmer"
            />
          </div>

          <div>
            <label className="font-semibold block mb-2 text-neutral-900">Show us your work (JPG/PNG, optional, max 3)</label>
            <div className="flex flex-col gap-3">
              <label className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 transition cursor-pointer font-medium text-neutral-800">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png"
                  onChange={handleImageChange}
                  className="hidden"
                />
                Upload images
              </label>

              {imageError && <p className="text-sm text-red-600">{imageError}</p>}

              {previewUrls.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {previewUrls.map((src, index) => (
                    <div key={`${src}-${index}`} className="border border-neutral-200 rounded-lg overflow-hidden">
                      <img src={src} alt={`Preview ${index + 1}`} className="h-32 w-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">No images selected.</p>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              Service posted successfully! Redirecting...
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 bg-black text-white py-3 rounded-lg font-semibold hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
              disabled={loading || uploading}
            >
              {uploading ? 'Uploading images...' : loading ? 'Posting...' : 'Post Service'}
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
