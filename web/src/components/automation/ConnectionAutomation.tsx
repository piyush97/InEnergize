"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users,
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  Target,
  TrendingUp,
  Filter,
  Search
} from "lucide-react";

import {
  ConnectionAutomationProps,
  ConnectionRequest,
  ScheduleConnectionRequest,
  MessageTemplate
} from "@/types/automation";

interface TargetProfile {
  id: string;
  name: string;
  headline: string;
  profileUrl: string;
  company?: string;
  location?: string;
  connectionDegree: '1st' | '2nd' | '3rd';
  mutualConnections: number;
  profilePicture?: string;
}

export function ConnectionAutomation({
  userId,
  templates,
  stats,
  onScheduleConnection,
  onCancelConnection
}: ConnectionAutomationProps) {
  const [activeTab, setActiveTab] = useState("schedule");
  const [connections, setConnections] = useState<ConnectionRequest[]>([]);
  const [targetProfiles, setTargetProfiles] = useState<TargetProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for scheduling connections
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [customMessage, setCustomMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Fetch connection requests
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const response = await fetch('/api/v1/automation/connections', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setConnections(data.requests || []);
        }
      } catch (err) {
        console.error('Failed to fetch connections:', err);
      }
    };

    fetchConnections();
  }, []);

  // Fetch potential target profiles (mock data for now)
  useEffect(() => {
    // In a real implementation, this would fetch from LinkedIn API or database
    const mockProfiles: TargetProfile[] = [
      {
        id: "profile-1",
        name: "Sarah Johnson",
        headline: "Senior Software Engineer at Google",
        profileUrl: "https://linkedin.com/in/sarah-johnson",
        company: "Google",
        location: "San Francisco, CA",
        connectionDegree: "2nd",
        mutualConnections: 5,
        profilePicture: "/api/placeholder/40/40"
      },
      {
        id: "profile-2",
        name: "Michael Chen",
        headline: "Product Manager at Microsoft",
        profileUrl: "https://linkedin.com/in/michael-chen",
        company: "Microsoft",
        location: "Seattle, WA",
        connectionDegree: "2nd",
        mutualConnections: 3,
        profilePicture: "/api/placeholder/40/40"
      },
      {
        id: "profile-3",
        name: "Emily Davis",
        headline: "Marketing Director at Startup Inc.",
        profileUrl: "https://linkedin.com/in/emily-davis",
        company: "Startup Inc.",
        location: "Austin, TX",
        connectionDegree: "3rd",
        mutualConnections: 1,
        profilePicture: "/api/placeholder/40/40"
      }
    ];
    setTargetProfiles(mockProfiles);
  }, []);

  const handleScheduleConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProfile) {
      setError("Please select a target profile");
      return;
    }

    const template = templates.find(t => t.id === selectedTemplate);
    let message = customMessage;
    
    // Use template content if selected and no custom message
    if (template && !customMessage) {
      message = template.content;
    }

    const scheduledDateTime = scheduledDate && scheduledTime 
      ? new Date(`${scheduledDate}T${scheduledTime}`)
      : undefined;

    const request: ScheduleConnectionRequest = {
      targetProfileId: selectedProfile,
      message: message || undefined,
      templateId: selectedTemplate || undefined,
      priority,
      scheduledAt: scheduledDateTime
    };

    try {
      setLoading(true);
      setError(null);
      await onScheduleConnection(request);
      
      // Reset form
      setSelectedProfile("");
      setSelectedTemplate("");
      setCustomMessage("");
      setPriority("medium");
      setScheduledDate("");
      setScheduledTime("");
      
      // Refresh connections list (in real app, this might come from WebSocket)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule connection");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConnection = async (requestId: string) => {
    try {
      await onCancelConnection(requestId);
      setConnections(prev => prev.filter(conn => conn.id !== requestId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel connection");
    }
  };

  const getStatusBadge = (status: ConnectionRequest['status']) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, label: "Pending", className: "" },
      scheduled: { variant: "default" as const, label: "Scheduled", className: "" },
      sent: { variant: "default" as const, label: "Sent", className: "" },
      accepted: { variant: "default" as const, label: "Accepted", className: "bg-green-500 hover:bg-green-600" },
      declined: { variant: "destructive" as const, label: "Declined", className: "" },
      cancelled: { variant: "outline" as const, label: "Cancelled", className: "" }
    };

    const config = statusConfig[status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getStatusIcon = (status: ConnectionRequest['status']) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'declined':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'sent':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const filteredConnections = connections.filter(conn => {
    const matchesSearch = searchQuery === "" || 
      conn.targetProfileId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || conn.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const progressPercentage = (stats.dailyUsed / stats.dailyLimit) * 100;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Usage</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.dailyUsed}</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>of {stats.dailyLimit} limit</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting responses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accepted</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
            <p className="text-xs text-muted-foreground">New connections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.acceptanceRate)}%</div>
            <p className="text-xs text-muted-foreground">Acceptance rate</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="schedule">Schedule Connection</TabsTrigger>
          <TabsTrigger value="manage">Manage Requests</TabsTrigger>
          <TabsTrigger value="targets">Find Targets</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedule New Connection Request</CardTitle>
              <CardDescription>
                Send personalized connection requests to your target audience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScheduleConnection} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile">Target Profile</Label>
                    <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a profile" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetProfiles.map(profile => (
                          <SelectItem key={profile.id} value={profile.id}>
                            <div className="flex items-center space-x-2">
                              <img 
                                src={profile.profilePicture || "/api/placeholder/24/24"} 
                                alt={profile.name}
                                className="w-6 h-6 rounded-full"
                              />
                              <div>
                                <div className="font-medium">{profile.name}</div>
                                <div className="text-xs text-muted-foreground">{profile.company}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template">Message Template</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose template (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No template</SelectItem>
                        {templates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Personal Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Write a personalized connection message..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    {customMessage.length}/300 characters • Leave empty to use template
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high') => setPriority(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Schedule Date (Optional)</Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time">Schedule Time (Optional)</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading || !selectedProfile} className="w-full">
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Schedule Connection Request
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connection Requests</CardTitle>
              <CardDescription>Manage your scheduled and sent connection requests</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search connections..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Connections List */}
              <div className="space-y-3">
                {filteredConnections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No connection requests found</p>
                  </div>
                ) : (
                  filteredConnections.map(connection => (
                    <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(connection.status)}
                        <div>
                          <div className="font-medium">Profile ID: {connection.targetProfileId}</div>
                          <div className="text-sm text-muted-foreground">
                            {connection.scheduledAt && (
                              <span>Scheduled: {new Date(connection.scheduledAt).toLocaleString()}</span>
                            )}
                            {connection.sentAt && (
                              <span>Sent: {new Date(connection.sentAt).toLocaleString()}</span>
                            )}
                          </div>
                          {connection.message && (
                            <div className="text-sm text-muted-foreground mt-1">
                              "{connection.message.substring(0, 100)}..."
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(connection.status)}
                        {connection.status === 'pending' || connection.status === 'scheduled' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelConnection(connection.id)}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="targets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Target Profiles</CardTitle>
              <CardDescription>Find and analyze potential connections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {targetProfiles.map(profile => (
                  <div key={profile.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <img 
                        src={profile.profilePicture || "/api/placeholder/48/48"} 
                        alt={profile.name}
                        className="w-12 h-12 rounded-full"
                      />
                      <div>
                        <div className="font-medium">{profile.name}</div>
                        <div className="text-sm text-muted-foreground">{profile.headline}</div>
                        <div className="text-xs text-muted-foreground flex items-center space-x-2 mt-1">
                          <span>{profile.company}</span>
                          <span>•</span>
                          <span>{profile.location}</span>
                          <span>•</span>
                          <span>{profile.connectionDegree} connection</span>
                          <span>•</span>
                          <span>{profile.mutualConnections} mutual</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{profile.connectionDegree}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProfile(profile.id);
                          setActiveTab("schedule");
                        }}
                      >
                        <Target className="h-4 w-4 mr-1" />
                        Connect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}