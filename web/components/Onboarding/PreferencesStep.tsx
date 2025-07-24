import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

interface PreferencesStepProps {
  onComplete: () => void
  onBack: () => void
}

type FormData = {
  automationSettings: {
    enableConnectionRequests: boolean
    enablePostLikes: boolean
    enableContentSharing: boolean
    maxConnectionsPerDay: number
  }
  notificationSettings: {
    emailNotifications: boolean
    profileUpdates: boolean
    analyticsReports: boolean
    marketingEmails: boolean
  }
  privacySettings: {
    profileVisibility: 'public' | 'connections' | 'private'
    shareAnalytics: boolean
  }
}

const PreferencesStep: React.FC<PreferencesStepProps> = ({
  onComplete,
  onBack
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { register, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      automationSettings: {
        enableConnectionRequests: false,
        enablePostLikes: true,
        enableContentSharing: false,
        maxConnectionsPerDay: 10,
      },
      notificationSettings: {
        emailNotifications: true,
        profileUpdates: true,
        analyticsReports: true,
        marketingEmails: false,
      },
      privacySettings: {
        profileVisibility: 'public',
        shareAnalytics: false,
      },
    },
  })

  const enableConnectionRequests = watch('automationSettings.enableConnectionRequests')

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }

      toast.success('Preferences saved successfully!')
      onComplete()
    } catch (error) {
      toast.error('Failed to save preferences. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Customize Your Experience
        </h2>
        <p className="text-lg text-gray-600">
          Set your preferences for automation, notifications, and privacy. You can change these settings anytime.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-soft p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Automation Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Automation Settings</h3>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    {...register('automationSettings.enableConnectionRequests')}
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="ml-3">
                  <label className="text-sm font-medium text-gray-700">
                    Enable Connection Requests
                  </label>
                  <p className="text-sm text-gray-500">
                    Automatically send connection requests to relevant professionals in your industry.
                  </p>
                </div>
              </div>

              {enableConnectionRequests && (
                <div className="ml-8">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum connections per day
                  </label>
                  <select
                    {...register('automationSettings.maxConnectionsPerDay')}
                    className="input-primary max-w-xs"
                  >
                    <option value={5}>5 connections</option>
                    <option value={10}>10 connections</option>
                    <option value={15}>15 connections</option>
                    <option value={20}>20 connections</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    We recommend staying under 20 to maintain account safety.
                  </p>
                </div>
              )}

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    {...register('automationSettings.enablePostLikes')}
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="ml-3">
                  <label className="text-sm font-medium text-gray-700">
                    Enable Post Engagement
                  </label>
                  <p className="text-sm text-gray-500">
                    Automatically like and comment on posts from your network to increase visibility.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    {...register('automationSettings.enableContentSharing')}
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="ml-3">
                  <label className="text-sm font-medium text-gray-700">
                    Enable Content Sharing
                  </label>
                  <p className="text-sm text-gray-500">
                    Automatically share relevant industry content to your network.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h3>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    {...register('notificationSettings.emailNotifications')}
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="ml-3">
                  <label className="text-sm font-medium text-gray-700">
                    Email Notifications
                  </label>
                  <p className="text-sm text-gray-500">
                    Receive email updates about your account activity and important changes.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    {...register('notificationSettings.profileUpdates')}
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="ml-3">
                  <label className="text-sm font-medium text-gray-700">
                    Profile Update Reminders
                  </label>
                  <p className="text-sm text-gray-500">
                    Get reminded when it's time to update your LinkedIn profile for better visibility.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    {...register('notificationSettings.analyticsReports')}
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="ml-3">
                  <label className="text-sm font-medium text-gray-700">
                    Weekly Analytics Reports
                  </label>
                  <p className="text-sm text-gray-500">
                    Receive weekly summaries of your LinkedIn performance and engagement.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    {...register('notificationSettings.marketingEmails')}
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="ml-3">
                  <label className="text-sm font-medium text-gray-700">
                    Marketing Emails
                  </label>
                  <p className="text-sm text-gray-500">
                    Receive updates about new features, tips, and special offers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Visibility
                </label>
                <select
                  {...register('privacySettings.profileVisibility')}
                  className="input-primary max-w-xs"
                >
                  <option value="public">Public - Visible to everyone</option>
                  <option value="connections">Connections Only - Visible to your connections</option>
                  <option value="private">Private - Not visible to others</option>
                </select>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    {...register('privacySettings.shareAnalytics')}
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="ml-3">
                  <label className="text-sm font-medium text-gray-700">
                    Share Anonymous Analytics
                  </label>
                  <p className="text-sm text-gray-500">
                    Help us improve our platform by sharing anonymized usage data.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onBack}
              className="btn-secondary text-lg px-8 py-3 order-2 sm:order-1"
            >
              Back
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-lg px-8 py-3 order-1 sm:order-2 flex-1 sm:flex-none"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin -ml-1 mr-3 h-5 w-5 text-white">
                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  Saving...
                </div>
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PreferencesStep