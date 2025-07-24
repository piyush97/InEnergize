import React from 'react'
import Link from 'next/link'

interface CompletionStepProps {
  onComplete: () => void
}

const CompletionStep: React.FC<CompletionStepProps> = ({ onComplete }) => {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="mx-auto h-24 w-24 bg-success-100 rounded-full flex items-center justify-center mb-6">
          <svg className="h-12 w-12 text-success-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to InErgize! 🎉
        </h2>
        <p className="text-lg text-gray-600 mb-8">
          You're all set! Your account has been configured and you're ready to start optimizing your LinkedIn presence.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-soft p-8 mb-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">
          Here's what you can do next:
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-left">
            <div className="h-10 w-10 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Analyze Your Profile</h4>
            <p className="text-gray-600 text-sm">
              Get instant insights into your LinkedIn profile completeness and optimization opportunities.
            </p>
          </div>

          <div className="text-left">
            <div className="h-10 w-10 bg-linkedin-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="h-6 w-6 text-linkedin-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-4.5B0 11.625 3 3.375 3.375-3.375h-4.5A3.375 3.375 0 004.5 11.625v2.625M3.75 18.75v-4.5a1.125 1.125 0 011.125-1.125h12.5a1.125 1.125 0 011.125 1.125v4.5M3.75 18.75h16.5A1.875 1.875 0 0022.125 16.875v-4.5A1.875 1.875 0 0020.25 10.5H3.75a1.875 1.875 0 00-1.875 1.875v4.5A1.875 1.875 0 003.75 18.75z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Generate Content</h4>
            <p className="text-gray-600 text-sm">
              Create engaging LinkedIn posts and professional banners with our AI-powered tools.
            </p>
          </div>

          <div className="text-left">
            <div className="h-10 w-10 bg-success-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Track Analytics</h4>
            <p className="text-gray-600 text-sm">
              Monitor your LinkedIn performance with detailed insights and growth metrics.
            </p>
          </div>

          <div className="text-left">
            <div className="h-10 w-10 bg-warning-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="h-6 w-6 text-warning-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5m-18 0h18" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Schedule Posts</h4>
            <p className="text-gray-600 text-sm">
              Plan and schedule your LinkedIn content for optimal engagement times.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-8">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189l4.218-1.286a1.125 1.125 0 01.979.323c.247.248.369.585.369.934v3.475a1.125 1.125 0 01-.932 1.105l-4.218 1.286a6.01 6.01 0 01-1.5.189V12.75zm0 0v-1.5a6.01 6.01 0 00-1.5-.189l-4.218-1.286A1.125 1.125 0 014.75 9.75V6.275c0-.35.122-.687.369-.934a1.125 1.125 0 01.979-.323l4.218 1.286c.49.151 1.003.174 1.5.189V12.75z" />
            </svg>
          </div>
          <div className="ml-4 text-left">
            <h4 className="text-lg font-semibold text-primary-900 mb-2">
              🚀 Pro Tip: Start with Profile Analysis
            </h4>
            <p className="text-primary-800 text-sm">
              We recommend starting with a profile analysis to identify quick wins and optimization opportunities. 
              This will give you a baseline to track your progress.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={onComplete}
          className="btn-primary text-lg px-8 py-3 min-w-[200px]"
        >
          Go to Dashboard
        </button>
        
        <Link
          href="/dashboard/profile"
          className="btn-secondary text-lg px-8 py-3 min-w-[200px] inline-flex items-center justify-center"
        >
          Analyze Profile First
        </Link>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Need help getting started?{' '}
          <Link href="/support" className="text-primary-600 hover:text-primary-500 font-medium">
            Visit our Help Center
          </Link>
        </p>
      </div>
    </div>
  )
}

export default CompletionStep