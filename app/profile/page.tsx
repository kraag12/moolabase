'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Mail, MapPin, Calendar, Briefcase, Wrench, Star, Edit2, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface UserProfile {
  id: string
  username: string
  full_name: string
  email: string
  profile_picture_url: string | null
  bio: string | null
  location: string | null
  created_at: string
}

interface Stats {
  jobsPosted: number
  servicesListed: number
}

export default function ProfilePage() {
  const allowedImageTypes = ['image/jpeg', 'image/png']
  const [user, setUser] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<Stats>({ jobsPosted: 0, servicesListed: 0 })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState<Partial<UserProfile>>({})

  // Initialize form with demo data (since we don't have auth yet)
  useEffect(() => {
    const demoUser: UserProfile = {
      id: '1',
      username: 'johndoe',
      full_name: 'John Doe',
      email: 'john@example.com',
      profile_picture_url: null,
      bio: 'Experienced freelancer & service provider',
      location: 'Soweto, Gauteng, South Africa',
      created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
    }
    setUser(demoUser)
    setFormData(demoUser)

    // Fetch stats
    fetchStats()
    setLoading(false)
  }, [])

  async function fetchStats() {
    const { data: jobsData } = await supabase.from('jobs').select('id').limit(1000)
    const { data: servicesData } = await supabase.from('services').select('id').limit(1000)
    
    setStats({
      jobsPosted: jobsData?.length || 0,
      servicesListed: servicesData?.length || 0,
    })
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!allowedImageTypes.includes(file.type)) {
      setUploadError('Only JPG or PNG images are allowed.')
      return
    }

    setUploading(true)
    setUploadError(null)
    try {
      const timestamp = Date.now()
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id || 'public'
      const filename = `${timestamp}-profile-${file.name}`
      const filePath = `${userId}/${filename}`
      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (error) {
        console.error('Upload error:', error)
        setUploadError(error.message || 'Upload failed. Please try again.')
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath)

      if (user) {
        setUser({ ...user, profile_picture_url: publicUrl })
        setFormData({ ...formData, profile_picture_url: publicUrl })
      }

      if (userId && userId !== 'public') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', userId)

        if (updateError && String(updateError.message || '').toLowerCase().includes('column')) {
          await supabase
            .from('profiles')
            .update({ profile_picture_url: publicUrl })
            .eq('id', userId)
        }
      }
    } catch (e) {
      console.error('Upload exception:', e)
    } finally {
      setUploading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleSave = () => {
    if (user) {
      setUser({ ...user, ...formData })
    }
    setEditMode(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="h-8 w-8 border-4 border-neutral-300 border-t-black rounded-full"></div>
          </div>
          <p className="text-neutral-600 mt-4">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600 text-lg">Unable to load profile</p>
          <Link href="/" className="text-black font-semibold mt-4 inline-block hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  const initials = user.username
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  })

  return (
    <div className="min-h-screen bg-linear-to-br from-neutral-50 to-neutral-100">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-neutral-600 hover:text-neutral-900 transition p-2 hover:bg-neutral-100 rounded-lg"
            >
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">My Profile</h1>
          </div>
          <button
            onClick={() => setEditMode(!editMode)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 transition font-medium text-neutral-900"
          >
            <Edit2 size={18} />
            <span className="hidden sm:inline">Edit</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Profile Header Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-lg overflow-hidden mb-8">
          {/* Background Banner */}
          <div className="h-32 bg-linear-to-r from-black to-neutral-800"></div>

          {/* Profile Info */}
          <div className="px-6 sm:px-8 pb-8">
            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-6 -mt-16 mb-6">
              <div className="relative group">
                <div className="w-32 h-32 rounded-2xl bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden">
                  {user.profile_picture_url ? (
                    <img
                      src={user.profile_picture_url}
                      alt={user.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-5xl font-bold">{initials}</span>
                  )}
                </div>

                {editMode && (
                  <label className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center rounded-2xl cursor-pointer hover:bg-opacity-50 transition opacity-0 group-hover:opacity-100">
                    <Upload size={28} className="text-white" />
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleImageUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {uploadError && (
                <p className="text-sm text-red-600">{uploadError}</p>
              )}

              <div className="flex-1">
                {editMode ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-green-600 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={formData.full_name || ''}
                        onChange={(e) => handleInputChange('full_name', e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 bg-green-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={formData.location || ''}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                        placeholder="City, Region"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Bio
                      </label>
                      <textarea
                        value={formData.bio || ''}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-black text-white rounded-lg hover:bg-neutral-800 transition font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditMode(false)}
                        className="px-6 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="inline-flex items-center gap-3 mb-2 px-3 py-2 rounded-lg bg-neutral-900/90">
                      <h2 className="text-3xl sm:text-4xl font-bold text-white">
                        {user.full_name}
                      </h2>
                      <span className="text-sm font-semibold text-white">
                        @{user.username}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-neutral-600">
                      <MapPin size={16} />
                      {user.location || 'Location not specified'}
                    </div>
                    {user.bio && <p className="text-neutral-700 text-base mt-3">{user.bio}</p>}
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-neutral-600">
                      <div className="flex items-center gap-2">
                        <Mail size={16} />
                        {user.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        Joined {memberSince}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-neutral-200 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">Jobs Posted</h3>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Briefcase size={20} className="text-blue-600" />
              </div>
            </div>
            <p className="text-4xl font-bold text-neutral-900 mb-1">{stats.jobsPosted}</p>
            <p className="text-sm text-neutral-600">Active job listings</p>
            <Link
              href="/post/jobs"
              className="mt-4 inline-block text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Post New Job {'>'}
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">Services Listed</h3>
              <div className="p-3 bg-green-100 rounded-lg">
                <Wrench size={20} className="text-green-600" />
              </div>
            </div>
            <p className="text-4xl font-bold text-neutral-900 mb-1">{stats.servicesListed}</p>
            <p className="text-sm text-neutral-600">Active service offerings</p>
            <Link
              href="/post/jobs/service"
              className="mt-4 inline-block text-green-600 hover:text-green-700 font-medium text-sm"
            >
              Post New Service {'>'}
            </Link>
          </div>
        </div>

        {/* Logout Button */}
        <div className="mt-8 flex justify-center">
          <button className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
