import React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import AppLayout from '../../components/Layout/AppLayout'
import DashboardStats from '../../components/Dashboard/DashboardStats'
import ProfileProgress from '../../components/Dashboard/ProfileProgress'
import RecentActivity from '../../components/Dashboard/RecentActivity'
import QuickActions from '../../components/Dashboard/QuickActions'

const DashboardPage: React.FC = () => {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect to signin if not authenticated
  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/dashboard')
    }
  }, [status, router])

  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', session?.user?.email],
    queryFn: async () => {
      const response = await fetch('/api/dashboard')
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }
      return response.json()
    },
    enabled: !!session?.user?.email,
  })

  if (status === 'loading' || isLoading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow-soft">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-soft">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-soft">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!session) return null

  const welcomeMessage = session.user?.name 
    ? `Welcome back, ${session.user.name.split(' ')[0]}!`
    : 'Welcome to your dashboard!'

  return (
    <AppLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {welcomeMessage}
          </h1>
          <p className="text-gray-600">
            Here&apos;s what&apos;s happening with your LinkedIn optimization journey.
          </p>
        </div>

        {/* Stats Overview */}
        <DashboardStats data={dashboardData?.stats} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Left Column - Profile Progress & Quick Actions */}
          <div className="lg:col-span-2 space-y-8">
            <ProfileProgress data={dashboardData?.profileProgress} />
            <QuickActions />
          </div>

          {/* Right Column - Recent Activity */}
          <div className="lg:col-span-1">
            <RecentActivity data={dashboardData?.recentActivity} />
          </div>
        </div>

        {/* Welcome Modal for New Users */}
        {dashboardData?.isNewUser && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-success-100 mb-4">
                  <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Welcome to InErgize! 🎉
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Ready to optimize your LinkedIn presence? Let&apos;s start with analyzing your profile to identify key improvements.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => router.push('/dashboard/profile')}
                    className="btn-primary flex-1"
                  >
                    Analyze Profile
                  </button>
                  <button
                    onClick={() => {
                      // Mark as not new user and close modal
                      fetch('/api/user/welcome', { method: 'POST' })
                    }}
                    className="btn-secondary flex-1"
                  >
                    Explore Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default DashboardPage