'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Star,
  Zap,
  Target,
  TrendingUp,
  Award,
  Flame,
  User,
  Briefcase,
  GraduationCap,
  Camera,
  Users,
  FileText,
  MessageSquare,
  Share2,
  Settings,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Volume2,
  VolumeX,
  Smartphone,
  Vibrate,
  VibrateOff,
  Maximize2,
  Minimize2,
  ArrowRight,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

// Types for mobile optimization
interface TouchGesture {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  type: 'tap' | 'swipe' | 'long_press' | 'pinch';
  velocity?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

interface HapticPattern {
  type: 'light' | 'medium' | 'heavy' | 'selection' | 'impact' | 'notification';
  duration?: number;
  intensity?: number;
}

interface MobileProfileSection {
  id: string;
  label: string;
  icon: React.ElementType;
  score: number;
  maxScore: number;
  weight: number;
  color: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeEstimate: string;
  suggestion: string;
  xp: number;
  maxXp: number;
  category: 'basic' | 'content' | 'network' | 'skills';
}

interface MobileProfileVisualizerProps {
  completenessData: any;
  className?: string;
  enableHapticFeedback?: boolean;
  enableAudioFeedback?: boolean;
  onSectionInteraction?: (sectionId: string, interactionType: string) => void;
  theme?: 'light' | 'dark';
  compactMode?: boolean;
}

const MobileProfileVisualizer: React.FC<MobileProfileVisualizerProps> = ({
  completenessData,
  className,
  enableHapticFeedback = true,
  enableAudioFeedback = false,
  onSectionInteraction,
  theme = 'light',
  compactMode = false
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'overview' | 'detailed' | 'progress'>('overview');
  const [touchGesture, setTouchGesture] = useState<TouchGesture | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [enableHaptics, setEnableHaptics] = useState(enableHapticFeedback);
  const [enableAudio, setEnableAudio] = useState(enableAudioFeedback);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState<string | null>(null);
  const [celebrationActive, setCelebrationActive] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<TouchGesture | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Mobile-optimized profile sections
  const mobileSections: MobileProfileSection[] = [
    {
      id: 'basicInfo',
      label: 'Basic Info',
      icon: User,
      score: completenessData?.breakdown?.basicInfo || 0,
      maxScore: 12,
      weight: 12,
      color: 'from-blue-400 to-blue-600',
      difficulty: 'easy',
      timeEstimate: '5 min',
      suggestion: 'Complete your name, location, and industry',
      xp: 50,
      maxXp: 100,
      category: 'basic'
    },
    {
      id: 'headline',
      label: 'Headline',
      icon: FileText,
      score: completenessData?.breakdown?.headline || 0,
      maxScore: 12,
      weight: 12,
      color: 'from-green-400 to-green-600',
      difficulty: 'easy',
      timeEstimate: '10 min',
      suggestion: 'Craft a compelling professional headline',
      xp: 75,
      maxXp: 100,
      category: 'basic'
    },
    {
      id: 'summary',
      label: 'Summary',
      icon: MessageSquare,
      score: completenessData?.breakdown?.summary || 0,
      maxScore: 18,
      weight: 18,
      color: 'from-purple-400 to-purple-600',
      difficulty: 'medium',
      timeEstimate: '30 min',
      suggestion: 'Write a compelling about section',
      xp: 120,
      maxXp: 200,
      category: 'content'
    },
    {
      id: 'experience',
      label: 'Experience',
      icon: Briefcase,
      score: completenessData?.breakdown?.experience || 0,
      maxScore: 18,
      weight: 18,
      color: 'from-orange-400 to-orange-600',
      difficulty: 'medium',
      timeEstimate: '45 min',
      suggestion: 'Add detailed work experience',
      xp: 150,
      maxXp: 200,
      category: 'content'
    },
    {
      id: 'skills',
      label: 'Skills',
      icon: Target,
      score: completenessData?.breakdown?.skills || 0,
      maxScore: 8,
      weight: 8,
      color: 'from-cyan-400 to-cyan-600',
      difficulty: 'easy',
      timeEstimate: '20 min',
      suggestion: 'Add relevant skills and get endorsements',
      xp: 80,
      maxXp: 100,
      category: 'skills'
    },
    {
      id: 'connections',
      label: 'Network',
      icon: Users,
      score: completenessData?.breakdown?.connections || 0,
      maxScore: 4,
      weight: 4,
      color: 'from-yellow-400 to-yellow-600',
      difficulty: 'medium',
      timeEstimate: 'ongoing',
      suggestion: 'Build your professional network',
      xp: 30,
      maxXp: 50,
      category: 'network'
    }
  ];

  // Haptic feedback function
  const triggerHapticFeedback = useCallback((pattern: HapticPattern) => {
    if (!enableHaptics || !navigator.vibrate) return;
    
    let vibrationPattern: number[];
    
    switch (pattern.type) {
      case 'light':
        vibrationPattern = [10];
        break;
      case 'medium':
        vibrationPattern = [20];
        break;
      case 'heavy':
        vibrationPattern = [50];
        break;
      case 'selection':
        vibrationPattern = [10, 50, 10];
        break;
      case 'impact':
        vibrationPattern = [30, 100, 30];
        break;
      case 'notification':
        vibrationPattern = [100, 50, 100, 50, 100];
        break;
      default:
        vibrationPattern = [20];
    }
    
    navigator.vibrate(vibrationPattern);
  }, [enableHaptics]);

  // Audio feedback function
  const playAudioFeedback = useCallback((frequency: number, duration: number = 100) => {
    if (!enableAudio) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + duration / 1000);
      
      oscillator.start(audioContextRef.current.currentTime);
      oscillator.stop(audioContextRef.current.currentTime + duration / 1000);
    } catch (error) {
      console.warn('Audio feedback not available:', error);
    }
  }, [enableAudio]);

  // Touch gesture handlers
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    const newGesture: TouchGesture = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      startTime: Date.now(),
      type: 'tap'
    };
    
    setTouchGesture(newGesture);
    gestureRef.current = newGesture;
    
    // Light haptic feedback for touch start
    triggerHapticFeedback({ type: 'light' });
  }, [triggerHapticFeedback]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!gestureRef.current) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - gestureRef.current.startX;
    const deltaY = touch.clientY - gestureRef.current.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance > 10) {
      gestureRef.current.type = 'swipe';
      gestureRef.current.currentX = touch.clientX;
      gestureRef.current.currentY = touch.clientY;
      
      // Determine swipe direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        gestureRef.current.direction = deltaX > 0 ? 'right' : 'left';
      } else {
        gestureRef.current.direction = deltaY > 0 ? 'down' : 'up';
      }
    }
  }, []);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!gestureRef.current) return;
    
    const gesture = gestureRef.current;
    const duration = Date.now() - gesture.startTime;
    
    // Long press detection
    if (duration > 500 && gesture.type === 'tap') {
      gesture.type = 'long_press';
      triggerHapticFeedback({ type: 'heavy' });
      playAudioFeedback(600, 150);
    }
    
    // Handle different gesture types
    switch (gesture.type) {
      case 'tap':
        triggerHapticFeedback({ type: 'selection' });
        playAudioFeedback(800, 50);
        break;
      case 'swipe':
        handleSwipeGesture(gesture);
        break;
      case 'long_press':
        handleLongPress(gesture);
        break;
    }
    
    setTouchGesture(null);
    gestureRef.current = null;
  }, [triggerHapticFeedback, playAudioFeedback]);

  const handleSwipeGesture = useCallback((gesture: TouchGesture) => {
    const deltaX = gesture.currentX - gesture.startX;
    const deltaY = gesture.currentY - gesture.startY;
    const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / (Date.now() - gesture.startTime);
    
    if (velocity < 0.5) return; // Too slow to be a swipe
    
    triggerHapticFeedback({ type: 'medium' });
    playAudioFeedback(400, 100);
    
    // Handle horizontal swipes for section navigation
    if (gesture.direction === 'left' && swipeIndex < mobileSections.length - 1) {
      setSwipeIndex(prev => prev + 1);
    } else if (gesture.direction === 'right' && swipeIndex > 0) {
      setSwipeIndex(prev => prev - 1);
    }
    
    // Handle vertical swipes for view changes
    if (gesture.direction === 'up' && currentView === 'overview') {
      setCurrentView('detailed');
    } else if (gesture.direction === 'down' && currentView === 'detailed') {
      setCurrentView('overview');
    }
  }, [swipeIndex, currentView, mobileSections.length, triggerHapticFeedback, playAudioFeedback]);

  const handleLongPress = useCallback((gesture: TouchGesture) => {
    // Long press to show section details or toggle fullscreen
    if (activeSection) {
      setCurrentView('progress');
    } else {
      setIsFullscreen(!isFullscreen);
    }
  }, [activeSection, isFullscreen]);

  const handleSectionTap = useCallback((sectionId: string) => {
    setActiveSection(activeSection === sectionId ? null : sectionId);
    setPulseAnimation(sectionId);
    
    triggerHapticFeedback({ type: 'impact' });
    playAudioFeedback(1000, 100);
    
    const section = mobileSections.find(s => s.id === sectionId);
    if (section && section.score >= section.maxScore) {
      setCelebrationActive(true);
      triggerHapticFeedback({ type: 'notification' });
      playAudioFeedback(1200, 300);
      setTimeout(() => setCelebrationActive(false), 2000);
    }
    
    onSectionInteraction?.(sectionId, 'tap');
    
    setTimeout(() => setPulseAnimation(null), 300);
  }, [activeSection, mobileSections, triggerHapticFeedback, playAudioFeedback, onSectionInteraction]);

  const overallScore = completenessData?.score || 0;
  const sectionsInView = compactMode ? 3 : 4;
  const visibleSections = mobileSections.slice(swipeIndex, swipeIndex + sectionsInView);

  return (
    <div className={cn('w-full', className)}>
      <AnimatePresence>
        {celebrationActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 pointer-events-none"
          >
            <div className="text-6xl animate-bounce">🎉</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Header */}
      <Card className={cn(
        'mb-4 transition-all duration-300',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
        isFullscreen && 'fixed inset-x-4 top-4 z-40'
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                'bg-gradient-to-br transition-all duration-500',
                overallScore >= 90 ? 'from-green-400 to-green-600' :
                overallScore >= 75 ? 'from-blue-400 to-blue-600' :
                overallScore >= 50 ? 'from-yellow-400 to-yellow-600' : 'from-red-400 to-red-600'
              )}>
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className={cn(
                  'text-lg',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Profile Progress
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className={cn(
                    'text-sm font-bold',
                    overallScore >= 90 ? 'bg-green-100 text-green-800' :
                    overallScore >= 75 ? 'bg-blue-100 text-blue-800' :
                    overallScore >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                  )}>
                    {overallScore}%
                  </Badge>
                  <span className={cn(
                    'text-sm',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  )}>
                    Complete
                  </span>
                </div>
              </div>
            </div>
            
            {/* Mobile Controls */}
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEnableHaptics(!enableHaptics)}
                className="p-2"
              >
                {enableHaptics ? <Vibrate className="h-4 w-4" /> : <VibrateOff className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEnableAudio(!enableAudio)}
                className="p-2"
              >
                {enableAudio ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-3">
            <Progress value={overallScore} className="h-3" />
          </div>
        </CardHeader>
      </Card>

      {/* Mobile Section Grid */}
      <Card className={cn(
        'transition-all duration-300',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
        isFullscreen && 'fixed inset-x-4 top-24 bottom-4 z-40 overflow-hidden'
      )}>
        <CardContent className={cn(
          'p-4',
          isFullscreen && 'h-full overflow-y-auto'
        )}>
          <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="touch-manipulation"
          >
            {currentView === 'overview' && (
              <div className="grid grid-cols-2 gap-4">
                {visibleSections.map((section, index) => {
                  const percentage = section.maxScore > 0 ? (section.score / section.maxScore) * 100 : 0;
                  const isActive = activeSection === section.id;
                  const isPulsing = pulseAnimation === section.id;
                  
                  return (
                    <motion.div
                      key={section.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        scale: isPulsing ? 1.05 : 1
                      }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className={cn(
                        'relative p-4 rounded-xl cursor-pointer transition-all duration-300',
                        'transform-gpu active:scale-95',
                        `bg-gradient-to-br ${section.color}`,
                        'text-white shadow-lg',
                        isActive && 'ring-4 ring-white/30 shadow-2xl',
                        isPulsing && 'animate-pulse'
                      )}
                      onClick={() => handleSectionTap(section.id)}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* Section Icon */}
                      <div className="flex items-center justify-between mb-3">
                        <section.icon className="h-8 w-8 text-white" />
                        {percentage >= 100 && (
                          <CheckCircle className="h-6 w-6 text-white animate-pulse" />
                        )}
                      </div>
                      
                      {/* Section Info */}
                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg leading-tight">
                          {section.label}
                        </h3>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="opacity-90">
                            {Math.round(percentage)}%
                          </span>
                          <span className="opacity-75">
                            +{section.xp} XP
                          </span>
                        </div>
                        
                        {/* Mini Progress Bar */}
                        <div className="w-full bg-white/20 rounded-full h-2">
                          <motion.div
                            className="bg-white rounded-full h-2 transition-all duration-1000"
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ delay: index * 0.2 + 0.5 }}
                          />
                        </div>
                        
                        {/* Difficulty Indicator */}
                        <div className="flex items-center justify-between">
                          <Badge 
                            variant="secondary"
                            className={cn(
                              'text-xs px-2 py-1',
                              section.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                              section.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            )}
                          >
                            {section.difficulty}
                          </Badge>
                          
                          <span className="text-xs opacity-75">
                            {section.timeEstimate}
                          </span>
                        </div>
                      </div>
                      
                      {/* Completion Overlay */}
                      {percentage >= 100 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 bg-green-500/20 rounded-xl flex items-center justify-center"
                        >
                          <CheckCircle className="h-12 w-12 text-white" />
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
            
            {/* Navigation Indicators */}
            {mobileSections.length > sectionsInView && (
              <div className="flex items-center justify-center mt-6 space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSwipeIndex(Math.max(0, swipeIndex - 1))}
                  disabled={swipeIndex === 0}
                  className="p-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {Array.from({ length: Math.ceil(mobileSections.length / sectionsInView) }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'w-2 h-2 rounded-full transition-colors duration-300',
                      Math.floor(swipeIndex / sectionsInView) === index
                        ? 'bg-indigo-500'
                        : 'bg-gray-300'
                    )}
                  />
                ))}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSwipeIndex(Math.min(mobileSections.length - sectionsInView, swipeIndex + 1))}
                  disabled={swipeIndex >= mobileSections.length - sectionsInView}
                  className="p-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {/* Swipe Hint */}
            <div className={cn(
              'text-center mt-4 text-sm opacity-60',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            )}>
              Swipe to navigate • Long press for details
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Section View */}
      <AnimatePresence>
        {activeSection && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="mt-4"
          >
            <Card className={cn(
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <CardContent className="p-4">
                {(() => {
                  const section = mobileSections.find(s => s.id === activeSection);
                  if (!section) return null;
                  
                  const percentage = section.maxScore > 0 ? (section.score / section.maxScore) * 100 : 0;
                  
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center',
                            `bg-gradient-to-br ${section.color}`
                          )}>
                            <section.icon className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h3 className={cn(
                              'font-semibold text-lg',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {section.label}
                            </h3>
                            <p className={cn(
                              'text-sm',
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                            )}>
                              {section.score}/{section.maxScore} points
                            </p>
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveSection(null)}
                          className="p-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <Progress value={percentage} className="h-3" />
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className={cn(
                            'font-semibold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {section.difficulty}
                          </div>
                          <div className={cn(
                            'text-xs',
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          )}>
                            Difficulty
                          </div>
                        </div>
                        
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className={cn(
                            'font-semibold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {section.timeEstimate}
                          </div>
                          <div className={cn(
                            'text-xs',
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          )}>
                            Time Est.
                          </div>
                        </div>
                      </div>
                      
                      <div className={cn(
                        'p-4 rounded-lg',
                        theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
                      )}>
                        <div className="flex items-start space-x-2">
                          <AlertCircle className={cn(
                            'h-5 w-5 mt-0.5 flex-shrink-0',
                            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          )} />
                          <div>
                            <div className={cn(
                              'font-medium mb-1',
                              theme === 'dark' ? 'text-blue-400' : 'text-blue-900'
                            )}>
                              Suggestion
                            </div>
                            <p className={cn(
                              'text-sm',
                              theme === 'dark' ? 'text-blue-300' : 'text-blue-800'
                            )}>
                              {section.suggestion}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <Button className="w-full" size="lg">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Start Improving
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileProfileVisualizer;'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Star,
  Zap,
  Target,
  TrendingUp,
  Award,
  Flame,
  User,
  Briefcase,
  GraduationCap,
  Camera,
  Users,
  FileText,
  MessageSquare,
  Globe,
  ExternalLink,
  Lightbulb,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Share2,
  Heart,
  Eye,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Smartphone,
  Tablet
} from 'lucide-react';

interface TouchGesture {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  type: 'tap' | 'swipe' | 'pinch' | 'none';
}

interface ProfileSection {
  id: string;
  label: string;
  icon: React.ElementType;
  score: number;
  maxScore: number;
  weight: number;
  color: string;
  glowColor: string;
  mobileOptimized: boolean;
  touchFeedback: 'haptic' | 'audio' | 'visual';
  xp: number;
}

interface MobileProfileVisualizerProps {
  completenessData: any;
  className?: string;
  enableHapticFeedback?: boolean;
  enableAudioFeedback?: boolean;
  onSectionInteraction?: (sectionId: string, interactionType: string) => void;
}

const MobileProfileVisualizer: React.FC<MobileProfileVisualizerProps> = ({
  completenessData,
  className,
  enableHapticFeedback = true,
  enableAudioFeedback = false,
  onSectionInteraction
}) => {
  const [viewMode, setViewMode] = useState<'card' | 'circular' | 'linear'>('card');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [touchGesture, setTouchGesture] = useState<TouchGesture | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [deviceOrientation, setDeviceOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [hapticEnabled, setHapticEnabled] = useState(enableHapticFeedback);
  const [audioEnabled, setAudioEnabled] = useState(enableAudioFeedback);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Enhanced profile sections for mobile
  const profileSections: ProfileSection[] = [
    {
      id: 'basicInfo',
      label: 'Basic Info',
      icon: User,
      score: completenessData?.breakdown?.basicInfo || 0,
      maxScore: 12,
      weight: 12,
      color: 'from-blue-400 to-blue-600',
      glowColor: 'shadow-blue-500/50',
      mobileOptimized: true,
      touchFeedback: 'haptic',
      xp: 50
    },
    {
      id: 'headline',
      label: 'Headline',
      icon: FileText,
      score: completenessData?.breakdown?.headline || 0,
      maxScore: 12,
      weight: 12,
      color: 'from-green-400 to-green-600',
      glowColor: 'shadow-green-500/50',
      mobileOptimized: true,
      touchFeedback: 'visual',
      xp: 75
    },
    {
      id: 'summary',
      label: 'Summary',
      icon: MessageSquare,
      score: completenessData?.breakdown?.summary || 0,
      maxScore: 18,
      weight: 18,
      color: 'from-purple-400 to-purple-600',
      glowColor: 'shadow-purple-500/50',
      mobileOptimized: true,
      touchFeedback: 'audio',
      xp: 120
    },
    {
      id: 'experience',
      label: 'Experience',
      icon: Briefcase,
      score: completenessData?.breakdown?.experience || 0,
      maxScore: 18,
      weight: 18,
      color: 'from-orange-400 to-orange-600',
      glowColor: 'shadow-orange-500/50',
      mobileOptimized: true,
      touchFeedback: 'haptic',
      xp: 150
    },
    {
      id: 'education',
      label: 'Education',
      icon: GraduationCap,
      score: completenessData?.breakdown?.education || 0,
      maxScore: 8,
      weight: 8,
      color: 'from-indigo-400 to-indigo-600',
      glowColor: 'shadow-indigo-500/50',
      mobileOptimized: true,
      touchFeedback: 'visual',
      xp: 60
    },
    {
      id: 'skills',
      label: 'Skills',
      icon: Target,
      score: completenessData?.breakdown?.skills || 0,
      maxScore: 8,
      weight: 8,
      color: 'from-cyan-400 to-cyan-600',
      glowColor: 'shadow-cyan-500/50',
      mobileOptimized: true,
      touchFeedback: 'haptic',
      xp: 80
    }
  ];

  // Initialize audio context for sound feedback
  useEffect(() => {
    if (audioEnabled && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, [audioEnabled]);

  // Device orientation detection
  useEffect(() => {
    const handleOrientationChange = () => {
      setDeviceOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    handleOrientationChange();
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // Haptic feedback function
  const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!hapticEnabled) return;
    
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30, 10, 30]
      };
      navigator.vibrate(patterns[type]);
    }
  }, [hapticEnabled]);

  // Audio feedback function
  const triggerAudioFeedback = useCallback((frequency: number = 440, duration: number = 100) => {
    if (!audioEnabled || !audioContextRef.current) return;

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration / 1000);

    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + duration / 1000);
  }, [audioEnabled]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent, sectionId?: string) => {
    e.preventDefault();
    const touch = e.touches[0];
    
    setTouchGesture({
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      startTime: Date.now(),
      type: 'none'
    });

    if (sectionId) {
      triggerHapticFeedback('light');
      onSectionInteraction?.(sectionId, 'touch_start');
    }
  }, [triggerHapticFeedback, onSectionInteraction]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    
    if (touchGesture) {
      const deltaX = touch.clientX - touchGesture.startX;
      const deltaY = touch.clientY - touchGesture.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      setTouchGesture(prev => prev ? {
        ...prev,
        currentX: touch.clientX,
        currentY: touch.clientY,
        type: distance > 20 ? 'swipe' : 'tap'
      } : null);

      // Handle rotation gesture
      if (distance > 50 && viewMode === 'circular') {
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        setRotation(angle);
      }
    }
  }, [touchGesture, viewMode]);

  const handleTouchEnd = useCallback((e: React.TouchEvent, sectionId?: string) => {
    e.preventDefault();
    
    if (touchGesture) {
      const duration = Date.now() - touchGesture.startTime;
      const deltaX = touchGesture.currentX - touchGesture.startX;
      const deltaY = touchGesture.currentY - touchGesture.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (duration < 300 && distance < 20) {
        // Tap gesture
        if (sectionId) {
          setSelectedSection(selectedSection === sectionId ? null : sectionId);
          triggerHapticFeedback('medium');
          triggerAudioFeedback(800, 100);
          onSectionInteraction?.(sectionId, 'tap');
        }
      } else if (distance > 50) {
        // Swipe gesture
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal swipe
          if (deltaX > 0) {
            // Swipe right - next view mode
            const modes: typeof viewMode[] = ['card', 'circular', 'linear'];
            const currentIndex = modes.indexOf(viewMode);
            setViewMode(modes[(currentIndex + 1) % modes.length]);
          } else {
            // Swipe left - previous view mode
            const modes: typeof viewMode[] = ['card', 'circular', 'linear'];
            const currentIndex = modes.indexOf(viewMode);
            setViewMode(modes[(currentIndex - 1 + modes.length) % modes.length]);
          }
          triggerHapticFeedback('heavy');
          triggerAudioFeedback(600, 150);
          onSectionInteraction?.('view_mode', 'swipe_change');
        } else {
          // Vertical swipe
          if (deltaY < 0) {
            // Swipe up - expand
            setIsExpanded(true);
          } else {
            // Swipe down - collapse
            setIsExpanded(false);
          }
        }
      }
    }
    
    setTouchGesture(null);
  }, [touchGesture, selectedSection, viewMode, triggerHapticFeedback, triggerAudioFeedback, onSectionInteraction]);

  // Pinch zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.5, Math.min(2, prev + delta)));
  }, []);

  const overallScore = completenessData?.score || 0;

  const renderCardView = () => (
    <div className="grid grid-cols-1 gap-4">
      {profileSections.map((section) => {
        const Icon = section.icon;
        const percentage = section.maxScore > 0 ? (section.score / section.maxScore) * 100 : 0;
        const isSelected = selectedSection === section.id;

        return (
          <Card
            key={section.id}
            className={cn(
              'transition-all duration-300 cursor-pointer transform-gpu',
              isSelected && 'scale-105 shadow-lg ring-2 ring-blue-500',
              'active:scale-95 touch-manipulation'
            )}
            onTouchStart={(e) => handleTouchStart(e, section.id)}
            onTouchMove={handleTouchMove}
            onTouchEnd={(e) => handleTouchEnd(e, section.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className={cn(
                  'p-3 rounded-full bg-gradient-to-br flex-shrink-0',
                  section.color,
                  isSelected && `shadow-lg ${section.glowColor}`
                )}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {section.label}
                    </h3>
                    <Badge variant="secondary" className="ml-2">
                      {Math.round(percentage)}%
                    </Badge>
                  </div>
                  
                  <Progress value={percentage} className="h-3 mb-2" />
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {section.score}/{section.maxScore} points
                    </span>
                    <div className="flex items-center space-x-1 text-yellow-600">
                      <Star className="h-3 w-3" />
                      <span>{section.xp} XP</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {isSelected && (
                <div className="mt-4 pt-4 border-t border-gray-200 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-medium">Weight</div>
                      <div className="text-gray-600">{section.weight}%</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-medium">Impact</div>
                      <div className="text-green-600">High</div>
                    </div>
                  </div>
                  <Button className="w-full mt-3" size="sm">
                    Improve Section
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderCircularView = () => (
    <div 
      className="relative h-80 w-full flex items-center justify-center"
      style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Central score */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="text-center">
          <div className="text-4xl font-bold text-blue-600 mb-1">
            {overallScore}%
          </div>
          <div className="text-sm text-gray-600">Complete</div>
        </div>
      </div>

      {/* Circular sections */}
      {profileSections.map((section, index) => {
        const angle = (index / profileSections.length) * 2 * Math.PI;
        const radius = 100;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const Icon = section.icon;
        const percentage = section.maxScore > 0 ? (section.score / section.maxScore) * 100 : 0;
        const isSelected = selectedSection === section.id;

        return (
          <div
            key={section.id}
            className={cn(
              'absolute w-16 h-16 cursor-pointer transition-all duration-300 transform-gpu',
              isSelected && 'scale-125 z-20'
            )}
            style={{
              transform: `translate(${x}px, ${y}px)`
            }}
            onTouchStart={(e) => handleTouchStart(e, section.id)}
            onTouchEnd={(e) => handleTouchEnd(e, section.id)}
          >
            <div className={cn(
              'w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br shadow-lg',
              section.color,
              isSelected && `shadow-xl ${section.glowColor}`
            )}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            
            {/* Progress ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="30"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
                fill="none"
              />
              <circle
                cx="32"
                cy="32"
                r="30"
                stroke="white"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 30}`}
                strokeDashoffset={`${2 * Math.PI * 30 * (1 - percentage / 100)}`}
                className="transition-all duration-1000"
                strokeLinecap="round"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );

  const renderLinearView = () => (
    <div className="space-y-3">
      {profileSections.map((section) => {
        const Icon = section.icon;
        const percentage = section.maxScore > 0 ? (section.score / section.maxScore) * 100 : 0;
        const isSelected = selectedSection === section.id;

        return (
          <div
            key={section.id}
            className={cn(
              'p-3 border rounded-lg cursor-pointer transition-all duration-300',
              isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 active:bg-gray-50'
            )}
            onTouchStart={(e) => handleTouchStart(e, section.id)}
            onTouchEnd={(e) => handleTouchEnd(e, section.id)}
          >
            <div className="flex items-center space-x-3">
              <div className={cn(
                'p-2 rounded-full bg-gradient-to-br flex-shrink-0',
                section.color
              )}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{section.label}</span>
                  <span className="text-sm text-gray-600">{Math.round(percentage)}%</span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Mobile Header with Controls */}
      <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Profile Progress</CardTitle>
            
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-white/20 text-white text-lg px-3 py-1">
                {overallScore}%
              </Badge>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-white hover:bg-white/20 p-2"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <Progress value={overallScore} className="flex-1 h-2 bg-white/20" />
            <div className="ml-3 text-sm">
              Level {Math.floor(overallScore / 20) + 1}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* View Mode Selector */}
      <div className="flex justify-center space-x-1 bg-gray-100 rounded-lg p-1">
        {[
          { mode: 'card' as const, icon: Smartphone, label: 'Cards' },
          { mode: 'circular' as const, icon: RotateCcw, label: 'Circle' },
          { mode: 'linear' as const, icon: Target, label: 'List' }
        ].map(({ mode, icon: Icon, label }) => (
          <Button
            key={mode}
            variant={viewMode === mode ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setViewMode(mode);
              triggerHapticFeedback('light');
              triggerAudioFeedback(700, 80);
            }}
            className="flex-1 flex items-center justify-center space-x-1 text-xs"
          >
            <Icon className="h-3 w-3" />
            <span>{label}</span>
          </Button>
        ))}
      </div>

      {/* Main Visualization */}
      <Card className={cn(
        'transition-all duration-500',
        isExpanded && 'fixed inset-4 z-50 overflow-auto'
      )}>
        <CardContent className="p-4">
          <div ref={containerRef}>
            {viewMode === 'card' && renderCardView()}
            {viewMode === 'circular' && renderCircularView()}
            {viewMode === 'linear' && renderLinearView()}
          </div>
        </CardContent>
      </Card>

      {/* Touch Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Haptic Feedback</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setHapticEnabled(!hapticEnabled);
                  triggerHapticFeedback('medium');
                }}
                className="p-2"
              >
                {hapticEnabled ? 
                  <Smartphone className="h-4 w-4 text-blue-500" /> : 
                  <Tablet className="h-4 w-4 text-gray-400" />
                }
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Audio Feedback</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAudioEnabled(!audioEnabled);
                  if (!audioEnabled) triggerAudioFeedback(440, 200);
                }}
                className="p-2"
              >
                {audioEnabled ? 
                  <Volume2 className="h-4 w-4 text-blue-500" /> : 
                  <VolumeX className="h-4 w-4 text-gray-400" />
                }
              </Button>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500 text-center space-y-1">
            <div>👆 Tap sections to view details</div>
            <div>👈👉 Swipe to change view modes</div>
            <div>👆👇 Swipe up/down to expand/collapse</div>
            {viewMode === 'circular' && <div>🤏 Pinch to zoom, rotate to spin</div>}
          </div>
        </CardContent>
      </Card>

      {/* Mobile Action Bar */}
      <div className="flex space-x-2">
        <Button className="flex-1" size="sm">
          <TrendingUp className="h-4 w-4 mr-2" />
          Improve Now
        </Button>
        
        <Button variant="outline" size="sm" onClick={() => {
          triggerHapticFeedback('light');
          // Share functionality
        }}>
          <Share2 className="h-4 w-4" />
        </Button>
        
        <Button variant="outline" size="sm" onClick={() => {
          setScale(1);
          setRotation(0);
          setSelectedSection(null);
          triggerHapticFeedback('medium');
        }}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MobileProfileVisualizer;