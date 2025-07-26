import React, { useState } from 'react'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'

interface LinkedInConnectionStepProps {
  onComplete: () => void
  onSkip: () => void
}

const LinkedInConnectionStep: React.FC<LinkedInConnectionStepProps> = ({
  onComplete,
  onSkip
}) => {
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnectLinkedIn = async () => {
    setIsConnecting(true)
    try {
      await signIn('linkedin', { 
        callbackUrl: '/onboarding?step=profile',
        redirect: false 
      })
      toast.success('LinkedIn connected successfully!')
      onComplete()
    } catch (_error) {
      toast.error('Failed to connect LinkedIn. Please try again.')
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="mx-auto h-24 w-24 bg-linkedin-100 rounded-full flex items-center justify-center mb-6">
          <svg className="h-12 w-12 text-linkedin-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Connect Your LinkedIn Account
        </h2>
        <p className="text-lg text-gray-600 mb-8">
          Connect your LinkedIn account to unlock powerful profile optimization features and personalized recommendations.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-soft p-8 mb-6">
        <div className="space-y-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 bg-success-100 rounded-full flex items-center justify-center">
                <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Profile Analysis</h3>
              <p className="text-gray-600">Get detailed insights into your LinkedIn profile completeness and optimization opportunities.</p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 bg-success-100 rounded-full flex items-center justify-center">
                <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Smart Automation</h3>
              <p className="text-gray-600">Safely automate connection requests and engagement while staying compliant with LinkedIn's terms.</p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 bg-success-100 rounded-full flex items-center justify-center">
                <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Performance Tracking</h3>
              <p className="text-gray-600">Monitor your profile views, connection growth, and post engagement with detailed analytics.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Your data is secure
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                We use LinkedIn's official API and only access the data you explicitly authorize. 
                Your information is encrypted and stored securely, and you can disconnect at any time.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={handleConnectLinkedIn}
          disabled={isConnecting}
          className="btn-linkedin text-lg px-8 py-3 min-w-[200px] flex justify-center items-center"
        >
          {isConnecting ? (
            <div className="flex items-center">
              <div className="animate-spin -ml-1 mr-3 h-5 w-5 text-white">
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              Connecting...
            </div>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Connect LinkedIn
            </>
          )}
        </button>
        
        <button
          onClick={onSkip}
          className="btn-secondary text-lg px-8 py-3 min-w-[200px]"
        >
          Skip for Now
        </button>
      </div>

      <div className="text-center mt-6">
        <p className="text-sm text-gray-500">
          You can always connect your LinkedIn account later in your profile settings.
        </p>
      </div>
    </div>
  )
}

export default LinkedInConnectionStep