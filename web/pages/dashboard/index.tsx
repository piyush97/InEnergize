import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/router'
import AppLayout from '../../components/Layout/AppLayout'
import DashboardStats from '../../components/Dashboard/DashboardStats'
import ProfileProgress from '../../components/Dashboard/ProfileProgress'
import RecentActivity from '../../components/Dashboard/RecentActivity'
import QuickActions from '../../components/Dashboard/QuickActions'

const DashboardPage: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()

  // Redirect to signin if not authenticated
  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/signin?callbackUrl=/dashboard')
    }
  }, [loading, isAuthenticated, router])

  // Use static mock data to avoid any query-related issues
  const dashboardData = {
    stats: null, // Components will use their fallback data
    profileProgress: null, // Components will use their fallback data  
    recentActivity: null, // Components will use their fallback data
    isNewUser: false // Don't show welcome modal for existing implementation
  }

  // Show loading state only for auth loading, not for dashboard data loading
  if (loading) {
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

  if (!isAuthenticated || !user) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="text-center">
            <p>Please sign in to access your dashboard.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  const welcomeMessage = (user && user.firstName) 
    ? `Welcome back, ${user.firstName}!`
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

        {/* Welcome Modal removed temporarily to avoid fetch issues */}
      </div>
    </AppLayout>
  )
}

export default DashboardPage