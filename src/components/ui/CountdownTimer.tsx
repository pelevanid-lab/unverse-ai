"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface CountdownTimerProps {
  className?: string;
  onTimeUp?: () => void;
}

export function CountdownTimer({ className, onTimeUp }: CountdownTimerProps) {
  const t = useTranslations('AIStudio');
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const target = new Date();
      
      // Set target to today at 08:00:00
      target.setHours(8, 0, 0, 0);

      // If it's already past 8 AM today, set target to tomorrow at 8 AM
      if (now.getTime() >= target.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      const diff = target.getTime() - now.getTime();
      
      if (diff <= 0) {
        if (onTimeUp) onTimeUp();
        return null;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      return { hours, minutes, seconds };
    };

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [onTimeUp]);

  if (!timeLeft) return null;

  const TimeUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center mx-1">
      <div className="relative overflow-hidden h-8 w-11 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-lg border border-white/10 shadow-inner">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="text-lg font-black font-mono text-primary"
          >
            {value.toString().padStart(2, '0')}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="text-[8px] uppercase tracking-tighter text-muted-foreground mt-1 font-extrabold">{label}</span>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex items-center gap-3 p-3 bg-primary/5 rounded-2xl border border-primary/20 shadow-lg shadow-primary/5", className)}
    >
      <div className="flex items-center gap-2 mr-1">
        <div className="p-2 rounded-full bg-primary/20 text-primary">
          <Clock className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">{t('nextAiDrop')}</p>
          <div className="flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-primary opacity-50" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('atTime8AM')}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center">
        <TimeUnit value={timeLeft.hours} label={t('hrs')} />
        <span className="text-primary font-bold mb-5">:</span>
        <TimeUnit value={timeLeft.minutes} label={t('min')} />
        <span className="text-primary font-bold mb-5">:</span>
        <TimeUnit value={timeLeft.seconds} label={t('sec')} />
      </div>
    </motion.div>
  );
}
