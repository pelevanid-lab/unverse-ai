import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ShieldCheck, Flame, Coins, Lock, BarChart3, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function InvestorTokenomics() {
    const t = useTranslations('InvestorTokenomics');

    // Circulating Supply Data Points (Estimated)
    const projectionData = [
        { month: 0, supply: 150 },   // Initial unlock (Liquidity + Promo + Partial Team)
        { month: 6, supply: 180 },   
        { month: 12, supply: 220 },  // First Cliff ends (Pre-sale starts)
        { month: 18, supply: 350 },
        { month: 24, supply: 480 },
        { month: 36, supply: 750 },
        { month: 48, supply: 1000 }
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-20 px-4">
            <header className="space-y-4 pt-6">
                <Link href="/tokenomics">
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary p-0">
                        <ChevronLeft className="w-4 h-4" /> {t('back')}
                    </Button>
                </Link>
                <div className="space-y-2">
                    <Badge className="bg-primary/20 text-primary border-none">{t('badge')}</Badge>
                    <h1 className="text-5xl font-headline font-bold tracking-tighter">{t('title')}</h1>
                    <p className="text-xl text-muted-foreground">{t('subtitle')}</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="glass-card border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> {t('fixedSupply')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold font-headline">1,000,000,000 <span className="text-sm font-normal opacity-50">ULC</span></p>
                        <p className="text-sm text-muted-foreground mt-2">{t('fixedSupplyDesc')}</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-red-500/20 bg-red-500/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Flame className="w-5 h-5 text-red-400" /> {t('deflationaryBurn')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold font-headline text-red-400">{t('continuous')} <span className="text-sm font-normal opacity-50">{t('burn')}</span></p>
                        <p className="text-sm text-muted-foreground mt-2">{t('deflationaryBurnDesc')}</p>
                    </CardContent>
                </Card>
            </div>

            <section className="space-y-6">
                <h2 className="text-3xl font-headline font-bold flex items-center gap-3">
                    <BarChart3 className="text-primary" /> {t('corePrinciples')}
                </h2>
                
                <div className="space-y-4">
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2 group hover:bg-white/[0.08] transition-all">
                        <h4 className="text-xl font-bold text-yellow-400">{t('p1Title')}</h4>
                        <p className="text-muted-foreground leading-relaxed">{t('p1Desc')}</p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2 group hover:bg-white/[0.08] transition-all">
                        <h4 className="text-xl font-bold text-yellow-500">{t('p2Title')}</h4>
                        <p className="text-muted-foreground leading-relaxed">{t('p2Desc')}</p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2 group hover:bg-white/[0.08] transition-all">
                        <h4 className="text-xl font-bold text-blue-400">{t('p3Title')}</h4>
                        <p className="text-muted-foreground leading-relaxed">{t('p3Desc')}</p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2 group hover:bg-white/[0.08] transition-all">
                        <h4 className="text-xl font-bold text-green-400">{t('p4Title')}</h4>
                        <p className="text-muted-foreground leading-relaxed">{t('p4Desc')}</p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2 group hover:bg-white/[0.08] transition-all">
                        <h4 className="text-xl font-bold text-primary">{t('p5Title')}</h4>
                        <p className="text-muted-foreground leading-relaxed">{t('p5Desc')}</p>
                    </div>
                </div>
            </section>

            {/* Circulating Supply Chart */}
            <section className="space-y-6">
                <h2 className="text-2xl font-headline font-bold flex items-center gap-3">
                    <TrendingUp className="text-primary" /> {t('projectionTitle')}
                </h2>
                <Card className="glass-card p-8 border-white/10 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
                    
                    <div className="relative h-64 w-full mt-4">
                        {/* SVG Chart */}
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 300" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="gradient-fill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                                    <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.1" />
                                    <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                                </linearGradient>
                                <filter id="glow">
                                    <feGaussianBlur stdDeviation="4" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>

                            {/* Grid Lines (Horizontal) */}
                            <line x1="0" y1="300" x2="1000" y2="300" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
                            <line x1="0" y1="225" x2="1000" y2="225" stroke="white" strokeOpacity="0.05" strokeWidth="1" />
                            <line x1="0" y1="150" x2="1000" y2="150" stroke="white" strokeOpacity="0.05" strokeWidth="1" />
                            <line x1="0" y1="75" x2="1000" y2="75" stroke="white" strokeOpacity="0.05" strokeWidth="1" />
                            <line x1="0" y1="0" x2="1000" y2="0" stroke="white" strokeOpacity="0.05" strokeWidth="1" />

                            {/* Grid Lines (Vertical) */}
                            {[0, 250, 500, 750, 1000].map(x => (
                                <line key={x} x1={x} y1="0" x2={x} y2="300" stroke="white" strokeOpacity="0.03" strokeWidth="1" />
                            ))}

                            {/* Area Fill - Smoothed Path */}
                            <path 
                                d="M 0 300 Q 125 240, 250 234 T 500 156 T 750 75 T 1000 0 L 1000 300 Z" 
                                fill="url(#gradient-fill)" 
                            />
                            
                            {/* Glow Path - Smoothed */}
                            <path 
                                d="M 0 255 Q 125 240, 250 234 T 500 156 T 750 75 T 1000 0" 
                                fill="none" 
                                stroke="var(--primary)" 
                                strokeWidth="8" 
                                opacity="0.2"
                                filter="url(#glow)"
                            />

                            {/* Main Line Path - Smoothed */}
                            <path 
                                d="M 0 255 Q 125 240, 250 234 T 500 156 T 750 75 T 1000 0" 
                                fill="none" 
                                stroke="var(--primary)" 
                                strokeWidth="3" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className="drop-shadow-[0_0_12px_rgba(var(--primary-rgb),0.8)]"
                            />

                            {/* Data Points + Halos */}
                            {projectionData.map((d, i) => {
                                const cx = (d.month / 48) * 1000;
                                const cy = 300 - (d.supply / 1000) * 300;
                                return (
                                    <g key={i} className="group/point">
                                        <circle cx={cx} cy={cy} r="10" fill="var(--primary)" fillOpacity="0.15" />
                                        <circle cx={cx} cy={cy} r="5" fill="var(--primary)" />
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Labels */}
                        <div className="flex justify-between mt-8 text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">
                            <span className="flex flex-col items-center gap-1">
                                <div className="w-px h-2 bg-white/20" />
                                {t('month')} 0
                            </span>
                            <span className="flex flex-col items-center gap-1">
                                <div className="w-px h-2 bg-white/20" />
                                {t('month')} 12
                            </span>
                            <span className="flex flex-col items-center gap-1">
                                <div className="w-px h-2 bg-white/20" />
                                {t('month')} 24
                            </span>
                            <span className="flex flex-col items-center gap-1">
                                <div className="w-px h-2 bg-white/20" />
                                {t('month')} 36
                            </span>
                            <span className="flex flex-col items-center gap-1">
                                <div className="w-px h-2 bg-white/20" />
                                {t('month')} 48
                            </span>
                        </div>
                    </div>
                </Card>
            </section>

            <Card className="glass-card border-yellow-500/50 bg-yellow-500/5 p-8 text-center space-y-4">
                <TrendingUp className="w-12 h-12 text-yellow-400 mx-auto" />
                <h3 className="text-2xl font-headline font-bold italic">{t('quoteTitle')}</h3>
                <p className="text-muted-foreground max-w-lg mx-auto italic">
                    {t('quoteDesc')}
                </p>
            </Card>
        </div>
    );
}
