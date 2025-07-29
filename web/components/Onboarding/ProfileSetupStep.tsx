import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import toast from 'react-hot-toast'

const schema = yup.object({
  jobTitle: yup.string().required('Current job title is required'),
  industry: yup.string().required('Industry is required'),
  experienceLevel: yup.string().required('Experience level is required'),
  careerGoals: yup.array().min(1, 'Please select at least one career goal'),
  jobSearchStatus: yup.string().required('Job search status is required'),
})

type FormData = yup.InferType<typeof schema>

interface ProfileSetupStepProps {
  onComplete: () => void
  onBack: () => void
}

const ProfileSetupStep: React.FC<ProfileSetupStepProps> = ({
  onComplete,
  onBack
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
  })

  const industries = [
    'Technology',
    'Healthcare',
    'Finance',
    'Education',
    'Manufacturing',
    'Retail',
    'Consulting',
    'Real Estate',
    'Media & Communications',
    'Government',
    'Non-profit',
    'Other'
  ]

  const experienceLevels = [
    'Entry Level (0-2 years)',
    'Mid Level (3-5 years)',
    'Senior Level (6-10 years)',
    'Executive Level (10+ years)',
    'Student/Graduate'
  ]

  const careerGoalOptions = [
    'Find a new job',
    'Get promoted',
    'Build professional network',
    'Increase industry visibility',
    'Improve LinkedIn presence',
    'Generate more leads',
    'Establish thought leadership'
  ]

  const jobSearchStatuses = [
    'Actively looking',
    'Passively looking',
    'Not looking, but open',
    'Not looking at all'
  ]

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to save profile')
      }

      toast.success('Profile saved successfully!')
      onComplete()
    } catch {
      toast.error('Failed to save profile. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Complete Your Profile
        </h2>
        <p className="text-lg text-gray-600">
          Help us personalize your experience by sharing some basic information about your career.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-soft p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-2">
              Current Job Title *
            </label>
            <input
              {...register('jobTitle')}
              type="text"
              className={`input-primary ${errors.jobTitle ? 'input-error' : ''}`}
              placeholder="e.g., Software Engineer, Marketing Manager"
            />
            {errors.jobTitle && (
              <p className="mt-1 text-sm text-red-600">{errors.jobTitle.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
              Industry *
            </label>
            <select
              {...register('industry')}
              className={`input-primary ${errors.industry ? 'input-error' : ''}`}
            >
              <option value="">Select your industry</option>
              {industries.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
            {errors.industry && (
              <p className="mt-1 text-sm text-red-600">{errors.industry.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-700 mb-2">
              Experience Level *
            </label>
            <select
              {...register('experienceLevel')}
              className={`input-primary ${errors.experienceLevel ? 'input-error' : ''}`}
            >
              <option value="">Select your experience level</option>
              {experienceLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            {errors.experienceLevel && (
              <p className="mt-1 text-sm text-red-600">{errors.experienceLevel.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Career Goals * (Select all that apply)
            </label>
            <div className="space-y-2">
              {careerGoalOptions.map((goal) => (
                <label key={goal} className="flex items-center">
                  <input
                    {...register('careerGoals')}
                    type="checkbox"
                    value={goal}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-3"
                  />
                  <span className="text-sm text-gray-700">{goal}</span>
                </label>
              ))}
            </div>
            {errors.careerGoals && (
              <p className="mt-1 text-sm text-red-600">{errors.careerGoals.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="jobSearchStatus" className="block text-sm font-medium text-gray-700 mb-2">
              Job Search Status *
            </label>
            <select
              {...register('jobSearchStatus')}
              className={`input-primary ${errors.jobSearchStatus ? 'input-error' : ''}`}
            >
              <option value="">Select your job search status</option>
              {jobSearchStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {errors.jobSearchStatus && (
              <p className="mt-1 text-sm text-red-600">{errors.jobSearchStatus.message}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-6">
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

export default ProfileSetupStep