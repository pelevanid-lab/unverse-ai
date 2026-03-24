"use client"

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    ChevronLeft, 
    ChevronRight, 
    Presentation, 
    ArrowRight, 
    Play, 
    Info, 
    CheckCircle2,
    Loader2,
    MonitorPlay
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
// Fix: UI imports
const ButtonReal = ({ children, onClick, variant, className, size }: any) => {
    return <button onClick={onClick} className={`px-4 py-2 rounded-xl transition-all font-bold flex items-center justify-center gap-2 ${variant === 'ghost' ? 'hover:bg-white/10' : 'bg-primary text-black'} ${className}`}>{children}</button>
};

interface PresentationOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'investor' | 'creator';
}

export function PresentationOverlay({ isOpen, onClose, type }: PresentationOverlayProps) {
    const [data, setData] = useState<any>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        
        const docId = `${type}_v3`;
        const unsub = onSnapshot(doc(db, 'presentations', docId), (snap) => {
            if (snap.exists()) {
                setData(snap.data());
            }
            setLoading(false);
        });

        return () => unsub();
    }, [isOpen, type]);

    // Prevent scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setCurrentSlide(0);
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [isOpen]);

    const slides = data?.slides || [];
    const activeSlide = slides[currentSlide];

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) setCurrentSlide(prev => prev + 1);
    };

    const prevSlide = () => {
        if (currentSlide > 0) setCurrentSlide(prev => prev - 1);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-8"
                >
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-8 end-8 w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:rotate-90 transition-all z-[120]"
                >
                    <X className="w-6 h-6" />
                </button>

                {loading ? (
                    <div className="flex flex-col items-center gap-4 opacity-50">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                        <p className="text-[10px] uppercase font-bold tracking-widest">Loading Presentation...</p>
                    </div>
                ) : (
                    <div className="w-full max-w-7xl h-full flex flex-col md:flex-row gap-8 items-center justify-center relative">
                        
                        {/* Slide Content */}
                        <div className="flex-1 w-full space-y-8 order-2 md:order-1">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentSlide}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-6"
                                >
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
                                        {activeSlide?.slogan || data?.subtitle}
                                    </div>
                                    <h2 className="text-4xl md:text-6xl font-headline font-bold text-white tracking-tight italic">
                                        {activeSlide?.title}
                                    </h2>
                                    <p className="text-lg md:text-xl text-white/50 leading-relaxed font-medium max-w-2xl">
                                        {activeSlide?.description}
                                    </p>

                                    {activeSlide?.bullets && activeSlide.bullets.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                                            {activeSlide.bullets.map((bullet: string, i: number) => (
                                                <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                                                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                                                    <span className="text-sm font-bold text-white/70 uppercase tracking-tighter">{bullet}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* Progress & Navigation */}
                            <div className="pt-12 flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={prevSlide}
                                        disabled={currentSlide === 0}
                                        className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/10 transition-all"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>
                                    <button 
                                        onClick={nextSlide}
                                        disabled={currentSlide === slides.length - 1}
                                        className="w-12 h-12 rounded-xl bg-primary text-black flex items-center justify-center disabled:opacity-20 hover:scale-105 transition-all"
                                    >
                                        <ChevronRight className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="flex-1 h-[2px] bg-white/10 relative rounded-full overflow-hidden">
                                    <motion.div 
                                        className="absolute inset-y-0 start-0 bg-primary"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
                                    />
                                </div>
                                <span className="text-[10px] font-black text-white/20 uppercase">
                                    Slide {currentSlide + 1} / {slides.length}
                                </span>
                            </div>
                        </div>

                        {/* Slide Visual */}
                        <div className="flex-1 w-full aspect-square md:aspect-auto md:h-[60vh] order-1 md:order-2">
                            <AnimatePresence mode="wait">
                                <motion.div 
                                    key={currentSlide}
                                    initial={{ opacity: 0, scale: 0.95, rotateY: 10 }}
                                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                                    exit={{ opacity: 0, scale: 1.05, rotateY: -10 }}
                                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                                    className="w-full h-full relative group"
                                >
                                    {/* Glass Frame */}
                                    <div className="absolute inset-0 rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md overflow-hidden shadow-2xl shadow-primary/20">
                                        {activeSlide?.mediaUrl ? (
                                            activeSlide.mediaType === 'video' ? (
                                                <video 
                                                    src={activeSlide.mediaUrl} 
                                                    autoPlay 
                                                    loop 
                                                    muted 
                                                    playsInline 
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <img 
                                                    src={activeSlide.mediaUrl} 
                                                    alt={activeSlide.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            )
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center opacity-10">
                                                <Presentation className="w-40 h-40" />
                                            </div>
                                        )}
                                        
                                        {/* Overlay Info */}
                                        <div className="absolute bottom-0 inset-x-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
                                            <p className="text-[10px] font-black tracking-[0.3em] text-primary uppercase mb-2">Unverse Strategic Asset</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md">
                                                    <Info className="w-4 h-4 text-white/40" />
                                                </div>
                                                <span className="text-[11px] font-bold text-white/60 tracking-tight uppercase">Protocol Level Verification Active</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Design Elements */}
                                    <div className="absolute -top-4 -end-4 w-24 h-24 bg-primary/20 blur-3xl rounded-full" />
                                    <div className="absolute -bottom-10 -start-10 w-40 h-40 bg-blue-500/10 blur-[100px] rounded-full" />
                                </motion.div>
                            </AnimatePresence>
                        </div>

                    </div>
                )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
