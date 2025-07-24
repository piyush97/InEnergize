import React from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { 
  EyeIcon, 
  UserPlusIcon, 
  HeartIcon, 
  DocumentTextIcon,
  ChartBarIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'

interface ActivityItem {
  id: string
  type: 'profile_view' | 'connection' | 'post_like' | 'content_generated' | 'post_scheduled' | 'analytics_update'
  title: string
  description: string
  timestamp: string
  metadata?: {
    count?: number
    url?: string
    status?: string
  }
}

interface RecentActivityData {
  activities: ActivityItem[]
}

interface RecentActivityProps {
  data?: RecentActivityData
}

const RecentActivity: React.FC<RecentActivityProps> = ({ data }) => {
  const activityData = data || {
    activities: [
      {
        id: '1',
        type: 'profile_view' as const,
        title: 'Profile viewed by 12 people',
        description: 'Your profile has been viewed by professionals in your network',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        metadata: { count: 12 }
      },
      {
        id: '2',
        type: 'connection' as const,
        title: '3 new connection requests',
        description: 'You have pending connection requests from industry professionals',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        metadata: { count: 3, url: '/dashboard/network' }
      },
      {
        id: '3',
        type: 'content_generated' as const,
        title: 'AI content generated',
        description: 'New LinkedIn post about industry trends created successfully',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        metadata: { url: '/dashboard/content' }
      },
      {
        id: '4',
        type: 'post_scheduled' as const,
        title: 'Post scheduled for tomorrow',
        description: 'Your content about remote work best practices is ready to publish',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
        metadata: { url: '/dashboard/scheduler' }
      },
      {
        id: '5',
        type: 'post_like' as const,
        title: '45 likes on recent post',
        description: 'Your post about career development is gaining traction',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        metadata: { count: 45 }
      },
      {
        id: '6',
        type: 'analytics_update' as const,
        title: 'Weekly analytics ready',
        description: 'Your LinkedIn performance report for this week is available',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        metadata: { url: '/dashboard/analytics' }
      }
    ]
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'profile_view':
        return EyeIcon
      case 'connection':
        return UserPlusIcon
      case 'post_like':
        return HeartIcon
      case 'content_generated':
        return DocumentTextIcon
      case 'post_scheduled':
        return CalendarIcon
      case 'analytics_update':
        return ChartBarIcon
      default:
        return DocumentTextIcon
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'profile_view':
        return 'text-blue-600 bg-blue-50'
      case 'connection':
        return 'text-green-600 bg-green-50'
      case 'post_like':
        return 'text-pink-600 bg-pink-50'
      case 'content_generated':
        return 'text-purple-600 bg-purple-50'
      case 'post_scheduled':
        return 'text-yellow-600 bg-yellow-50'
      case 'analytics_update':
        return 'text-indigo-600 bg-indigo-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-soft">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
          <Link
            href="/dashboard/activity"
            className="text-sm text-primary-600 hover:text-primary-500 font-medium"
          >
            View All →
          </Link>
        </div>
      </div>
      
      <div className="p-6">
        <div className="flow-root">
          <ul className="-mb-8">
            {activityData.activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.type)
              const colorClasses = getActivityColor(activity.type)
              const isLast = index === activityData.activities.length - 1

              return (
                <li key={activity.id}>
                  <div className="relative pb-8">
                    {!isLast && (
                      <span
                        className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200"
                        aria-hidden="true"
                      />
                    )}
                    <div className="relative flex items-start space-x-3">
                      <div className={`relative px-1`}>
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${colorClasses}`}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div>
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {activity.title}
                            </div>
                          </div>
                          <p className="mt-0.5 text-sm text-gray-500">
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="mt-2 text-sm text-gray-700">
                          <p>{activity.description}</p>
                          {activity.metadata?.url && (
                            <Link
                              href={activity.metadata.url}
                              className="text-primary-600 hover:text-primary-500 text-xs mt-1 inline-block"
                            >
                              View details →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {activityData.activities.length === 0 && (
          <div className="text-center py-8">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start optimizing your profile to see activity here.
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard/profile"
                className="btn-primary"
              >
                Analyze Profile
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecentActivity