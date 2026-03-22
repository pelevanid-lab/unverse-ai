'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Loader2, ArrowRight, PlayCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Slide {
    id: string;
    title: string;
    description?: string;
    slogan?: string;
    bullets?: string[];
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    order: number;
}

interface PresentationData {
    title: string;
    subtitle: string;
    slides: Slide[];
}

export default function PresentationViewer({ type }: { type: 'investor' | 'creator' }) {
    const [data, setData] = useState<PresentationData | null>(null);
    const [current, setCurrent] = useState(0);
    const [loading, setLoading] = useState(true);
    const [direction, setDirection] = useState(0);

    useEffect(() => {
        // Use real-time listener for instant updates
        const docId = `${type}_v3`;
        const unsub = onSnapshot(doc(db, 'presentations', docId), (docSnap) => {
            if (docSnap.exists()) {
                const fetched = docSnap.data() as PresentationData;
                setData({
                    ...fetched,
                    slides: fetched.slides.sort((a, b) => a.order - b.order)
                });
            }
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });

        return () => unsub();
    }, [type]);

    const nextSlide = () => {
        if (data && current < data.slides.length - 1) {
            setDirection(1);
            setCurrent(current + 1);
        }
    };

    const prevSlide = () => {
        if (current > 0) {
            setDirection(-1);
            setCurrent(current - 1);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [current, data]);

    if (loading) return (
        <div className="fixed inset-0 bg-[#060606] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-yellow-500 animate-spin opacity-20" />
        </div>
    );

    if (!data || data.slides.length === 0) return (
        <div className="fixed inset-0 bg-[#060606] flex items-center justify-center text-white/30 italic px-10 text-center">
            <div className="space-y-4">
                <p>No slides found for {type} presentation (v3).</p>
                <p className="text-xs opacity-50">Please add slides in the Admin Panel -> Presentations tab.</p>
            </div>
        </div>
    );

    const slide = data.slides[current];

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 1000 : -1000,
            opacity: 0,
            scale: 0.95
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 1000 : -1000,
            opacity: 0,
            scale: 1.05
        })
    };

    return (
        <div className="fixed inset-0 bg-[#060606] text-white overflow-hidden font-sans select-none">
            {/* Background Aesthetic */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,215,0,0.03),_transparent_70%)] pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent" />

            {/* Navigation Overlay */}
            <div className="absolute inset-0 flex items-center justify-between px-4 md:px-10 z-50 pointer-events-none">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={prevSlide}
                    disabled={current === 0}
                    className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 pointer-events-auto disabled:opacity-0 transition-all border border-white/5 backdrop-blur-md"
                >
                    <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={nextSlide}
                    disabled={current === data.slides.length - 1}
                    className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 pointer-events-auto disabled:opacity-0 transition-all border border-white/5 backdrop-blur-md"
                >
                    <ChevronRight className="w-8 h-8" />
                </Button>
            </div>

            {/* Content Area */}
            <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                    key={current}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                        x: { type: "spring", stiffness: 200, damping: 25 },
                        opacity: { duration: 0.3 }
                    }}
                    className="absolute inset-0 flex flex-col items-center justify-center p-6 md:p-20 text-center"
                >
                    <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                        
                        {/* Left Side: Content */}
                        <div className={cn(
                            "space-y-8",
                            slide.mediaUrl ? "lg:col-span-7 text-left" : "lg:col-span-12 text-center"
                        )}>
                            {/* Slogan / Badge */}
                            {slide.slogan && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className={cn(
                                        "text-[10px] uppercase tracking-[0.4em] font-bold text-yellow-500/60 flex items-center gap-4 px-3 py-1 bg-yellow-500/5 border border-yellow-500/10 rounded-full w-fit",
                                        !slide.mediaUrl && "mx-auto"
                                    )}
                                >
                                    {slide.slogan}
                                </motion.div>
                            )}

                            {/* Title */}
                            <motion.h1 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3, duration: 0.5 }}
                                className="text-4xl md:text-7xl font-headline font-bold leading-tight text-white drop-shadow-2xl"
                            >
                                {slide.title}
                            </motion.h1>

                            {/* Description */}
                            {slide.description && (
                                <motion.p 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className={cn(
                                        "text-lg md:text-2xl text-white/60 font-light leading-relaxed max-w-3xl",
                                        !slide.mediaUrl && "mx-auto"
                                    )}
                                >
                                    {slide.description}
                                </motion.p>
                            )}

                            {/* Bullets */}
                            {slide.bullets && slide.bullets.length > 0 && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.6 }}
                                    className={cn(
                                        "grid grid-cols-1 md:grid-cols-2 gap-4 mt-8",
                                        !slide.mediaUrl && "max-w-3xl mx-auto"
                                    )}
                                >
                                    {slide.bullets.map((bullet, i) => (
                                        <div 
                                            key={i}
                                            className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-yellow-500/30 transition-all group backdrop-blur-sm"
                                        >
                                            <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-yellow-500/40 transition-colors">
                                                <ArrowRight className="w-3 h-3 text-yellow-400" />
                                            </div>
                                            <span className="text-sm md:text-base opacity-70 group-hover:opacity-100 transition-opacity leading-relaxed text-left">
                                                {bullet}
                                            </span>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        {/* Right Side: Media */}
                        {slide.mediaUrl && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                transition={{ delay: 0.4, type: "spring" }}
                                className="lg:col-span-5 relative group"
                            >
                                <div className="absolute -inset-4 bg-yellow-500/10 blur-3xl opacity-0 group-hover:opacity-40 transition-opacity" />
                                <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-white/5 aspect-video md:aspect-square flex items-center justify-center shadow-2xl">
                                    {slide.mediaType === 'video' ? (
                                        <video 
                                            src={slide.mediaUrl} 
                                            autoPlay 
                                            loop 
                                            muted 
                                            playsInline 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <img 
                                            src={slide.mediaUrl} 
                                            alt={slide.title} 
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                    
                                    {/* Media Type Overlay */}
                                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md p-2 rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {slide.mediaType === 'video' ? <PlayCircle className="w-4 h-4 text-yellow-400" /> : <ImageIcon className="w-4 h-4 text-yellow-400" />}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Progress / Step Indicator */}
            <div className="absolute bottom-12 left-10 right-10 flex gap-1 z-50">
                {data.slides.map((_, i) => (
                    <motion.div 
                        key={i} 
                        initial={false}
                        animate={{ 
                            flex: i === current ? 3 : 1,
                            backgroundColor: i <= current ? "rgba(234, 179, 8, 1)" : "rgba(255, 255, 255, 0.1)"
                        }}
                        className="h-1.5 rounded-full transition-all duration-500"
                    />
                ))}
            </div>

            {/* Global Branding Headers */}
            <div className="absolute top-8 left-10 flex items-center gap-4 opacity-50">
                <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center font-bold text-black text-sm">U</div>
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1">Unverse AI</div>
                    <div className="text-[8px] opacity-70 uppercase tracking-[0.2em] leading-none">{data.subtitle}</div>
                </div>
            </div>

            {/* Footer Information */}
            <div className="absolute bottom-4 left-10 text-[8px] uppercase tracking-[0.3em] opacity-30 font-bold flex gap-4">
                <span>PROTOCOL // {type.toUpperCase()} DECK</span>
                <span className="text-yellow-500/50">SEAL ACTIVE</span>
            </div>
            <div className="absolute bottom-4 right-10 text-[8px] uppercase tracking-[0.3em] opacity-30 font-bold">
                EST 2026 // SLIDE {current + 1} OF {data.slides.length}
            </div>
        </div>
    );
}
