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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Heart,
  MessageSquare,
  Eye,
  UserPlus,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Filter,
  Search,
  Target,
  ThumbsUp,
  Zap
} from "lucide-react";

import {
  EngagementAutomationProps,
  EngagementTask,
  ScheduleEngagementRequest,
  MessageTemplate
} from "@/types/automation";

interface LinkedInPost {
  id: string;
  authorName: string;
  authorHeadline: string;
  authorProfileUrl: string;
  content: string;
  postedAt: Date;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  hasLiked: boolean;
  hasCommented: boolean;
  postUrl: string;
}

interface LinkedInProfile {
  id: string;
  name: string;
  headline: string;
  profileUrl: string;
  company?: string;
  location?: string;
  isFollowing: boolean;
  mutualConnections: number;
  recentActivity: string;
}

export function EngagementAutomation({
  userId,
  templates,
  stats,
  onScheduleEngagement
}: EngagementAutomationProps) {
  const [activeTab, setActiveTab] = useState("schedule");
  const [engagementTasks, setEngagementTasks] = useState<EngagementTask[]>([]);
  const [recentPosts, setRecentPosts] = useState<LinkedInPost[]>([]);
  const [suggestedProfiles, setSuggestedProfiles] = useState<LinkedInProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for scheduling engagements
  const [engagementType, setEngagementType] = useState<"like" | "comment" | "view_profile" | "follow">("like");
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [customContent, setCustomContent] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Fetch engagement tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch('/api/v1/automation/engagement/tasks', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setEngagementTasks(data.tasks || []);
        }
      } catch (err) {
        console.error('Failed to fetch engagement tasks:', err);
      }
    };

    fetchTasks();
  }, []);

  // Fetch recent posts (mock data)
  useEffect(() => {
    const mockPosts: LinkedInPost[] = [
      {
        id: "post-1",
        authorName: "John Smith",
        authorHeadline: "Senior Developer at Tech Corp",
        authorProfileUrl: "https://linkedin.com/in/john-smith",
        content: "Just shipped a new feature that improves user experience by 40%! Excited about the impact on our customers. #ProductDevelopment #UserExperience",
        postedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        likesCount: 24,
        commentsCount: 8,
        sharesCount: 3,
        hasLiked: false,
        hasCommented: false,
        postUrl: "https://linkedin.com/posts/john-smith-123456"
      },
      {
        id: "post-2",
        authorName: "Maria Garcia",
        authorHeadline: "Marketing Director at Growth Co",
        authorProfileUrl: "https://linkedin.com/in/maria-garcia",
        content: "The future of digital marketing is here! AI-powered personalization is changing how we connect with customers. What are your thoughts on the balance between automation and human touch?",
        postedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        likesCount: 56,
        commentsCount: 15,
        sharesCount: 7,
        hasLiked: false,
        hasCommented: false,
        postUrl: "https://linkedin.com/posts/maria-garcia-789012"
      },
      {
        id: "post-3",
        authorName: "David Kim",
        authorHeadline: "Startup Founder & CEO",
        authorProfileUrl: "https://linkedin.com/in/david-kim",
        content: "Bootstrapped to $1M ARR in 18 months! Here are the 5 key lessons I learned along the way: 1) Focus on customer problems, not solutions 2) Build a strong team early 3) Cash flow is king...",
        postedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        likesCount: 128,
        commentsCount: 32,
        sharesCount: 18,
        hasLiked: false,
        hasCommented: false,
        postUrl: "https://linkedin.com/posts/david-kim-345678"
      }
    ];
    setRecentPosts(mockPosts);
  }, []);

  // Fetch suggested profiles (mock data)
  useEffect(() => {
    const mockProfiles: LinkedInProfile[] = [
      {
        id: "profile-1",
        name: "Sarah Johnson",
        headline: "VP of Engineering at InnovateAI",
        profileUrl: "https://linkedin.com/in/sarah-johnson",
        company: "InnovateAI",
        location: "San Francisco, CA",
        isFollowing: false,
        mutualConnections: 12,
        recentActivity: "Posted about AI trends"
      },
      {
        id: "profile-2",
        name: "Michael Chen",
        headline: "Product Manager at Microsoft",
        profileUrl: "https://linkedin.com/in/michael-chen",
        company: "Microsoft",
        location: "Seattle, WA",
        isFollowing: false,
        mutualConnections: 8,
        recentActivity: "Shared article on product strategy"
      },
      {
        id: "profile-3",
        name: "Emily Davis",
        headline: "Growth Marketing Lead",
        profileUrl: "https://linkedin.com/in/emily-davis",
        company: "Scale Ventures",
        location: "Austin, TX",
        isFollowing: true,
        mutualConnections: 5,
        recentActivity: "Updated profile headline"
      }
    ];
    setSuggestedProfiles(mockProfiles);
  }, []);

  const handleScheduleEngagement = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const targets = bulkMode ? selectedTargets : [selectedTarget];
    if (targets.length === 0) {
      setError("Please select at least one target");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      for (const targetId of targets) {
        const template = templates.find(t => t.id === selectedTemplate);
        let content = customContent;
        
        // Use template content if selected and no custom content
        if (template && !customContent && engagementType === 'comment') {
          content = template.content;
        }

        const request: ScheduleEngagementRequest = {
          type: engagementType,
          targetId,
          content: content || undefined,
          templateId: selectedTemplate || undefined,
          priority,
          metadata: {
            bulkOperation: bulkMode,
            scheduledBy: userId
          }
        };

        await onScheduleEngagement(request);
      }
      
      // Reset form
      setSelectedTarget("");
      setSelectedTargets([]);
      setSelectedTemplate("");
      setCustomContent("");
      setPriority("medium");
      setBulkMode(false);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule engagement");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkTargetToggle = (targetId: string) => {
    setSelectedTargets(prev => 
      prev.includes(targetId) 
        ? prev.filter(id => id !== targetId)
        : [...prev, targetId]
    );
  };

  const getStatusBadge = (status: EngagementTask['status']) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, label: "Pending", className: "" },
      scheduled: { variant: "default" as const, label: "Scheduled", className: "" },
      completed: { variant: "default" as const, label: "Completed", className: "bg-green-500 hover:bg-green-600" },
      failed: { variant: "destructive" as const, label: "Failed", className: "" },
      cancelled: { variant: "outline" as const, label: "Cancelled", className: "" }
    };

    const config = statusConfig[status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getTypeIcon = (type: EngagementTask['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="h-4 w-4" />;
      case 'comment':
        return <MessageSquare className="h-4 w-4" />;
      case 'view_profile':
        return <Eye className="h-4 w-4" />;
      case 'follow':
        return <UserPlus className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const filteredTasks = engagementTasks.filter(task => {
    const matchesSearch = searchQuery === "" || 
      task.targetId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || task.status === filterStatus;
    const matchesType = filterType === "all" || task.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getEngagementTypeColor = (type: string) => {
    switch (type) {
      case 'like': return 'text-red-500';
      case 'comment': return 'text-blue-500';
      case 'view_profile': return 'text-green-500';
      case 'follow': return 'text-purple-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Likes Today</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byType.likes.dailyUsed}</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>of {stats.byType.likes.dailyLimit} limit</span>
              <span>{Math.round((stats.byType.likes.dailyUsed / stats.byType.likes.dailyLimit) * 100)}%</span>
            </div>
            <Progress 
              value={(stats.byType.likes.dailyUsed / stats.byType.likes.dailyLimit) * 100} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comments Today</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byType.comments.dailyUsed}</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>of {stats.byType.comments.dailyLimit} limit</span>
              <span>{Math.round((stats.byType.comments.dailyUsed / stats.byType.comments.dailyLimit) * 100)}%</span>
            </div>
            <Progress 
              value={(stats.byType.comments.dailyUsed / stats.byType.comments.dailyLimit) * 100} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profile Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byType.profileViews.dailyUsed}</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>of {stats.byType.profileViews.dailyLimit} limit</span>
              <span>{Math.round((stats.byType.profileViews.dailyUsed / stats.byType.profileViews.dailyLimit) * 100)}%</span>
            </div>
            <Progress 
              value={(stats.byType.profileViews.dailyUsed / stats.byType.profileViews.dailyLimit) * 100} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.successRate)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.completed} of {stats.total} completed
            </p>
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
          <TabsTrigger value="schedule">Schedule Engagement</TabsTrigger>
          <TabsTrigger value="posts">Recent Posts</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="manage">Manage Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Engagement Actions</CardTitle>
              <CardDescription>
                Automate likes, comments, profile views, and follows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScheduleEngagement} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Engagement Type</Label>
                    <Select value={engagementType} onValueChange={(value: "like" | "comment" | "view_profile" | "follow") => setEngagementType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="like">
                          <div className="flex items-center space-x-2">
                            <Heart className="h-4 w-4" />
                            <span>Like Post</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="comment">
                          <div className="flex items-center space-x-2">
                            <MessageSquare className="h-4 w-4" />
                            <span>Comment on Post</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="view_profile">
                          <div className="flex items-center space-x-2">
                            <Eye className="h-4 w-4" />
                            <span>View Profile</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="follow">
                          <div className="flex items-center space-x-2">
                            <UserPlus className="h-4 w-4" />
                            <span>Follow User</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={priority} onValueChange={(value: "low" | "medium" | "high") => setPriority(value)}>
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
                </div>

                {!bulkMode && (
                  <div className="space-y-2">
                    <Label htmlFor="target">Target (Post/Profile URL or ID)</Label>
                    <Input
                      id="target"
                      placeholder="Enter LinkedIn post or profile URL"
                      value={selectedTarget}
                      onChange={(e) => setSelectedTarget(e.target.value)}
                    />
                  </div>
                )}

                {engagementType === 'comment' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="template">Comment Template</Label>
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

                    <div className="space-y-2">
                      <Label htmlFor="content">Comment Content</Label>
                      <Textarea
                        id="content"
                        placeholder="Write your comment..."
                        value={customContent}
                        onChange={(e) => setCustomContent(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        {customContent.length}/500 characters
                      </p>
                    </div>
                  </>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bulk"
                    checked={bulkMode}
                    onCheckedChange={(checked) => setBulkMode(checked === true)}
                  />
                  <Label htmlFor="bulk">Bulk operation mode</Label>
                </div>

                {bulkMode && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      In bulk mode, select targets from the Posts or Profiles tabs, then return here to schedule.
                      Selected: {selectedTargets.length} targets
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  disabled={loading || (!bulkMode && !selectedTarget) || (bulkMode && selectedTargets.length === 0)}
                  className="w-full"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Schedule {bulkMode ? `${selectedTargets.length} ` : ""}Engagement{bulkMode && selectedTargets.length !== 1 ? 's' : ''}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent LinkedIn Posts</CardTitle>
              <CardDescription>Engage with relevant posts from your network</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentPosts.map(post => (
                  <div key={post.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <img 
                          src="/api/placeholder/40/40" 
                          alt={post.authorName}
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <div className="font-medium">{post.authorName}</div>
                          <div className="text-sm text-muted-foreground">{post.authorHeadline}</div>
                          <div className="text-xs text-muted-foreground">
                            {post.postedAt.toLocaleDateString()} • {post.postedAt.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      {bulkMode && (
                        <Checkbox
                          checked={selectedTargets.includes(post.id)}
                          onCheckedChange={() => handleBulkTargetToggle(post.id)}
                        />
                      )}
                    </div>

                    <div className="text-sm">{post.content}</div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span className="flex items-center space-x-1">
                          <ThumbsUp className="h-3 w-3" />
                          <span>{post.likesCount}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>{post.commentsCount}</span>
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {post.hasLiked && <Badge variant="outline" className="text-red-500">Liked</Badge>}
                        {post.hasCommented && <Badge variant="outline" className="text-blue-500">Commented</Badge>}
                        {!bulkMode && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTarget(post.id);
                              setActiveTab("schedule");
                            }}
                          >
                            <Target className="h-4 w-4 mr-1" />
                            Engage
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suggested Profiles</CardTitle>
              <CardDescription>Connect and engage with relevant professionals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suggestedProfiles.map(profile => (
                  <div key={profile.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <img 
                        src="/api/placeholder/48/48" 
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
                          <span>{profile.mutualConnections} mutual connections</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Recent: {profile.recentActivity}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {profile.isFollowing && <Badge variant="outline" className="text-purple-500">Following</Badge>}
                      {bulkMode && (
                        <Checkbox
                          checked={selectedTargets.includes(profile.id)}
                          onCheckedChange={() => handleBulkTargetToggle(profile.id)}
                        />
                      )}
                      {!bulkMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTarget(profile.id);
                            setEngagementType("view_profile");
                            setActiveTab("schedule");
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Tasks</CardTitle>
              <CardDescription>Monitor your scheduled and completed engagement activities</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="like">Likes</SelectItem>
                    <SelectItem value="comment">Comments</SelectItem>
                    <SelectItem value="view_profile">Views</SelectItem>
                    <SelectItem value="follow">Follows</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tasks List */}
              <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No engagement tasks found</p>
                  </div>
                ) : (
                  filteredTasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className={getEngagementTypeColor(task.type)}>
                          {getTypeIcon(task.type)}
                        </div>
                        <div>
                          <div className="font-medium flex items-center space-x-2">
                            <span className="capitalize">{task.type.replace('_', ' ')}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">Target: {task.targetId}</span>
                          </div>
                          {task.content && (
                            <div className="text-sm text-muted-foreground mt-1">
                              "{task.content.substring(0, 100)}..."
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {task.scheduledAt && (
                              <span>Scheduled: {new Date(task.scheduledAt).toLocaleString()}</span>
                            )}
                            {task.completedAt && (
                              <span>Completed: {new Date(task.completedAt).toLocaleString()}</span>
                            )}
                            {task.score && (
                              <span className="ml-2">Score: {task.score}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(task.status)}
                        <Badge variant="outline" className="capitalize">
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}