'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  Text, 
  Sphere, 
  Ring, 
  MeshDistortMaterial,
  Float,
  Environment,
  PerspectiveCamera,
  Effects
} from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
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
  PlayCircle,
  PauseCircle,
  RefreshCw,
  Share2,
  Download,
  Settings,
  Maximize2,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles
} from 'lucide-react';

// Enhanced types with gamification and 3D positioning
interface ProfileSection {
  id: string;
  label: string;
  icon: React.ElementType;
  score: number;
  maxScore: number;
  weight: number;
  color: string;
  glowColor: string;
  animationDelay: number;
  difficulty: 'easy' | 'medium' | 'hard';
  timeEstimate: string;
  suggestion: string;
  xp: number;
  maxXp: number;
  position: THREE.Vector3;
  isActive?: boolean;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xpReward: number;
  unlockedAt?: Date;
}

interface GamificationStats {
  level: number;
  totalXp: number;
  xpToNextLevel: number;
  streak: number;
  totalAchievements: number;
  unlockedAchievements: number;
  profileViews: number;
  connectionAcceptanceRate: number;
  engagementRate: number;
}

interface ProfileVisualization3DProps {
  completenessData: any;
  className?: string;
  enableAnimations?: boolean;
  showAchievements?: boolean;
  onSectionClick?: (sectionId: string) => void;
  performanceMode?: 'high' | 'medium' | 'low';
  enableSound?: boolean;
  theme?: 'light' | 'dark';
}

// 3D Sphere Component
interface ProfileSphereProps {
  section: ProfileSection;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: (hovering: boolean) => void;
  animationSpeed: number;
}

const ProfileSphere: React.FC<ProfileSphereProps> = ({
  section,
  isSelected,
  isHovered,
  onClick,
  onHover,
  animationSpeed
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const percentage = section.maxScore > 0 ? (section.score / section.maxScore) : 0;
  const color = new THREE.Color(section.color.includes('blue') ? '#3B82F6' : 
                                section.color.includes('green') ? '#10B981' :
                                section.color.includes('purple') ? '#8B5CF6' :
                                section.color.includes('orange') ? '#F59E0B' :
                                section.color.includes('indigo') ? '#6366F1' :
                                section.color.includes('cyan') ? '#06B6D4' :
                                section.color.includes('pink') ? '#EC4899' :
                                section.color.includes('yellow') ? '#EAB308' : '#6B7280');

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += animationSpeed * 0.01;
      meshRef.current.rotation.y += animationSpeed * 0.015;
      
      if (isHovered || isSelected) {
        meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, 1.2, 0.1));
      } else {
        meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, 1, 0.1));
      }
    }
    
    if (ringRef.current) {
      ringRef.current.rotation.z += animationSpeed * 0.02;
    }
  });

  return (
    <Float
      speed={animationSpeed}
      rotationIntensity={isSelected ? 2 : 0.5}
      floatIntensity={isSelected ? 2 : 1}
    >
      <group 
        position={section.position}
        onClick={onClick}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        {/* Main sphere */}
        <Sphere ref={meshRef} args={[0.5, 32, 32]}>
          <MeshDistortMaterial
            color={color}
            metalness={0.8}
            roughness={0.2}
            distort={isHovered ? 0.3 : 0.1}
            speed={animationSpeed}
            wireframe={false}
          />
        </Sphere>
        
        {/* Progress ring */}
        <Ring 
          ref={ringRef}
          args={[0.6, 0.65, 32]} 
          rotation={[Math.PI / 2, 0, 0]}
        >
          <meshBasicMaterial 
            color={color} 
            transparent 
            opacity={0.6}
          />
        </Ring>
        
        {/* Completion indicator */}
        <Ring 
          args={[0.65, 0.7, 32, 1, 0, percentage * Math.PI * 2]} 
          rotation={[Math.PI / 2, 0, -Math.PI / 2]}
        >
          <meshBasicMaterial 
            color={percentage >= 1 ? '#10B981' : '#EAB308'} 
            transparent 
            opacity={0.8}
          />
        </Ring>
        
        {/* Label */}
        {(isHovered || isSelected) && (
          <Text
            position={[0, -1, 0]}
            fontSize={0.2}
            color={color}
            anchorX="center"
            anchorY="middle"
          >
            {section.label}
          </Text>
        )}
      </group>
    </Float>
  );
};

// Central Score Display Component
interface CentralScoreProps {
  score: number;
  isAnimating: boolean;
  theme: 'light' | 'dark';
}

const CentralScore: React.FC<CentralScoreProps> = ({ score, isAnimating, theme }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const textColor = theme === 'dark' ? '#FFFFFF' : '#1F2937';
  
  useFrame((state) => {
    if (meshRef.current && isAnimating) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Central orb */}
      <Sphere ref={meshRef} args={[0.3, 32, 32]}>
        <MeshDistortMaterial
          color={score >= 90 ? '#10B981' : score >= 75 ? '#3B82F6' : score >= 50 ? '#EAB308' : '#EF4444'}
          metalness={1}
          roughness={0}
          distort={0.2}
          speed={2}
        />
      </Sphere>
      
      {/* Score text */}
      <Text
        position={[0, 0, 0.4]}
        fontSize={0.3}
        color={textColor}
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-bold.woff"
      >
        {score}%
      </Text>
    </group>
  );
};

// Particle System Component
interface ParticleSystemProps {
  count: number;
  enableEffects: boolean;
}

const ParticleSystem: React.FC<ParticleSystemProps> = ({ count, enableEffects }) => {
  const points = useRef<THREE.Points>(null!);
  const particlesGeometry = useRef<THREE.BufferGeometry>(null!);
  
  const positions = React.useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return pos;
  }, [count]);

  useFrame((state) => {
    if (points.current && enableEffects) {
      points.current.rotation.y += 0.001;
      points.current.rotation.x += 0.0005;
    }
  });

  if (!enableEffects) return null;

  return (
    <points ref={points}>
      <bufferGeometry ref={particlesGeometry}>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        sizeAttenuation
        color="#8B5CF6"
        transparent
        opacity={0.6}
      />
    </points>
  );
};

const ProfileVisualization3D: React.FC<ProfileVisualization3DProps> = ({
  completenessData,
  className,
  enableAnimations = true,
  showAchievements = true,
  onSectionClick,
  performanceMode = 'high',
  enableSound = false,
  theme = 'light'
}) => {
  const [isAnimating, setIsAnimating] = useState(enableAnimations);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [scale, setScale] = useState(1);
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [interactionMode, setInteractionMode] = useState<'rotate' | 'orbit' | 'focus'>('rotate');
  const [gamificationStats, setGamificationStats] = useState<GamificationStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement[]>([]);
  const [realTimeData, setRealTimeData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [celebrationActive, setCelebrationActive] = useState(false);
  const [performanceMode, setPerformanceMode] = useState<'high' | 'medium' | 'low'>('high');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleSystemRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Enhanced profile sections with 3D positioning
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
      animationDelay: 0,
      difficulty: 'easy',
      timeEstimate: '5 min',
      suggestion: 'Complete your name, location, and industry',
      xp: 50,
      maxXp: 100,
      position: new THREE.Vector3(0, 3, 0),
      isActive: selectedSection === 'basicInfo'
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
      animationDelay: 0.1,
      difficulty: 'easy',
      timeEstimate: '10 min',
      suggestion: 'Craft a compelling professional headline',
      xp: 75,
      maxXp: 100,
      position: new THREE.Vector3(2.5, 2.5, 0),
      isActive: selectedSection === 'headline'
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
      animationDelay: 0.2,
      difficulty: 'medium',
      timeEstimate: '30 min',
      suggestion: 'Write a compelling about section',
      xp: 120,
      maxXp: 200,
      position: new THREE.Vector3(3.5, 0, 0),
      isActive: selectedSection === 'summary'
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
      animationDelay: 0.3,
      difficulty: 'medium',
      timeEstimate: '45 min',
      suggestion: 'Add detailed work experience',
      xp: 150,
      maxXp: 200,
      position: new THREE.Vector3(2.5, -2.5, 0),
      isActive: selectedSection === 'experience'
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
      animationDelay: 0.4,
      difficulty: 'easy',
      timeEstimate: '15 min',
      suggestion: 'Add your educational background',
      xp: 60,
      maxXp: 100,
      position: new THREE.Vector3(0, -3, 0),
      isActive: selectedSection === 'education'
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
      animationDelay: 0.5,
      difficulty: 'easy',
      timeEstimate: '20 min',
      suggestion: 'Add relevant skills and get endorsements',
      xp: 80,
      maxXp: 100,
      position: new THREE.Vector3(-2.5, -2.5, 0),
      isActive: selectedSection === 'skills'
    },
    {
      id: 'profilePicture',
      label: 'Profile Picture',
      icon: Camera,
      score: completenessData?.breakdown?.profilePicture || 0,
      maxScore: 4,
      weight: 4,
      color: 'from-pink-400 to-pink-600',
      glowColor: 'shadow-pink-500/50',
      animationDelay: 0.6,
      difficulty: 'easy',
      timeEstimate: '5 min',
      suggestion: 'Upload a professional photo',
      xp: 40,
      maxXp: 50,
      position: new THREE.Vector3(-3.5, 0, 0),
      isActive: selectedSection === 'profilePicture'
    },
    {
      id: 'connections',
      label: 'Network',
      icon: Users,
      score: completenessData?.breakdown?.connections || 0,
      maxScore: 4,
      weight: 4,
      color: 'from-yellow-400 to-yellow-600',
      glowColor: 'shadow-yellow-500/50',
      animationDelay: 0.7,
      difficulty: 'medium',
      timeEstimate: 'ongoing',
      suggestion: 'Build your professional network',
      xp: 30,
      maxXp: 50,
      position: new THREE.Vector3(-2.5, 2.5, 0),
      isActive: selectedSection === 'connections'
    }
  ];

  // Enhanced achievements with celebration animations
  const sampleAchievements: Achievement[] = [
    {
      id: 'first_connection',
      title: 'Networker',
      description: 'Made your first connection',
      icon: Users,
      unlocked: true,
      progress: 1,
      maxProgress: 1,
      rarity: 'common',
      xpReward: 50,
      unlockedAt: new Date(Date.now() - 86400000)
    },
    {
      id: 'profile_complete_50',
      title: 'Half Way There',
      description: 'Reached 50% profile completion',
      icon: Target,
      unlocked: completenessData?.score >= 50,
      progress: Math.min(completenessData?.score || 0, 50),
      maxProgress: 50,
      rarity: 'common',
      xpReward: 100
    },
    {
      id: 'profile_complete_75',
      title: 'Almost Perfect',
      description: 'Reached 75% profile completion',
      icon: Star,
      unlocked: completenessData?.score >= 75,
      progress: Math.min(completenessData?.score || 0, 75),
      maxProgress: 75,
      rarity: 'rare',
      xpReward: 200
    },
    {
      id: 'profile_complete_90',
      title: 'Excellence',
      description: 'Reached 90% profile completion',
      icon: Trophy,
      unlocked: completenessData?.score >= 90,
      progress: Math.min(completenessData?.score || 0, 90),
      maxProgress: 90,
      rarity: 'epic',
      xpReward: 500
    },
    {
      id: 'streak_7',
      title: 'Week Warrior',
      description: 'Maintained a 7-day improvement streak',
      icon: Flame,
      unlocked: false,
      progress: 3,
      maxProgress: 7,
      rarity: 'rare',
      xpReward: 300
    }
  ];

  // WebSocket connection for real-time updates
  const connectWebSocket = useCallback(() => {
    const wsUrl = process.env.NODE_ENV === 'production' 
      ? `wss://${window.location.host}/ws/profile-3d`
      : 'ws://localhost:3007/profile-3d';

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        console.log('3D Profile Visualizer WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setRealTimeData(data);
          
          // Handle achievement unlocks with celebrations
          if (data.type === 'achievement_unlock') {
            setCelebrationActive(true);
            setNewlyUnlocked(prev => [...prev, data.achievement]);
            setTimeout(() => setCelebrationActive(false), 3000);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        // Attempt reconnection after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  }, []);

  // Audio feedback system
  const playSound = useCallback((type: 'click' | 'hover' | 'achievement') => {
    if (!enableSound) return;
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch (type) {
      case 'click':
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        break;
      case 'hover':
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
        break;
      case 'achievement':
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        break;
    }
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  }, [enableSound]);

  // Performance monitoring and optimization
  useEffect(() => {
    const checkPerformance = () => {
      // Monitor device capabilities and adjust settings
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const debugInfo = context?.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = context?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          // Adjust performance based on GPU capabilities
          if (renderer && renderer.includes('Intel')) {
            setPerformanceMode('medium');
          }
        }
      }
    };
    
    checkPerformance();
  }, []);

  // Initialize systems on mount
  useEffect(() => {
    setAchievements(sampleAchievements);
    setGamificationStats({
      level: Math.floor((completenessData?.score || 0) / 10) + 1,
      totalXp: (completenessData?.score || 0) * 10,
      xpToNextLevel: 100 - ((completenessData?.score || 0) % 10) * 10,
      streak: 3,
      totalAchievements: sampleAchievements.length,
      unlockedAchievements: sampleAchievements.filter(a => a.unlocked).length,
      profileViews: 142,
      connectionAcceptanceRate: 85,
      engagementRate: 12.5
    });

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket, completenessData]);

  // Enhanced interaction handlers with audio feedback
  const handleSectionClick = useCallback((sectionId: string) => {
    playSound('click');
    setSelectedSection(selectedSection === sectionId ? null : sectionId);
    setInteractionMode('focus');
    
    // Trigger celebration if section is completed
    const section = profileSections.find(s => s.id === sectionId);
    if (section && section.score >= section.maxScore) {
      setCelebrationActive(true);
      playSound('achievement');
      setTimeout(() => setCelebrationActive(false), 2000);
    }
    
    onSectionClick?.(sectionId);
  }, [selectedSection, onSectionClick, playSound, profileSections]);

  const handleMouseEnter = useCallback((sectionId: string) => {
    playSound('hover');
    setHoveredSection(sectionId);
  }, [playSound]);

  const handleMouseLeave = useCallback(() => {
    setHoveredSection(null);
  }, []);

  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
  };

  const cycleInteractionMode = () => {
    const modes: typeof interactionMode[] = ['rotate', 'orbit', 'focus'];
    const currentIndex = modes.indexOf(interactionMode);
    setInteractionMode(modes[(currentIndex + 1) % modes.length]);
  };

  const shareProgress = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My LinkedIn Profile Progress',
          text: `I've reached ${completenessData?.score || 0}% LinkedIn profile completion! 🚀`,
          url: window.location.href
        });
      } catch (error) {
        console.log('Share failed');
      }
    }
  };

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common': return 'text-gray-600 bg-gray-100';
      case 'rare': return 'text-blue-600 bg-blue-100';
      case 'epic': return 'text-purple-600 bg-purple-100';
      case 'legendary': return 'text-yellow-600 bg-yellow-100';
    }
  };

  // Get animation speed based on performance mode
  const getAnimationSpeed = () => {
    switch (performanceMode) {
      case 'high': return isAnimating ? 1 : 0;
      case 'medium': return isAnimating ? 0.5 : 0;
      case 'low': return isAnimating ? 0.25 : 0;
      default: return 1;
    }
  };
  
  // Get particle count based on performance mode
  const getParticleCount = () => {
    switch (performanceMode) {
      case 'high': return 100;
      case 'medium': return 50;
      case 'low': return 25;
      default: return 50;
    }
  };

  const overallScore = completenessData?.score || 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Celebration Effects */}
      {celebrationActive && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 animate-pulse" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="text-6xl animate-bounce">🎉</div>
          </div>
        </div>
      )}



      {/* Enhanced Gamification Header */}
      {gamificationStats && (
        <Card className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          <CardHeader className="pb-4 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                  <Trophy className="h-6 w-6 text-yellow-300" />
                </div>
                <div>
                  <CardTitle className="text-white text-lg">
                    Level {gamificationStats.level} Professional
                  </CardTitle>
                  <p className="text-white/80 text-sm">
                    {gamificationStats.xpToNextLevel} XP to next level
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <div className="flex items-center space-x-1">
                    <Flame className="h-4 w-4 text-orange-300 animate-flicker" />
                    <span className="text-lg font-bold">{gamificationStats.streak}</span>
                  </div>
                  <p className="text-xs text-white/80">Day Streak</p>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold">
                    {gamificationStats.unlockedAchievements}/{gamificationStats.totalAchievements}
                  </div>
                  <p className="text-xs text-white/80">Achievements</p>
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={shareProgress}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    <Share2 className="h-4 w-4 mr-1" />
                    Share
                  </Button>
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={cycleInteractionMode}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-white/80">Progress to Level {gamificationStats.level + 1}</span>
                <span className="text-sm text-white/80">
                  {gamificationStats.totalXp} / {(gamificationStats.level + 1) * 1000} XP
                </span>
              </div>
              <Progress 
                value={((gamificationStats.totalXp % 1000) / 1000) * 100} 
                className="h-3 bg-white/20"
              />
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Enhanced Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAnimation}
            className={cn(
              isAnimating && 'bg-green-50 border-green-200 text-green-700'
            )}
          >
            {isAnimating ? <PauseCircle className="h-4 w-4 mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
            {isAnimating ? 'Pause' : 'Animate'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setParticlesEnabled(!particlesEnabled)}
            className={cn(
              particlesEnabled && 'bg-purple-50 border-purple-200 text-purple-700'
            )}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Effects
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={cycleInteractionMode}
            className="flex items-center space-x-1"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="capitalize">{interactionMode}</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPerformanceMode(
              performanceMode === 'high' ? 'medium' : 
              performanceMode === 'medium' ? 'low' : 'high'
            )}
            className={cn(
              performanceMode === 'high' && 'bg-blue-50 border-blue-200 text-blue-700',
              performanceMode === 'medium' && 'bg-yellow-50 border-yellow-200 text-yellow-700',
              performanceMode === 'low' && 'bg-red-50 border-red-200 text-red-700'
            )}
          >
            <Settings className="h-4 w-4 mr-1" />
            {performanceMode}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEnableSound?.(!enableSound)}
            className={cn(
              enableSound && 'bg-indigo-50 border-indigo-200 text-indigo-700'
            )}
          >
            {enableSound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500 flex items-center">
            <div className={cn(
              "w-2 h-2 rounded-full mr-2",
              isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            )} />
            {isConnected ? 'Live Updates' : 'Offline'}
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={shareProgress}
              className="flex items-center space-x-1"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="flex items-center space-x-1"
            >
              <Maximize2 className="h-4 w-4" />
              <span>Fullscreen</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Enhanced 3D Visualization with Three.js */}
      <Card className={cn(
        "relative overflow-hidden transition-all duration-500",
        theme === 'dark' ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-gray-50 to-white'
      )}>
        <CardContent className="p-0">
          <div className="relative w-full h-96" ref={containerRef}>
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
              </div>
            }>
              <Canvas
                camera={{ position: [0, 0, 8], fov: 75 }}
                gl={{ 
                  antialias: performanceMode === 'high',
                  alpha: true,
                  powerPreference: performanceMode === 'high' ? 'high-performance' : 'low-power'
                }}
                dpr={performanceMode === 'high' ? 2 : 1}
                onCreated={({ gl }) => {
                  gl.setClearColor('#000000', 0);
                }}
              >
                {/* Lighting */}
                <ambientLight intensity={0.6} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8B5CF6" />
                
                {/* Environment */}
                {performanceMode === 'high' && (
                  <Environment preset="city" background={false} />
                )}
                
                {/* Camera Controls */}
                <OrbitControls
                  enablePan={false}
                  enableZoom={true}
                  enableRotate={true}
                  autoRotate={isAnimating && interactionMode === 'rotate'}
                  autoRotateSpeed={2}
                  minDistance={5}
                  maxDistance={15}
                  maxPolarAngle={Math.PI / 1.5}
                  minPolarAngle={Math.PI / 6}
                />
                
                {/* Central Score Display */}
                <CentralScore 
                  score={overallScore} 
                  isAnimating={isAnimating}
                  theme={theme}
                />
                
                {/* Profile Section Spheres */}
                {profileSections.map((section) => (
                  <ProfileSphere
                    key={section.id}
                    section={section}
                    isSelected={selectedSection === section.id}
                    isHovered={hoveredSection === section.id}
                    onClick={() => handleSectionClick(section.id)}
                    onHover={(hovering) => {
                      if (hovering) {
                        handleMouseEnter(section.id);
                      } else {
                        handleMouseLeave();
                      }
                    }}
                    animationSpeed={getAnimationSpeed()}
                  />
                ))}
                
                {/* Particle System */}
                <ParticleSystem 
                  count={getParticleCount()}
                  enableEffects={particlesEnabled && performanceMode !== 'low'}
                />
                
                {/* Post-processing effects */}
                {performanceMode === 'high' && celebrationActive && (
                  <Effects>
                    {/* Add bloom effect for celebrations */}
                  </Effects>
                )}
              </Canvas>
            </Suspense>
            
            {/* UI Overlay */}
            <div className="absolute top-4 left-4 z-10">
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className={cn(
                  'text-lg px-3 py-1 font-bold',
                  overallScore >= 90 ? 'bg-green-100 text-green-800' :
                  overallScore >= 75 ? 'bg-blue-100 text-blue-800' :
                  overallScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                )}>
                  {overallScore}% Complete
                </Badge>
              </div>
            </div>
            
            {/* Performance indicator */}
            {performanceMode !== 'high' && (
              <div className="absolute bottom-4 right-4 z-10">
                <Badge variant="outline" className="text-xs">
                  {performanceMode} quality
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section Details Panel */}
      {selectedSection && (
        <Card className="animate-in slide-in-from-bottom-4">
          <CardContent className="p-6">
            {(() => {
              const section = profileSections.find(s => s.id === selectedSection);
              if (!section) return null;
              
              const Icon = section.icon;
              const percentage = section.maxScore > 0 ? (section.score / section.maxScore) * 100 : 0;
              
              return (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        `bg-gradient-to-br ${section.color}`
                      )}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{section.label}</h3>
                        <p className="text-sm text-gray-600">{section.suggestion}</p>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSection(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{section.score}/{section.maxScore} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">{section.difficulty}</div>
                      <div className="text-gray-500">Difficulty</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">{section.timeEstimate}</div>
                      <div className="text-gray-500">Time Est.</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-green-600">+{section.xp} XP</div>
                      <div className="text-gray-500">Reward</div>
                    </div>
                  </div>
                  
                  <Button className="w-full" onClick={() => onSectionClick?.(section.id)}>
                    Improve {section.label}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Performance Stats */}
      {performanceMode !== 'high' && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
          Performance mode: {performanceMode} (adjusted for optimal frame rate)
        </div>
      )}
    </div>
  );
}; 
                className="h-2 bg-white/20"
              />
            </div>
          </CardHeader>
        </Card>
      )}

      {/* 3D Visualization */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-6 w-6 text-blue-500" />
              <span>Profile Visualization</span>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className={cn(
                'text-lg px-3 py-1 font-bold',
                overallScore >= 90 ? 'bg-green-100 text-green-800' :
                overallScore >= 75 ? 'bg-blue-100 text-blue-800' :
                overallScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              )}>
                {overallScore}%
              </Badge>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAnimation}
                className="p-2"
              >
                {isAnimating ? 
                  <PauseCircle className="h-4 w-4" /> : 
                  <PlayCircle className="h-4 w-4" />
                }
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div 
            ref={containerRef}
            className="relative h-96 flex items-center justify-center"
            style={{ perspective: '1000px' }}
          >
            {/* Central Score Display */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center">
                <div className={cn(
                  'text-6xl font-bold mb-2 transition-all duration-1000',
                  overallScore >= 90 ? 'text-green-500' :
                  overallScore >= 75 ? 'text-blue-500' :
                  overallScore >= 60 ? 'text-yellow-500' :
                  'text-red-500'
                )}>
                  {overallScore}%
                </div>
                <div className="text-lg text-gray-600 font-medium">
                  Profile Complete
                </div>
                {gamificationStats && (
                  <div className="mt-2 flex items-center justify-center space-x-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-gray-500">
                      +{Math.floor(overallScore * 2)} XP
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 3D Profile Sections */}
            {profileSections.map((section, index) => {
              const position = calculateSectionPosition(index, profileSections.length);
              const percentage = section.maxScore > 0 ? (section.score / section.maxScore) * 100 : 0;
              const isHovered = hoveredSection === section.id;
              const isSelected = selectedSection === section.id;
              const Icon = section.icon;

              return (
                <div
                  key={section.id}
                  className={cn(
                    'absolute w-20 h-20 cursor-pointer transition-all duration-500 transform-gpu',
                    isHovered && 'scale-125 z-20',
                    isSelected && 'scale-110 z-20'
                  )}
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) ${
                      isHovered ? 'translateZ(20px)' : 'translateZ(0px)'
                    }`,
                    animationDelay: `${section.animationDelay}s`
                  }}
                  onMouseEnter={() => setHoveredSection(section.id)}
                  onMouseLeave={() => setHoveredSection(null)}
                  onClick={() => handleSectionClick(section.id)}
                >
                  <div className={cn(
                    'w-full h-full rounded-full flex items-center justify-center',
                    'bg-gradient-to-br shadow-lg',
                    section.color,
                    isHovered && `shadow-xl ${section.glowColor}`,
                    'hover:shadow-2xl transition-all duration-300'
                  )}>
                    <Icon className={cn(
                      'text-white transition-all duration-300',
                      isHovered ? 'h-8 w-8' : 'h-6 w-6'
                    )} />
                  </div>
                  
                  {/* Progress Ring */}
                  <svg 
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox="0 0 80 80"
                  >
                    <circle
                      cx="40"
                      cy="40"
                      r="38"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="2"
                      fill="none"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="38"
                      stroke="white"
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 38}`}
                      strokeDashoffset={`${2 * Math.PI * 38 * (1 - percentage / 100)}`}
                      className="transition-all duration-1000 ease-out"
                      strokeLinecap="round"
                    />
                  </svg>
                  
                  {/* Floating Label */}
                  {(isHovered || isSelected) && (
                    <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-3 py-1 rounded-lg text-xs whitespace-nowrap">
                      <div className="font-medium">{section.label}</div>
                      <div className="text-gray-300">{Math.round(percentage)}% complete</div>
                      {section.xp > 0 && (
                        <div className="text-yellow-400">+{section.xp} XP</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Connecting Lines */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 1 }}
            >
              {profileSections.map((_, index) => {
                const pos1 = calculateSectionPosition(index, profileSections.length);
                const pos2 = calculateSectionPosition((index + 1) % profileSections.length, profileSections.length);
                
                return (
                  <line
                    key={index}
                    x1={pos1.x + 192} // Center offset
                    y1={pos1.y + 192}
                    x2={pos2.x + 192}
                    y2={pos2.y + 192}
                    stroke="rgba(59, 130, 246, 0.2)"
                    strokeWidth="1"
                    className="animate-pulse"
                  />
                );
              })}
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Achievements Gallery */}
      {showAchievements && achievements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-yellow-500" />
              <span>Achievements</span>
              <Badge variant="secondary">
                {achievements.filter(a => a.unlocked).length}/{achievements.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((achievement) => {
                const Icon = achievement.icon;
                const isUnlocked = achievement.unlocked;
                
                return (
                  <div
                    key={achievement.id}
                    className={cn(
                      'p-4 rounded-lg border-2 transition-all duration-300',
                      isUnlocked 
                        ? 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50 shadow-md hover:shadow-lg' 
                        : 'border-gray-200 bg-gray-50 opacity-60'
                    )}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={cn(
                        'p-2 rounded-full flex-shrink-0',
                        isUnlocked ? 'bg-yellow-500 text-white' : 'bg-gray-300 text-gray-500'
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className={cn(
                            'font-medium truncate',
                            isUnlocked ? 'text-gray-900' : 'text-gray-500'
                          )}>
                            {achievement.title}
                          </h4>
                          <Badge 
                            size="sm" 
                            className={cn('text-xs', getRarityColor(achievement.rarity))}
                          >
                            {achievement.rarity}
                          </Badge>
                        </div>
                        
                        <p className={cn(
                          'text-sm mb-2',
                          isUnlocked ? 'text-gray-600' : 'text-gray-400'
                        )}>
                          {achievement.description}
                        </p>
                        
                        <div className="space-y-2">
                          <Progress 
                            value={(achievement.progress / achievement.maxProgress) * 100} 
                            className="h-2"
                          />
                          
                          <div className="flex items-center justify-between text-xs">
                            <span className={cn(
                              isUnlocked ? 'text-gray-600' : 'text-gray-400'
                            )}>
                              {achievement.progress}/{achievement.maxProgress}
                            </span>
                            
                            <div className="flex items-center space-x-1">
                              <Star className="h-3 w-3 text-yellow-500" />
                              <span className={cn(
                                isUnlocked ? 'text-yellow-600' : 'text-gray-400'
                              )}>
                                {achievement.xpReward} XP
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {achievement.unlockedAt && (
                          <div className="mt-2 text-xs text-gray-500">
                            Unlocked {achievement.unlockedAt.toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section Details Panel */}
      {selectedSection && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            {(() => {
              const section = profileSections.find(s => s.id === selectedSection);
              if (!section) return null;
              
              const Icon = section.icon;
              const percentage = section.maxScore > 0 ? (section.score / section.maxScore) * 100 : 0;
              
              return (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      'p-3 rounded-full bg-gradient-to-br',
                      section.color
                    )}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{section.label}</h3>
                      <p className="text-sm text-gray-600">
                        {section.score}/{section.maxScore} points • {Math.round(percentage)}% complete
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Difficulty</div>
                      <Badge variant={
                        section.difficulty === 'easy' ? 'default' :
                        section.difficulty === 'medium' ? 'secondary' : 'destructive'
                      }>
                        {section.difficulty}
                      </Badge>
                    </div>
                    
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Time Estimate</div>
                      <div className="font-medium">{section.timeEstimate}</div>
                    </div>
                    
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">XP Reward</div>
                      <div className="font-medium text-yellow-600">+{section.xp} XP</div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-blue-900 mb-1">Suggestion</div>
                        <p className="text-blue-800 text-sm">{section.suggestion}</p>
                      </div>
                    </div>
                  </div>
                  
                  <Button className="w-full" size="lg">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Start Improving
                  </Button>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProfileVisualization3D;