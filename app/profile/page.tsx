'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Upload,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  Wrench,
  Star,
  Edit2,
  LogOut,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { resolveColumn } from '@/lib/supabase/schema'
import { getListingHref } from '@/lib/listings/url'

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

interface ActivityItem {
  id: string
  type: 'job_posted' | 'service_posted' | 'job_applied' | 'service_applied'
  label: string
  href: string
  created_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const allowedImageTypes = ['image/jpeg', 'image/png']
  const [user, setUser] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<Stats>({ jobsPosted: 0, servicesListed: 0 })
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState<Partial<UserProfile>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [avatarColumn, setAvatarColumn] = useState<'avatar_url' | 'profile_picture_url'>('profile_picture_url')
  const [loggingOut, setLoggingOut] = useState(false)

  const formatRelativeTime = useCallback((dateString: string) => {
    const created = new Date(dateString).getTime()
    const now = Date.now()
    const diffMs = Math.max(0, now - created)
    const minutes = Math.floor(diffMs / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }, [])

  const loadActivityAndStats = useCallback(async (currentUserId: string) => {
    const jobOwnerColumn = await resolveColumn(supabase as any, 'jobs', 'poster_id', 'user_id')
    const serviceOwnerColumn = await resolveColumn(supabase as any, 'services', 'poster_id', 'user_id')
    const jobApplicantColumn = await resolveColumn(
      supabase as any,
      'job_applications',
      'user_id',
      'applicant_id'
    )
    const serviceApplicantColumn = await resolveColumn(
      supabase as any,
      'service_applications',
      'user_id',
      'applicant_id'
    )

    const [
      { count: jobsPosted },
      { count: servicesListed },
      { data: myJobs },
      { data: myServices },
      { data: myJobApps },
      { data: myServiceApps },
    ] = await Promise.all([
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq(jobOwnerColumn, currentUserId),
      supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq(serviceOwnerColumn, currentUserId),
      supabase
        .from('jobs')
        .select('id, title, created_at')
        .eq(jobOwnerColumn, currentUserId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('services')
        .select('id, title, created_at')
        .eq(serviceOwnerColumn, currentUserId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('job_applications')
        .select('id, job_id, created_at')
        .eq(jobApplicantColumn, currentUserId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('service_applications')
        .select('id, service_id, created_at')
        .eq(serviceApplicantColumn, currentUserId)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    setStats({
      jobsPosted: jobsPosted || 0,
      servicesListed: servicesListed || 0,
    })

    const jobIdsFromApplications = Array.from(
      new Set((myJobApps || []).map((app: any) => app.job_id).filter(Boolean))
    ) as string[]
    const serviceIdsFromApplications = Array.from(
      new Set((myServiceApps || []).map((app: any) => app.service_id).filter(Boolean))
    ) as string[]

    const [{ data: appliedJobListings }, { data: appliedServiceListings }] = await Promise.all([
      jobIdsFromApplications.length > 0
        ? supabase.from('jobs').select('id, title').in('id', jobIdsFromApplications)
        : Promise.resolve({ data: [] as any[] }),
      serviceIdsFromApplications.length > 0
        ? supabase.from('services').select('id, title').in('id', serviceIdsFromApplications)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const appliedJobTitleMap = new Map(
      (appliedJobListings || []).map((job: any) => [job.id, job.title || 'Untitled job'])
    )
    const appliedServiceTitleMap = new Map(
      (appliedServiceListings || []).map((service: any) => [
        service.id,
        service.title || 'Untitled service',
      ])
    )

    const nextActivity: ActivityItem[] = [
      ...(myJobs || []).map((job: any) => {
        const idStr = String(job.id)
        return {
          id: `job-posted-${idStr}`,
          type: 'job_posted' as const,
          label: `Posted a new job: "${job.title || 'Untitled job'}"`,
          href: getListingHref(idStr, 'job'),
          created_at: job.created_at,
        }
      }),
      ...(myServices || []).map((service: any) => {
        const idStr = String(service.id)
        return {
          id: `service-posted-${idStr}`,
          type: 'service_posted' as const,
          label: `Listed a new service: "${service.title || 'Untitled service'}"`,
          href: getListingHref(idStr, 'service'),
          created_at: service.created_at,
        }
      }),
      ...(myJobApps || []).map((application: any) => {
        const idStr = String(application.job_id)
        return {
          id: `job-applied-${application.id}`,
          type: 'job_applied' as const,
          label: `Applied for "${appliedJobTitleMap.get(application.job_id) || 'a job'}"`,
          href: getListingHref(idStr, 'job'),
          created_at: application.created_at,
        }
      }),
      ...(myServiceApps || []).map((application: any) => {
        const idStr = String(application.service_id)
        return {
          id: `service-applied-${application.id}`,
          type: 'service_applied' as const,
          label: `Requested "${appliedServiceTitleMap.get(application.service_id) || 'a service'}"`,
          href: getListingHref(idStr, 'service'),
          created_at: application.created_at,
        }
      }),
    ]

    nextActivity.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setActivities(nextActivity.slice(0, 5));
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setUploadError(null)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const authUser = authData?.user
      if (!authUser) {
        setNeedsLogin(true)
        setUser(null)
        setUserId(null)
        return
      }

      setNeedsLogin(false)
      setUserId(authUser.id)

      const profileAvatarColumn = (await resolveColumn(
        supabase as any,
        'profiles',
        'avatar_url',
        'profile_picture_url'
      )) as 'avatar_url' | 'profile_picture_url'
      const emailColumn = await resolveColumn(supabase as any, 'profiles', 'email', 'id')
      setAvatarColumn(profileAvatarColumn)

      const selectColumns =
        emailColumn === 'email'
          ? `id, username, full_name, email, bio, location, created_at, ${profileAvatarColumn}`
          : `id, username, full_name, bio, location, created_at, ${profileAvatarColumn}`

      const { data: profileData } = await supabase
        .from('profiles')
        .select(selectColumns)
        .eq('id', authUser.id)
        .maybeSingle()
      const profileRecord = (profileData || {}) as any

      const normalizedUser: UserProfile = {
        id: authUser.id,
        username:
          profileRecord.username || authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'member',
        full_name: profileRecord.full_name || authUser.user_metadata?.full_name || 'Moolabase Member',
        email: (emailColumn === 'email' ? profileRecord.email : null) || authUser.email || '',
        profile_picture_url: (profileRecord?.[profileAvatarColumn] as string | null) || null,
        bio: profileRecord.bio || null,
        location: profileRecord.location || null,
        created_at: profileRecord.created_at || new Date().toISOString(),
      }

      setUser(normalizedUser)
      setFormData(normalizedUser)
      await loadActivityAndStats(authUser.id)
    } catch (error) {
      console.error('Failed to load profile:', error)
      setUploadError('Failed to load profile data.')
    } finally {
      setLoading(false)
    }
  }, [loadActivityAndStats])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  useEffect(() => {
    if (!userId) return
    const onFocus = () => {
      loadActivityAndStats(userId)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadActivityAndStats, userId])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (!allowedImageTypes.includes(file.type)) {
      setUploadError('Only JPG or PNG images are allowed.')
      return
    }

    setUploading(true)
    setUploadError(null)
    try {
      const timestamp = Date.now()
      const filename = `${timestamp}-profile-${file.name}`
      const filePath = `${userId}/${filename}`
      const { error } = await supabase.storage.from('avatars').upload(filePath, file)

      if (error) {
        setUploadError(error.message || 'Upload failed. Please try again.')
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath)

      const primaryUpdate = await supabase
        .from('profiles')
        .update({ [avatarColumn]: publicUrl })
        .eq('id', userId)

      if (primaryUpdate.error && avatarColumn === 'avatar_url') {
        await supabase
          .from('profiles')
          .update({ profile_picture_url: publicUrl })
          .eq('id', userId)
      }

      setUser((prev) => (prev ? { ...prev, profile_picture_url: publicUrl } : prev))
      setFormData((prev) => ({ ...prev, profile_picture_url: publicUrl }))
    } catch (error) {
      console.error('Upload exception:', error)
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  async function handleSave() {
    if (!user || !userId) return
    setSaving(true)
    setUploadError(null)

    const updates = {
      full_name: formData.full_name?.trim() || null,
      bio: formData.bio?.trim() || null,
      location: formData.location?.trim() || null,
    }

    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
      if (error) {
        setUploadError(error.message || 'Failed to save profile changes.')
        return
      }

      setUser({
        ...user,
        full_name: updates.full_name || user.full_name,
        bio: updates.bio,
        location: updates.location,
      })
      setEditMode(false)
    } catch (error) {
      console.error('Save error:', error)
      setUploadError('Failed to save profile changes.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    setUploadError(null)
    setLoggingOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setUploadError(error.message || 'Failed to log out. Please try again.')
        return
      }

      router.replace('/login')
      router.refresh()
    } catch (error: any) {
      setUploadError(error?.message || 'Failed to log out. Please try again.')
    } finally {
      setLoggingOut(false)
    }
  }

  const initials = useMemo(() => {
    if (!user?.username) return 'MB'
    return user.username
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [user?.username])

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

  if (needsLogin) {
    return (
      <div className="min-h-screen bg-linear-to-br from-neutral-50 to-neutral-100 flex items-center justify-center px-6">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center max-w-md w-full">
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Log in to view your profile</h1>
          <p className="text-neutral-600 mb-6">Your profile, stats, and recent activity are available after login.</p>
          <div className="flex justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-neutral-800 transition"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="inline-flex px-6 py-3 bg-neutral-200 text-neutral-800 rounded-lg font-semibold hover:bg-neutral-300 transition"
            >
              Sign Up
            </Link>
          </div>
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

  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-600 hover:text-gray-900">
                <ArrowLeft size={24} />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditMode(!editMode)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition font-medium text-gray-900"
              >
                <Edit2 size={18} />
                <span>{editMode ? 'Cancel' : 'Edit Profile'}</span>
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
              >
                <LogOut size={18} />
                {loggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="relative">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center overflow-hidden">
                    {user.profile_picture_url ? (
                      <img
                        src={user.profile_picture_url}
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-bold text-gray-600">{initials}</span>
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 bg-black text-white p-2 rounded-full hover:bg-gray-800 transition cursor-pointer">
                    <Upload size={14} />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>

                <div className="flex-1">
                  {editMode ? (
                    <input
                      type="text"
                      value={formData.full_name || ''}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                      className="text-3xl font-bold text-gray-900 border-b-2 border-gray-300 focus:border-blue-500 outline-none w-full"
                    />
                  ) : (
                    <h2 className="text-3xl font-bold text-gray-900">{user.full_name}</h2>
                  )}
                  <p className="text-gray-500">@{user.username}</p>
                </div>
              </div>

              {uploadError && <p className="text-sm text-red-600 mt-3">{uploadError}</p>}

              <div className="mt-6">
                {editMode ? (
                  <textarea
                    value={formData.bio || ''}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tell us about yourself..."
                  />
                ) : (
                  <p className="text-gray-700">{user.bio || 'No bio provided.'}</p>
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail size={16} />
                  <span>{user.email || 'No email available'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} />
                  {editMode ? (
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      className="border-b-2 border-gray-300 focus:border-blue-500 outline-none"
                      placeholder="City, Country"
                    />
                  ) : (
                    <span>{user.location || 'Location not specified'}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  <span>Joined {memberSince}</span>
                </div>
              </div>

              {editMode && (
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Statistics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Briefcase size={20} className="text-blue-600" />
                    </div>
                    <p className="font-semibold text-gray-800">Jobs Posted</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.jobsPosted}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Wrench size={20} className="text-green-600" />
                    </div>
                    <p className="font-semibold text-gray-800">Services Listed</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.servicesListed}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {activities.length === 0 && (
                  <p className="text-gray-500">No activity yet.</p>
                )}

                {activities.map((activity) => {
                  const icon =
                    activity.type === 'job_posted' ? (
                      <Briefcase size={16} className="text-blue-600" />
                    ) : activity.type === 'service_posted' ? (
                      <Wrench size={16} className="text-green-600" />
                    ) : (
                      <Star size={16} className="text-gray-600" />
                    )

                  return (
                    <Link key={activity.id} href={activity.href} className="block hover:bg-gray-50 rounded-lg p-2 -m-2 transition">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-full">{icon}</div>
                        <div>
                          <p className="font-medium text-gray-800">{activity.label}</p>
                          <p className="text-sm text-gray-500">{formatRelativeTime(activity.created_at)}</p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
