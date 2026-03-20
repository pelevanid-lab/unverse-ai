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
                        <p className="text-3xl font-bold font-headline text-red-400">Continuous <span className="text-sm font-normal opacity-50">Burn</span></p>
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
                <Card className="glass-card p-8 border-white/10 overflow-hidden">
                    <div className="relative h-64 w-full mt-4">
                        {/* SVG Chart */}
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 300" preserveAspectRatio="none">
                            {/* Grid Lines */}
                            <line x1="0" y1="300" x2="1000" y2="300" stroke="white" strokeOpacity="0.1" />
                            <line x1="0" y1="225" x2="1000" y2="225" stroke="white" strokeOpacity="0.05" />
                            <line x1="0" y1="150" x2="1000" y2="150" stroke="white" strokeOpacity="0.05" />
                            <line x1="0" y1="75" x2="1000" y2="75" stroke="white" strokeOpacity="0.05" />
                            <line x1="0" y1="0" x2="1000" y2="0" stroke="white" strokeOpacity="0.05" />

                            {/* Area Fill */}
                            <path 
                                d="M 0 300 L 0 255 L 125 246 L 250 234 L 375 195 L 500 156 L 750 75 L 1000 0 L 1000 300 Z" 
                                fill="url(#gradient-fill)" 
                                fillOpacity="0.1"
                            />
                            
                            {/* Line Path */}
                            <path 
                                d="M 0 255 L 125 246 L 250 234 L 375 195 L 500 156 L 750 75 L 1000 0" 
                                fill="none" 
                                stroke="var(--primary)" 
                                strokeWidth="4" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className="drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]"
                            />

                            {/* Data Points */}
                            {projectionData.map((d, i) => (
                                <circle 
                                    key={i}
                                    cx={(d.month / 48) * 1000} 
                                    cy={300 - (d.supply / 1000) * 300} 
                                    r="5" 
                                    fill="var(--primary)" 
                                />
                            ))}

                            <defs>
                                <linearGradient id="gradient-fill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--primary)" />
                                    <stop offset="100%" stopColor="transparent" />
                                </linearGradient>
                            </defs>
                        </svg>

                        {/* Labels */}
                        <div className="flex justify-between mt-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            <span>{t('month')} 0</span>
                            <span>{t('month')} 12</span>
                            <span>{t('month')} 24</span>
                            <span>{t('month')} 36</span>
                            <span>{t('month')} 48</span>
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
