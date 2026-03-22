"use client";

import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Play, Pause, Volume2, VolumeX, Maximize2, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface VideoPreviewProps {
  src: string;
  className?: string;
  autoPlayThreshold?: number; // Time in seconds to pause (default 10)
  onError?: () => void;
  showControls?: boolean;
}

export function VideoPreview({ src, className, autoPlayThreshold = 10, onError, showControls = true }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Performance: Only play when visible if hovered
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (videoRef.current) {
            if (entry.isIntersecting && isHovered) {
              videoRef.current.play().catch(() => {});
            } else {
              videoRef.current.pause();
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isHovered]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
      
      // Auto-pause if it's a "preview" and threshold is met
      if (!isHovered && videoRef.current.currentTime >= autoPlayThreshold) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full overflow-hidden bg-black/40 group/video cursor-pointer", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
          setIsHovered(false);
          videoRef.current?.pause();
      }}
    >
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20 backdrop-blur-sm">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      )}
      
      <video
        ref={videoRef}
        src={src}
        muted={isMuted}
        playsInline
        loop
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedData={() => setIsLoading(false)}
        onError={() => {
            setIsLoading(false);
            setError(true);
            if (onError) onError();
        }}
        className={cn(
            "w-full h-full object-cover transition-all duration-500",
            isLoading ? "opacity-0 scale-105" : "opacity-100 scale-100",
            isHovered && "brightness-110"
        )}
      />

      {/* Premium Glass Controls */}
      <AnimatePresence>
          {showControls && !isLoading && !error && isHovered && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex flex-col justify-between p-4 z-20"
            >
                {/* Top Bar */}
                <div className="flex justify-end">
                    <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8 rounded-full bg-black/20 backdrop-blur-md border border-white/10 hover:bg-white/10">
                        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </Button>
                </div>

                {/* Bottom Bar */}
                <div className="space-y-3">
                    {/* Progress Bar */}
                    <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                        />
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={togglePlay} className="h-10 w-10 rounded-full bg-primary text-white shadow-lg shadow-primary/20 hover:scale-110 transition-transform">
                                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                            </Button>
                            <div className="text-[10px] font-black uppercase tracking-widest text-white/60">
                                {isPlaying ? "Live Preview" : "Paused"}
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-white">
                            <Maximize2 size={14} />
                        </Button>
                    </div>
                </div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* Minimal Play Overlay when NOT hovered */}
      {!isHovered && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/5 opacity-40">
                <Play size={20} className="text-white fill-current" />
            </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
           <AlertCircle className="w-8 h-8 text-red-500 mb-2 opacity-50" />
           <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Source Expired</p>
        </div>
      )}
    </div>
  );
}
