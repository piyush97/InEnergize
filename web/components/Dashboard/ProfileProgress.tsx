import React from 'react'
import Link from 'next/link'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface ProfileProgressData {
  completionScore: number
  improvements: Array<{
    id: string
    title: string
    description: string
    completed: boolean
    impact: 'high' | 'medium' | 'low'
    url?: string
  }>
}

interface ProfileProgressProps {
  data?: ProfileProgressData
}

const ProfileProgress: React.FC<ProfileProgressProps> = ({ data }) => {
  const progressData = data || {
    completionScore: 65,
    improvements: [
      {
        id: '1',
        title: 'Add Professional Headline',
        description: 'Create a compelling headline that describes your role and value proposition',
        completed: false,
        impact: 'high' as const,
        url: '/dashboard/profile'
      },
      {
        id: '2',
        title: 'Upload Professional Photo',
        description: 'Add a high-quality headshot to increase profile credibility',
        completed: true,
        impact: 'high' as const,
      },
      {
        id: '3',
        title: 'Write Summary Section',
        description: 'Craft a professional summary highlighting your experience and goals',
        completed: false,
        impact: 'medium' as const,
        url: '/dashboard/profile'
      },
      {
        id: '4',
        title: 'Add Skills & Endorsements',
        description: 'List relevant skills to improve discoverability',
        completed: true,
        impact: 'medium' as const,
      },
      {
        id: '5',
        title: 'Connect with Colleagues',
        description: 'Build your network by connecting with current and former colleagues',
        completed: false,
        impact: 'low' as const,
        url: '/dashboard/network'
      }
    ]
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'text-red-600 bg-red-50'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50'
      case 'low':
        return 'text-green-600 bg-green-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getImpactLabel = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'High Impact'
      case 'medium':
        return 'Medium Impact'  
      case 'low':
        return 'Low Impact'
      default:
        return 'Unknown'
    }
  }

  const completionPercentage = progressData.completionScore
  const completedCount = progressData.improvements.filter(item => item.completed).length
  const totalCount = progressData.improvements.length

  return (
    <div className="bg-white rounded-lg shadow-soft">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Profile Optimization</h2>
          <Link
            href="/dashboard/profile"
            className="text-sm text-primary-600 hover:text-primary-500 font-medium"
          >
            View Full Analysis →
          </Link>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Completion Score</span>
            <span className="font-semibold">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
            <span>{completedCount} of {totalCount} completed</span>
            <span>
              {completionPercentage >= 80 ? 'Excellent!' : 
               completionPercentage >= 60 ? 'Good progress' : 'Needs improvement'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Recommended Improvements
        </h3>
        
        <div className="space-y-4">
          {progressData.improvements.slice(0, 4).map((improvement) => (
            <div key={improvement.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                {improvement.completed ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-gray-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium ${
                    improvement.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                  }`}>
                    {improvement.title}
                  </p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    getImpactColor(improvement.impact)
                  }`}>
                    {getImpactLabel(improvement.impact)}
                  </span>
                </div>
                <p className={`text-sm mt-1 ${
                  improvement.completed ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {improvement.description}
                </p>
                {!improvement.completed && improvement.url && (
                  <Link
                    href={improvement.url}
                    className="text-xs text-primary-600 hover:text-primary-500 mt-1 inline-block"
                  >
                    Take action →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {progressData.improvements.length > 4 && (
          <div className="mt-6 text-center">
            <Link
              href="/dashboard/profile"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              View {progressData.improvements.length - 4} more recommendations
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfileProgress