
'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Slide {
    title: string;
    subtitle?: string;
    bullets?: string[];
    order: number;
}

export default function PresentationEngine({ type }: { type: 'investor' | 'creator' }) {
    const [slides, setSlides] = useState<Slide[]>([]);
    const [current, setCurrent] = useState(0);
    const [loading, setLoading] = useState(true);
    const [direction, setDirection] = useState(0);

    useEffect(() => {
        const fetchSlides = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'presentations', type));
                if (docSnap.exists()) {
                    setSlides(docSnap.data().slides.sort((a: any, b: any) => a.order - b.order));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchSlides();
    }, [type]);

    const nextSlide = () => {
        if (current < slides.length - 1) {
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
    }, [current, slides]);

    if (loading) return (
        <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-yellow-500 animate-spin opacity-20" />
        </div>
    );

    if (slides.length === 0) return (
        <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center text-white/50 italic">
            No slides found for {type} presentation.
        </div>
    );

    const slide = slides[current];

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 1000 : -1000,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 1000 : -1000,
            opacity: 0
        })
    };

    return (
        <div className="fixed inset-0 bg-[#060606] text-white overflow-hidden font-sans select-none">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,215,0,0.05),_transparent_70%)] pointer-events-none" />

            {/* Navigation Overlay */}
            <div className="absolute inset-0 flex items-center justify-between px-4 md:px-10 z-50 pointer-events-none">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={prevSlide}
                    disabled={current === 0}
                    className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 pointer-events-auto disabled:opacity-0 transition-all border border-white/5"
                >
                    <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={nextSlide}
                    disabled={current === slides.length - 1}
                    className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 pointer-events-auto disabled:opacity-0 transition-all border border-white/5"
                >
                    <ChevronRight className="w-6 h-6" />
                </Button>
            </div>

            {/* Content Area */}
            <AnimatePresence initial={false} custom={direction}>
                <motion.div
                    key={current}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                        x: { type: "spring", stiffness: 300, damping: 30 },
                        opacity: { duration: 0.2 }
                    }}
                    className="absolute inset-0 flex flex-col items-center justify-center p-6 md:p-20 text-center"
                >
                    <div className="max-w-4xl w-full space-y-8">
                        {/* Slide Number */}
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-[10px] uppercase tracking-[0.3em] font-bold text-yellow-500/50"
                        >
                            Step {current + 1} of {slides.length}
                        </motion.div>

                        {/* Title */}
                        <motion.h1 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className={cn(
                                "text-4xl md:text-7xl font-headline font-bold leading-tight",
                                slide.order === 1 ? "text-yellow-400" : "text-white"
                            )}
                        >
                            {slide.title}
                        </motion.h1>

                        {/* Subtitle */}
                        {slide.subtitle && (
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-lg md:text-2xl text-white/60 font-light max-w-2xl mx-auto italic"
                            >
                                {slide.subtitle}
                            </motion.p>
                        )}

                        {/* Bullets */}
                        {slide.bullets && slide.bullets.length > 0 && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 text-left max-w-3xl mx-auto"
                            >
                                {slide.bullets.map((bullet, i) => (
                                    <motion.div 
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.7 + (i * 0.1) }}
                                        className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-yellow-500/30 transition-colors group"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-yellow-500/40 transition-colors">
                                            <ArrowRight className="w-3 h-3 text-yellow-400" />
                                        </div>
                                        <span className="text-sm md:text-base opacity-80 group-hover:opacity-100 transition-opacity leading-relaxed">
                                            {bullet}
                                        </span>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Progress Bar */}
            <div className="absolute bottom-10 left-10 right-10 flex gap-2 z-50">
                {slides.map((_, i) => (
                    <div 
                        key={i} 
                        className={cn(
                            "h-1 flex-1 rounded-full transition-all duration-500",
                            i <= current ? "bg-yellow-500" : "bg-white/10"
                        )}
                    />
                ))}
            </div>

            {/* Footer */}
            <div className="absolute bottom-4 left-10 text-[8px] uppercase tracking-widest opacity-30 font-bold">
                Unverse AI Protocol // Investor Safeword
            </div>
            <div className="absolute bottom-4 right-10 text-[8px] uppercase tracking-widest opacity-30 font-bold">
                EST 2026 // {type.toUpperCase()} DECK
            </div>
        </div>
    );
}
