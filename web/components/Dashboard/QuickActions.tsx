import React from 'react'
import Link from 'next/link'
import { 
  DocumentTextIcon, 
  CalendarIcon, 
  ChartBarIcon, 
  UserPlusIcon,
  SparklesIcon,
  CogIcon
} from '@heroicons/react/24/outline'

const QuickActions: React.FC = () => {
  const actions = [
    {
      title: 'Generate Content', 
      description: 'Create AI-powered LinkedIn posts and articles',
      icon: DocumentTextIcon,
      href: '/dashboard/content',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      hoverColor: 'hover:bg-blue-100'
    },
    {
      title: 'Schedule Posts',
      description: 'Plan and schedule your LinkedIn content',
      icon: CalendarIcon,
      href: '/dashboard/scheduler',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      hoverColor: 'hover:bg-green-100'
    },
    {
      title: 'View Analytics',
      description: 'Track your LinkedIn performance metrics',
      icon: ChartBarIcon,
      href: '/dashboard/analytics',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      hoverColor: 'hover:bg-purple-100'
    },
    {
      title: 'Grow Network',
      description: 'Find and connect with relevant professionals',
      icon: UserPlusIcon,
      href: '/dashboard/network',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      hoverColor: 'hover:bg-pink-100'
    },
    {
      title: 'AI Profile Optimizer',
      description: 'Get personalized profile improvement suggestions',
      icon: SparklesIcon,
      href: '/dashboard/profile',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      hoverColor: 'hover:bg-yellow-100'
    },
    {
      title: 'Automation Settings',
      description: 'Configure safe LinkedIn automation rules',
      icon: CogIcon,
      href: '/dashboard/automation',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      hoverColor: 'hover:bg-gray-100'
    }
  ]

  return (
    <div className="bg-white rounded-lg shadow-soft">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
        <p className="text-sm text-gray-600 mt-1">
          Jump into the most popular features to boost your LinkedIn presence
        </p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className={`group relative rounded-lg p-4 transition-colors duration-200 ${action.bgColor} ${action.hoverColor}`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <action.icon className={`h-6 w-6 ${action.color}`} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 group-hover:text-gray-800">
                    {action.title}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 group-hover:text-gray-700">
                    {action.description}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <svg 
                    className="h-4 w-4 text-gray-400 group-hover:text-gray-500 transition-colors" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    strokeWidth="1.5" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default QuickActions