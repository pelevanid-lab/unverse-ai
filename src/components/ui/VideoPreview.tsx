"use client";

import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Play, Loader2 } from 'lucide-react';

interface VideoPreviewProps {
  src: string;
  className?: string;
  autoPlayThreshold?: number; // Time in seconds to pause (default 3)
}

export function VideoPreview({ src, className, autoPlayThreshold = 3 }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
        // Reset to start and play on hover
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(err => {
            console.warn("Autoplay blocked or failed:", err);
        });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.currentTime >= autoPlayThreshold) {
      videoRef.current.pause();
    }
  };

  return (
    <div 
      className={cn("relative w-full h-full overflow-hidden bg-black/20", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="w-5 h-5 text-primary/50 animate-spin" />
        </div>
      )}
      
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedData={() => setIsLoading(false)}
        onError={() => {
            setIsLoading(false);
            setError(true);
        }}
        className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100"
        )}
      />

      {/* Play Icon Overlay (Visible when not playing/hovering) */}
      {!isHovered && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 pointer-events-none group-hover:bg-black/0 transition-colors">
          <div className="p-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
            <Play className="w-4 h-4 text-white fill-current" />
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
           <p className="text-[10px] text-white/60 font-bold uppercase">Video Error</p>
        </div>
      )}
    </div>
  );
}
