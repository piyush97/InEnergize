"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Settings,
  Clock,
  Shield,
  Target,
  AlertTriangle,
  CheckCircle,
  Save,
  RotateCcw,
  Users,
  Heart,
  MessageSquare,
  Eye,
  UserPlus,
  Calendar,
  Zap,
  Bell,
  Lock,
  Globe
} from "lucide-react";

import {
  AutomationSettingsProps,
  AutomationSettings as AutomationSettingsType
} from "@/types/automation";

interface SettingsSection {
  title: string;
  description: string;
  isDirty: boolean;
}

export function AutomationSettings({
  userId,
  settings,
  onUpdateSettings
}: AutomationSettingsProps) {
  const [activeTab, setActiveTab] = useState("connection");
  const [localSettings, setLocalSettings] = useState<AutomationSettingsType>(settings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Industries and locations for filtering
  const INDUSTRIES = [
    "Technology", "Finance", "Healthcare", "Education", "Manufacturing",
    "Retail", "Consulting", "Marketing", "Real Estate", "Legal",
    "Non-profit", "Government", "Media", "Transportation", "Energy"
  ];

  const LOCATIONS = [
    "San Francisco, CA", "New York, NY", "Los Angeles, CA", "Chicago, IL",
    "Boston, MA", "Seattle, WA", "Austin, TX", "Denver, CO", "Atlanta, GA",
    "Miami, FL", "London, UK", "Toronto, ON", "Berlin, Germany", "Remote"
  ];

  // Check for unsaved changes
  useEffect(() => {
    const settingsChanged = JSON.stringify(localSettings) !== JSON.stringify(settings);
    setHasUnsavedChanges(settingsChanged);
  }, [localSettings, settings]);

  const handleSettingsUpdate = (section: keyof AutomationSettingsType, updates: Record<string, unknown>) => {
    setLocalSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...updates
      }
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      await onUpdateSettings(localSettings);
      
      setSuccessMessage("Settings saved successfully!");
      setHasUnsavedChanges(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSettings = () => {
    if (hasUnsavedChanges && !confirm("Are you sure you want to discard your changes?")) {
      return;
    }
    
    setLocalSettings(settings);
    setError(null);
    setSuccessMessage(null);
  };

  const handleIndustryToggle = (industry: string) => {
    const currentIndustries = localSettings.connectionAutomation.targetFilters.industries;
    const updatedIndustries = currentIndustries.includes(industry)
      ? currentIndustries.filter(i => i !== industry)
      : [...currentIndustries, industry];

    handleSettingsUpdate('connectionAutomation', {
      targetFilters: {
        ...localSettings.connectionAutomation.targetFilters,
        industries: updatedIndustries
      }
    });
  };

  const handleLocationToggle = (location: string) => {
    const currentLocations = localSettings.connectionAutomation.targetFilters.locations;
    const updatedLocations = currentLocations.includes(location)
      ? currentLocations.filter(l => l !== location)
      : [...currentLocations, location];

    handleSettingsUpdate('connectionAutomation', {
      targetFilters: {
        ...localSettings.connectionAutomation.targetFilters,
        locations: updatedLocations
      }
    });
  };

  const handleConnectionDegreeToggle = (degree: '1st' | '2nd' | '3rd') => {
    const currentDegrees = localSettings.connectionAutomation.targetFilters.connectionDegree;
    const updatedDegrees = currentDegrees.includes(degree)
      ? currentDegrees.filter(d => d !== degree)
      : [...currentDegrees, degree];

    handleSettingsUpdate('connectionAutomation', {
      targetFilters: {
        ...localSettings.connectionAutomation.targetFilters,
        connectionDegree: updatedDegrees
      }
    });
  };

  const validateSettings = () => {
    const errors: string[] = [];

    // Connection automation validation
    if (localSettings.connectionAutomation.dailyLimit > 50) {
      errors.push("Daily connection limit exceeds safe maximum (50)");
    }
    if (localSettings.connectionAutomation.minDelaySeconds < 30) {
      errors.push("Minimum delay between connections should be at least 30 seconds");
    }

    // Engagement automation validation
    if (localSettings.engagementAutomation.types.likes.dailyLimit > 100) {
      errors.push("Daily likes limit exceeds safe maximum (100)");
    }
    if (localSettings.engagementAutomation.minDelaySeconds < 30) {
      errors.push("Minimum delay between engagements should be at least 30 seconds");
    }

    // Safety settings validation
    if (localSettings.safetySettings.emergencyStopThreshold < 40) {
      errors.push("Emergency stop threshold should be at least 40 for safety");
    }

    return errors;
  };

  const validationErrors = validateSettings();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <Settings className="h-6 w-6 mr-2" />
            Automation Settings
          </h2>
          <p className="text-muted-foreground">
            Configure your LinkedIn automation preferences and safety controls
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              Unsaved Changes
            </Badge>
          )}
          <Button variant="outline" onClick={handleResetSettings} disabled={loading}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSaveSettings} disabled={loading || !hasUnsavedChanges}>
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {validationErrors.length > 0 && (
        <Alert className="border-yellow-500 bg-yellow-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div>
              <strong>Settings Validation Issues:</strong>
              <ul className="list-disc list-inside mt-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connection">Connections</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="targeting">Targeting</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Connection Automation Settings
              </CardTitle>
              <CardDescription>
                Configure how connection requests are sent automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="connection-enabled"
                  checked={localSettings.connectionAutomation.enabled}
                  onCheckedChange={(checked) => 
                    handleSettingsUpdate('connectionAutomation', { enabled: checked })
                  }
                />
                <Label htmlFor="connection-enabled" className="text-sm font-medium">
                  Enable connection automation
                </Label>
              </div>

              {/* Daily Limits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="daily-limit">Daily Connection Limit</Label>
                  <Input
                    id="daily-limit"
                    type="number"
                    min="1"
                    max="50"
                    value={localSettings.connectionAutomation.dailyLimit}
                    onChange={(e) => 
                      handleSettingsUpdate('connectionAutomation', { 
                        dailyLimit: parseInt(e.target.value) || 15 
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum connections per day (LinkedIn safe limit: 15-20)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Current Usage</Label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Today</span>
                      <span className="text-sm font-medium">0/{localSettings.connectionAutomation.dailyLimit}</span>
                    </div>
                    <Progress value={0} className="h-2" />
                  </div>
                </div>
              </div>

              {/* Timing Settings */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Timing & Schedule
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min-delay">Minimum Delay (seconds)</Label>
                    <Input
                      id="min-delay"
                      type="number"
                      min="30"
                      max="300"
                      value={localSettings.connectionAutomation.minDelaySeconds}
                      onChange={(e) => 
                        handleSettingsUpdate('connectionAutomation', { 
                          minDelaySeconds: parseInt(e.target.value) || 45 
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-delay">Maximum Delay (seconds)</Label>
                    <Input
                      id="max-delay"
                      type="number"
                      min="60"
                      max="600"
                      value={localSettings.connectionAutomation.maxDelaySeconds}
                      onChange={(e) => 
                        handleSettingsUpdate('connectionAutomation', { 
                          maxDelaySeconds: parseInt(e.target.value) || 180 
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="work-start">Working Hours Start</Label>
                    <Input
                      id="work-start"
                      type="time"
                      value={localSettings.connectionAutomation.workingHours.start}
                      onChange={(e) => 
                        handleSettingsUpdate('connectionAutomation', { 
                          workingHours: {
                            ...localSettings.connectionAutomation.workingHours,
                            start: e.target.value
                          }
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="work-end">Working Hours End</Label>
                    <Input
                      id="work-end"
                      type="time"
                      value={localSettings.connectionAutomation.workingHours.end}
                      onChange={(e) => 
                        handleSettingsUpdate('connectionAutomation', { 
                          workingHours: {
                            ...localSettings.connectionAutomation.workingHours,
                            end: e.target.value
                          }
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="weekends-enabled"
                    checked={localSettings.connectionAutomation.weekendsEnabled}
                    onCheckedChange={(checked) => 
                      handleSettingsUpdate('connectionAutomation', { weekendsEnabled: checked })
                    }
                  />
                  <Label htmlFor="weekends-enabled" className="text-sm">
                    Allow connections on weekends (reduced activity)
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Heart className="h-5 w-5 mr-2" />
                Engagement Automation Settings
              </CardTitle>
              <CardDescription>
                Configure automatic likes, comments, and profile interactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="engagement-enabled"
                  checked={localSettings.engagementAutomation.enabled}
                  onCheckedChange={(checked) => 
                    handleSettingsUpdate('engagementAutomation', { enabled: checked })
                  }
                />
                <Label htmlFor="engagement-enabled" className="text-sm font-medium">
                  Enable engagement automation
                </Label>
              </div>

              {/* Engagement Types */}
              <div className="space-y-4">
                <h4 className="font-medium">Engagement Types & Limits</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Likes */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Heart className="h-4 w-4 text-red-500" />
                        <span className="font-medium">Likes</span>
                      </div>
                      <Checkbox
                        checked={localSettings.engagementAutomation.types.likes.enabled}
                        onCheckedChange={(checked) => 
                          handleSettingsUpdate('engagementAutomation', {
                            types: {
                              ...localSettings.engagementAutomation.types,
                              likes: { ...localSettings.engagementAutomation.types.likes, enabled: checked }
                            }
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Daily Limit</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={localSettings.engagementAutomation.types.likes.dailyLimit}
                        onChange={(e) => 
                          handleSettingsUpdate('engagementAutomation', {
                            types: {
                              ...localSettings.engagementAutomation.types,
                              likes: { 
                                ...localSettings.engagementAutomation.types.likes, 
                                dailyLimit: parseInt(e.target.value) || 30 
                              }
                            }
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Comments */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Comments</span>
                      </div>
                      <Checkbox
                        checked={localSettings.engagementAutomation.types.comments.enabled}
                        onCheckedChange={(checked) => 
                          handleSettingsUpdate('engagementAutomation', {
                            types: {
                              ...localSettings.engagementAutomation.types,
                              comments: { ...localSettings.engagementAutomation.types.comments, enabled: checked }
                            }
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Daily Limit</Label>
                      <Input
                        type="number"
                        min="0"
                        max="50"
                        value={localSettings.engagementAutomation.types.comments.dailyLimit}
                        onChange={(e) => 
                          handleSettingsUpdate('engagementAutomation', {
                            types: {
                              ...localSettings.engagementAutomation.types,
                              comments: { 
                                ...localSettings.engagementAutomation.types.comments, 
                                dailyLimit: parseInt(e.target.value) || 8 
                              }
                            }
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Profile Views */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Eye className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Profile Views</span>
                      </div>
                      <Checkbox
                        checked={localSettings.engagementAutomation.types.profileViews.enabled}
                        onCheckedChange={(checked) => 
                          handleSettingsUpdate('engagementAutomation', {
                            types: {
                              ...localSettings.engagementAutomation.types,
                              profileViews: { ...localSettings.engagementAutomation.types.profileViews, enabled: checked }
                            }
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Daily Limit</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={localSettings.engagementAutomation.types.profileViews.dailyLimit}
                        onChange={(e) => 
                          handleSettingsUpdate('engagementAutomation', {
                            types: {
                              ...localSettings.engagementAutomation.types,
                              profileViews: { 
                                ...localSettings.engagementAutomation.types.profileViews, 
                                dailyLimit: parseInt(e.target.value) || 25 
                              }
                            }
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Follows */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <UserPlus className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">Follows</span>
                      </div>
                      <Checkbox
                        checked={localSettings.engagementAutomation.types.follows.enabled}
                        onCheckedChange={(checked) => 
                          handleSettingsUpdate('engagementAutomation', {
                            types: {
                              ...localSettings.engagementAutomation.types,
                              follows: { ...localSettings.engagementAutomation.types.follows, enabled: checked }
                            }
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Daily Limit</Label>
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        value={localSettings.engagementAutomation.types.follows.dailyLimit}
                        onChange={(e) => 
                          handleSettingsUpdate('engagementAutomation', {
                            types: {
                              ...localSettings.engagementAutomation.types,
                              follows: { 
                                ...localSettings.engagementAutomation.types.follows, 
                                dailyLimit: parseInt(e.target.value) || 5 
                              }
                            }
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Timing Settings */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Engagement Timing
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Minimum Delay (seconds)</Label>
                    <Input
                      type="number"
                      min="30"
                      max="300"
                      value={localSettings.engagementAutomation.minDelaySeconds}
                      onChange={(e) => 
                        handleSettingsUpdate('engagementAutomation', { 
                          minDelaySeconds: parseInt(e.target.value) || 60 
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Maximum Delay (seconds)</Label>
                    <Input
                      type="number"
                      min="60"
                      max="600"
                      value={localSettings.engagementAutomation.maxDelaySeconds}
                      onChange={(e) => 
                        handleSettingsUpdate('engagementAutomation', { 
                          maxDelaySeconds: parseInt(e.target.value) || 300 
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="targeting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Target Audience Settings
              </CardTitle>
              <CardDescription>
                Define your ideal connection and engagement targets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connection Degrees */}
              <div className="space-y-3">
                <h4 className="font-medium">Connection Degrees</h4>
                <div className="flex items-center space-x-6">
                  {(['1st', '2nd', '3rd'] as const).map(degree => (
                    <label key={degree} className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={localSettings.connectionAutomation.targetFilters.connectionDegree.includes(degree)}
                        onCheckedChange={() => handleConnectionDegreeToggle(degree)}
                      />
                      <span>{degree} degree connections</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Industries */}
              <div className="space-y-3">
                <h4 className="font-medium">Target Industries</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                  {INDUSTRIES.map(industry => (
                    <label key={industry} className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={localSettings.connectionAutomation.targetFilters.industries.includes(industry)}
                        onCheckedChange={() => handleIndustryToggle(industry)}
                      />
                      <span className="text-sm">{industry}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected: {localSettings.connectionAutomation.targetFilters.industries.length} industries
                </p>
              </div>

              {/* Locations */}
              <div className="space-y-3">
                <h4 className="font-medium">Target Locations</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                  {LOCATIONS.map(location => (
                    <label key={location} className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={localSettings.connectionAutomation.targetFilters.locations.includes(location)}
                        onCheckedChange={() => handleLocationToggle(location)}
                      />
                      <span className="text-sm">{location}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected: {localSettings.connectionAutomation.targetFilters.locations.length} locations
                </p>
              </div>

              {/* Additional Filters */}
              <div className="space-y-4">
                <h4 className="font-medium">Additional Filters</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Minimum Connections</Label>
                    <Input
                      type="number"
                      min="0"
                      max="500"
                      placeholder="e.g., 100"
                      value={localSettings.connectionAutomation.targetFilters.minimumConnections || ''}
                      onChange={(e) => 
                        handleSettingsUpdate('connectionAutomation', {
                          targetFilters: {
                            ...localSettings.connectionAutomation.targetFilters,
                            minimumConnections: parseInt(e.target.value) || undefined
                          }
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Only target users with at least this many connections
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="profile-picture"
                        checked={localSettings.connectionAutomation.targetFilters.hasProfilePicture}
                        onCheckedChange={(checked) => 
                          handleSettingsUpdate('connectionAutomation', {
                            targetFilters: {
                              ...localSettings.connectionAutomation.targetFilters,
                              hasProfilePicture: checked
                            }
                          })
                        }
                      />
                      <Label htmlFor="profile-picture">Require profile picture</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Only target users with profile pictures
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Safety & Compliance Settings
              </CardTitle>
              <CardDescription>
                Configure safety thresholds and emergency controls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Emergency Stop Settings */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Emergency Controls
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Emergency Stop Threshold</Label>
                    <Input
                      type="number"
                      min="10"
                      max="90"
                      value={localSettings.safetySettings.emergencyStopThreshold}
                      onChange={(e) => 
                        handleSettingsUpdate('safetySettings', { 
                          emergencyStopThreshold: parseInt(e.target.value) || 60 
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Stop automation when safety score drops below this threshold
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Daily Actions</Label>
                    <Input
                      type="number"
                      min="10"
                      max="200"
                      value={localSettings.safetySettings.maxDailyActions}
                      onChange={(e) => 
                        handleSettingsUpdate('safetySettings', { 
                          maxDailyActions: parseInt(e.target.value) || 100 
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum total automation actions per day
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cooldown Period (hours)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="72"
                    value={localSettings.safetySettings.cooldownPeriodHours}
                    onChange={(e) => 
                      handleSettingsUpdate('safetySettings', { 
                        cooldownPeriodHours: parseInt(e.target.value) || 24 
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    How long to wait before resuming after emergency stop
                  </p>
                </div>
              </div>

              {/* Alert Settings */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center">
                  <Bell className="h-4 w-4 mr-2" />
                  Alert Preferences
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="email-alerts"
                      checked={localSettings.safetySettings.alertEmail}
                      onCheckedChange={(checked) => 
                        handleSettingsUpdate('safetySettings', { alertEmail: checked })
                      }
                    />
                    <Label htmlFor="email-alerts">Send email alerts for safety issues</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Webhook URL (optional)</Label>
                    <Input
                      type="url"
                      placeholder="https://your-webhook-url.com"
                      value={localSettings.safetySettings.alertWebhook || ''}
                      onChange={(e) => 
                        handleSettingsUpdate('safetySettings', { 
                          alertWebhook: e.target.value || undefined 
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Send safety alerts to this webhook endpoint
                    </p>
                  </div>
                </div>
              </div>

              {/* Safety Guidelines */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                  <Lock className="h-4 w-4 mr-2" />
                  LinkedIn Compliance Guidelines
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Maximum 15-20 connection requests per day</li>
                  <li>• Maximum 30-50 likes per day</li>
                  <li>• Maximum 8-10 comments per day</li>
                  <li>• Minimum 30-45 seconds between actions</li>
                  <li>• Maintain human-like behavior patterns</li>
                  <li>• Monitor acceptance rates and adjust accordingly</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}