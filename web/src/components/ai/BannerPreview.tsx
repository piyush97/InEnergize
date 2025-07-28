'use client'

import React from 'react'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  EyeIcon
} from '@heroicons/react/24/outline'

interface BannerPreviewProps {
  banner: {
    id: string
    imageUrl: string
    altTexts: string[]
    qualityScore: number
    isLinkedInCompliant: boolean
    dimensions: { width: number; height: number }
    format: string
    fileSize: number
    usage: { cost: number }
    metadata?: {
      industry: string
      style?: string
      generatedAt: Date
    }
  }
  onDownload?: () => void
  onShare?: () => void
  className?: string
}

export const BannerPreview: React.FC<BannerPreviewProps> = ({
  banner,
  onDownload,
  onShare,
  className = ''
}) => {
  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getQualityIcon = (score: number) => {
    if (score >= 80) return <CheckCircleIcon className="h-4 w-4" />
    if (score >= 60) return <ExclamationTriangleIcon className="h-4 w-4" />
    return <ExclamationTriangleIcon className="h-4 w-4" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Banner Image Container */}
      <div className="relative bg-gray-100">
        <img
          src={banner.imageUrl}
          alt={banner.altTexts[0] || 'Generated LinkedIn banner'}
          className="w-full h-auto"
          style={{ aspectRatio: '1584/396' }}
        />
        
        {/* LinkedIn Dimension Overlay */}
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
          {banner.dimensions.width} × {banner.dimensions.height}
        </div>

        {/* Compliance Badge */}
        <div className="absolute top-2 right-2">
          {banner.isLinkedInCompliant ? (
            <div className="flex items-center bg-green-500 text-white px-2 py-1 rounded text-xs">
              <CheckCircleIcon className="h-3 w-3 mr-1" />
              LinkedIn Ready
            </div>
          ) : (
            <div className="flex items-center bg-red-500 text-white px-2 py-1 rounded text-xs">
              <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
              Check Required
            </div>
          )}
        </div>
      </div>

      {/* Banner Information */}
      <div className="p-4 space-y-4">
        {/* Quality Score */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Quality Score:</span>
            <div className={`flex items-center px-2 py-1 rounded-md border ${getQualityColor(banner.qualityScore)}`}>
              {getQualityIcon(banner.qualityScore)}
              <span className="ml-1 text-sm font-medium">{banner.qualityScore}/100</span>
            </div>
          </div>
          
          {banner.metadata && (
            <div className="text-xs text-gray-500 capitalize">
              {banner.metadata.industry} • {banner.metadata.style}
            </div>
          )}
        </div>

        {/* Technical Details */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Format</div>
            <div className="font-medium">{banner.format}</div>
          </div>
          <div>
            <div className="text-gray-500">Size</div>
            <div className="font-medium">{formatFileSize(banner.fileSize)}</div>
          </div>
          <div>
            <div className="text-gray-500">Cost</div>
            <div className="font-medium">${banner.usage.cost.toFixed(3)}</div>
          </div>
        </div>

        {/* LinkedIn Specifications Check */}
        <div className="border-t pt-4">
          <div className="flex items-center mb-2">
            <InformationCircleIcon className="h-4 w-4 text-blue-500 mr-2" />
            <span className="text-sm font-medium text-gray-700">LinkedIn Specifications</span>
          </div>
          
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span>Dimensions (1584×396)</span>
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between">
              <span>File size (&lt;8MB)</span>
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between">
              <span>Format support</span>
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between">
              <span>Professional quality</span>
              {banner.qualityScore >= 70 ? (
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
              ) : (
                <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
              )}
            </div>
          </div>
        </div>

        {/* Quality Insights */}
        {banner.qualityScore < 80 && (
          <div className="border-t pt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Quality Suggestions</div>
            <div className="space-y-1 text-xs text-gray-600">
              {banner.qualityScore < 70 && (
                <div>• Consider adjusting colors for better professional appeal</div>
              )}
              {banner.qualityScore < 60 && (
                <div>• Text elements may need better positioning or sizing</div>
              )}
              {banner.qualityScore < 80 && (
                <div>• Try different style variations for improved visual impact</div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-4 border-t">
          <button
            onClick={onDownload}
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center text-sm font-medium"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Download
          </button>
          
          {onShare && (
            <button
              onClick={onShare}
              className="py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center text-sm font-medium"
            >
              <ShareIcon className="h-4 w-4 mr-2" />
              Share
            </button>
          )}
          
          <button
            onClick={() => window.open(banner.imageUrl, '_blank')}
            className="py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center text-sm font-medium"
            title="View full size"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Alt Text for Accessibility */}
        {banner.altTexts.length > 0 && (
          <div className="border-t pt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Accessibility Text
            </div>
            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
              {banner.altTexts[0]}
            </div>
            {banner.altTexts.length > 1 && (
              <div className="text-xs text-gray-500 mt-1">
                +{banner.altTexts.length - 1} more variations available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}