import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/router'
import AppLayout from '../../components/Layout/AppLayout'
import LinkedInConnectionStep from '../../components/Onboarding/LinkedInConnectionStep'
import ProfileSetupStep from '../../components/Onboarding/ProfileSetupStep'
import PreferencesStep from '../../components/Onboarding/PreferencesStep'
import CompletionStep from '../../components/Onboarding/CompletionStep'

type OnboardingStep = 'linkedin' | 'profile' | 'preferences' | 'complete'

const OnboardingPage: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('linkedin')
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStep>>(new Set())

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/signin?callbackUrl=/onboarding')
    }
  }, [loading, isAuthenticated, router])

  if (loading) {
    return (
      <AppLayout showSidebar={false} showFooter={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AppLayout>
    )
  }

  if (!session) {
    return null
  }

  const steps: { key: OnboardingStep; title: string; description: string }[] = [
    {
      key: 'linkedin',
      title: 'Connect LinkedIn',
      description: 'Link your LinkedIn account to get started'
    },
    {
      key: 'profile',
      title: 'Profile Setup',
      description: 'Complete your profile information'
    },
    {
      key: 'preferences',
      title: 'Preferences',
      description: 'Customize your experience'
    },
    {
      key: 'complete',
      title: 'All Set!',
      description: 'Welcome to InErgize'
    }
  ]

  const currentStepIndex = steps.findIndex(step => step.key === currentStep)

  const handleStepComplete = (step: OnboardingStep) => {
    setCompletedSteps(prev => new Set([...prev, step]))
    
    const nextStepIndex = currentStepIndex + 1
    if (nextStepIndex < steps.length) {
      setCurrentStep(steps[nextStepIndex].key)
    }
  }

  const handleStepBack = () => {
    const prevStepIndex = currentStepIndex - 1
    if (prevStepIndex >= 0) {
      setCurrentStep(steps[prevStepIndex].key)
    }
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'linkedin':
        return (
          <LinkedInConnectionStep
            onComplete={() => handleStepComplete('linkedin')}
            onSkip={() => handleStepComplete('linkedin')}
          />
        )
      case 'profile':
        return (
          <ProfileSetupStep
            onComplete={() => handleStepComplete('profile')}
            onBack={handleStepBack}
          />
        )
      case 'preferences':
        return (
          <PreferencesStep
            onComplete={() => handleStepComplete('preferences')}
            onBack={handleStepBack}
          />
        )
      case 'complete':
        return (
          <CompletionStep
            onComplete={() => router.push('/dashboard')}
          />
        )
      default:
        return null
    }
  }

  return (
    <AppLayout showSidebar={false} showFooter={false}>
      <div className="min-h-screen bg-gray-50">
        {/* Progress indicator */}
        <div className="bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <nav aria-label="Progress">
                <ol className="flex items-center">
                  {steps.map((step, index) => (
                    <li key={step.key} className="relative flex-1">
                      {index !== 0 && (
                        <div
                          className={`absolute left-0 top-4 -ml-px h-0.5 w-full ${
                            completedSteps.has(step.key) || currentStepIndex > index
                              ? 'bg-primary-600'
                              : 'bg-gray-200'
                          }`}
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex items-start">
                        <span className="h-9 flex items-center">
                          <span
                            className={`relative z-10 w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold ${
                              completedSteps.has(step.key)
                                ? 'bg-primary-600 text-white'
                                : currentStep === step.key
                                ? 'bg-primary-600 text-white'
                                : 'bg-white border-2 border-gray-300 text-gray-500'
                            }`}
                          >
                            {completedSteps.has(step.key) ? (
                              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <span>{index + 1}</span>
                            )}
                          </span>
                        </span>
                        <span className="ml-4 min-w-0 flex flex-col">
                          <span
                            className={`text-sm font-medium ${
                              currentStep === step.key ? 'text-primary-600' : 'text-gray-500'
                            }`}
                          >
                            {step.title}
                          </span>
                          <span className="text-sm text-gray-500">{step.description}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>
          </div>
        </div>

        {/* Step content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {renderCurrentStep()}
        </div>
      </div>
    </AppLayout>
  )
}

export default OnboardingPage