'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    CheckCircle2, 
    PlayCircle, 
    Circle, 
    Milestone, 
    Zap, 
    Sparkles, 
    ShieldCheck, 
    ArrowRight,
    TrendingUp,
    Lock
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RoadmapOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

export function RoadmapOverlay({ isOpen, onClose }: RoadmapOverlayProps) {
    const t = useTranslations('Community');
    const roadmap = t.raw('roadmapPhases');

    const phases = [
        { 
            id: 0, 
            status: 'completed', 
            icon: <CheckCircle2 className="w-6 h-6 text-green-400" />, 
            color: 'green',
            name: roadmap.p0_name,
            desc: roadmap.p0_desc,
            points: roadmap.p0_points
        },
        { 
            id: 1, 
            status: 'active', 
            icon: <PlayCircle className="w-6 h-6 text-yellow-500 animate-pulse" />, 
            color: 'yellow',
            name: roadmap.p1_name,
            desc: roadmap.p1_desc,
            points: roadmap.p1_points
        },
        { 
            id: 2, 
            status: 'upcoming', 
            icon: <Circle className="w-6 h-6 text-blue-400/50" />, 
            color: 'blue',
            name: roadmap.p2_name,
            desc: roadmap.p2_desc,
            points: roadmap.p2_points
        },
        { 
            id: 3, 
            status: 'upcoming', 
            icon: <Circle className="w-6 h-6 text-purple-400/50" />, 
            color: 'purple',
            name: roadmap.p3_name,
            desc: roadmap.p3_desc,
            points: roadmap.p3_points
        },
        { 
            id: 4, 
            status: 'upcoming', 
            icon: <Circle className="w-6 h-6 text-pink-400/50" />, 
            color: 'pink',
            name: roadmap.p4_name,
            desc: roadmap.p4_desc,
            points: roadmap.p4_points
        }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
                >
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
                        onClick={onClose}
                    />

                    {/* Window */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-5xl max-h-[90vh] bg-zinc-950 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-yellow-400/10 border border-yellow-400/20">
                                    <Milestone className="w-6 h-6 text-yellow-500" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-headline font-bold text-white tracking-tight uppercase">{t('roadmapTitle')}</h2>
                                    <p className="text-sm text-white/40">{t('roadmapSubtitle')}</p>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={onClose}
                                className="rounded-full hover:bg-white/5 text-white/50 hover:text-white"
                            >
                                <X className="w-6 h-6" />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-12 space-y-12 scrollbar-none">
                            <div className="relative">
                                {/* Vertical Line */}
                                <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-yellow-500/50 via-blue-500/50 to-pink-500/50 hidden md:block" />
                                
                                <div className="space-y-24 relative">
                                    {phases.map((phase, idx) => (
                                        <motion.div 
                                            key={phase.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            className={`flex flex-col md:flex-row items-start md:items-center gap-8 ${idx % 2 === 0 ? 'md:flex-row-reverse' : ''}`}
                                        >
                                            {/* Content Area */}
                                            <div className="flex-1 w-full">
                                                <div className={`p-8 rounded-[2rem] border transition-all duration-500 ${
                                                    phase.status === 'completed' ? 'bg-green-500/5 border-green-500/20 grayscale-0' :
                                                    phase.status === 'active' ? 'bg-yellow-500/5 border-yellow-500/40 shadow-lg shadow-yellow-500/5' :
                                                    'bg-white/[0.02] border-white/10 opacity-60'
                                                }`}>
                                                    <div className="flex items-center justify-between mb-4">
                                                        <Badge variant="outline" className={`text-[10px] uppercase font-bold px-3 py-1 ${
                                                            phase.status === 'completed' ? 'text-green-400 border-green-400/50' :
                                                            phase.status === 'active' ? 'text-yellow-500 border-yellow-500/50' :
                                                            'text-white/30 border-white/10'
                                                        }`}>
                                                            {t(`status.${phase.status}`)}
                                                        </Badge>
                                                        {phase.status === 'active' && <Sparkles className="w-4 h-4 text-yellow-500 animate-spin-slow" />}
                                                    </div>
                                                    
                                                    <h3 className="text-xl font-headline font-bold text-white mb-2">{phase.name}</h3>
                                                    <p className="text-sm text-white/50 mb-6 leading-relaxed">{phase.desc}</p>
                                                    
                                                    <div className="space-y-3">
                                                        {phase.points.map((point: string, pIdx: number) => (
                                                            <div key={pIdx} className="flex items-start gap-3">
                                                                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                                                                    phase.status === 'completed' ? 'bg-green-400' :
                                                                    phase.status === 'active' ? 'bg-yellow-500' :
                                                                    'bg-white/20'
                                                                }`} />
                                                                <span className="text-xs text-white/70">{point}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Center Icon */}
                                            <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 flex items-center justify-center">
                                                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all duration-500 bg-zinc-950 z-10 ${
                                                    phase.status === 'completed' ? 'border-green-500/40 shadow-lg shadow-green-500/20' :
                                                    phase.status === 'active' ? 'border-yellow-500 scale-125 shadow-xl shadow-yellow-500/20' :
                                                    'border-white/10'
                                                }`}>
                                                    {phase.icon}
                                                </div>
                                            </div>

                                            {/* Empty Spacing for layout alignment */}
                                            <div className="flex-1 hidden md:block" />
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Footer Note */}
                            <div className="pt-12 text-center pb-8 border-t border-white/5">
                                <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                    <ShieldCheck className="w-5 h-5" />
                                    <span className="text-xs font-bold uppercase tracking-widest">{t('immutableNote')}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

