import React from 'react'
import { 
  EyeIcon, 
  UserPlusIcon, 
  ChartBarIcon, 
  HeartIcon 
} from '@heroicons/react/24/outline'

interface StatsData {
  profileViews: {
    current: number
    change: number
    changeType: 'increase' | 'decrease' | 'neutral'
  }
  connections: {
    current: number
    change: number
    changeType: 'increase' | 'decrease' | 'neutral'
  }
  postEngagement: {
    current: number
    change: number
    changeType: 'increase' | 'decrease' | 'neutral'
  }
  searchAppearances: {
    current: number
    change: number
    changeType: 'increase' | 'decrease' | 'neutral'
  }
}

interface DashboardStatsProps {
  data?: StatsData
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ data }) => {
  const stats = data || {
    profileViews: { current: 0, change: 0, changeType: 'neutral' as const },
    connections: { current: 0, change: 0, changeType: 'neutral' as const },
    postEngagement: { current: 0, change: 0, changeType: 'neutral' as const },
    searchAppearances: { current: 0, change: 0, changeType: 'neutral' as const },
  }

  const statItems = [
    {
      name: 'Profile Views',
      value: stats.profileViews.current,
      change: stats.profileViews.change,
      changeType: stats.profileViews.changeType,
      icon: EyeIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Connections',
      value: stats.connections.current,
      change: stats.connections.change,
      changeType: stats.connections.changeType,
      icon: UserPlusIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Post Engagement',
      value: stats.postEngagement.current,
      change: stats.postEngagement.change,
      changeType: stats.postEngagement.changeType,
      icon: HeartIcon,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
    },
    {
      name: 'Search Appearances',
      value: stats.searchAppearances.current,
      change: stats.searchAppearances.change,
      changeType: stats.searchAppearances.changeType,
      icon: ChartBarIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ]

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'increase':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l6-6 3.75 3.75 5.25-5.25" />
          </svg>
        )
      case 'decrease':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 8.25l6 6 3.75-3.75 5.25 5.25" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          </svg>
        )
    }
  }

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'increase':
        return 'text-green-600'
      case 'decrease':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statItems.map((item) => (
        <div key={item.name} className="bg-white rounded-lg shadow-soft p-6">
          <div className="flex items-center">
            <div className={`flex-shrink-0 p-3 rounded-md ${item.bgColor}`}>
              <item.icon className={`h-6 w-6 ${item.color}`} aria-hidden="true" />
            </div>
            <div className="ml-4 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500 truncate">
                  {item.name}
                </p>
              </div>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">
                  {formatNumber(item.value)}
                </p>
                {item.change !== 0 && (
                  <div className={`ml-2 flex items-center text-sm ${getChangeColor(item.changeType)}`}>
                    {getChangeIcon(item.changeType)}
                    <span className="ml-1">
                      {Math.abs(item.change)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default DashboardStats