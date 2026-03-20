import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Users, Coins, Zap, Heart, MessageSquare, ChevronLeft, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function CreatorTokenomics() {
    const t = useTranslations('CreatorTokenomics');

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-20 px-4">
            <header className="space-y-4 pt-6">
                <Link href="/tokenomics">
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary p-0">
                        <ChevronLeft className="w-4 h-4" /> {t('back')}
                    </Button>
                </Link>
                <div className="space-y-2">
                    <Badge className="bg-pink-500/20 text-pink-400 border-none">{t('badge')}</Badge>
                    <h1 className="text-5xl font-headline font-bold tracking-tighter text-pink-400">{t('title')}</h1>
                    <p className="text-xl text-muted-foreground">{t('subtitle')}</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Subscriptions Card */}
                <Card className="glass-card border-pink-500/20 bg-pink-500/5 group hover:bg-pink-500/10 transition-all">
                    <CardHeader className="text-center">
                        <div className="p-3 bg-pink-500/20 rounded-2xl w-fit mx-auto mb-2"><Users className="text-pink-400" /></div>
                        <CardTitle className="text-lg">{t('subsTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-3xl font-bold font-headline text-pink-400">{t('subsRate')}</p>
                        <p className="text-xs text-muted-foreground mt-2">{t('subsDesc')}</p>
                    </CardContent>
                </Card>

                {/* Premium Unlock Card */}
                <Card className="glass-card border-yellow-500/20 bg-yellow-500/5 group hover:bg-yellow-500/10 transition-all">
                    <CardHeader className="text-center">
                        <div className="p-3 bg-yellow-500/20 rounded-2xl w-fit mx-auto mb-2"><Zap className="text-yellow-400" /></div>
                        <CardTitle className="text-lg">{t('unlockTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-3xl font-bold font-headline text-yellow-400">{t('unlockRate')}</p>
                        <p className="text-xs text-muted-foreground mt-2">{t('unlockDesc')}</p>
                    </CardContent>
                </Card>

                {/* Limited Edition Card (Replaced Tips) */}
                <Card className="glass-card border-blue-500/20 bg-blue-500/5 group hover:bg-blue-500/10 transition-all shadow-lg shadow-blue-500/5">
                    <CardHeader className="text-center">
                        <div className="p-3 bg-blue-500/20 rounded-2xl w-fit mx-auto mb-2"><Star className="text-blue-400 fill-current" /></div>
                        <CardTitle className="text-lg">{t('limitedTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-3xl font-bold font-headline text-blue-400">{t('limitedRate')}</p>
                        <p className="text-xs text-muted-foreground mt-2">{t('limitedDesc')}</p>
                    </CardContent>
                </Card>
            </div>

            <section className="space-y-10">
                <div className="flex flex-col md:flex-row items-center gap-8 bg-white/5 p-8 rounded-3xl border border-white/10">
                    <div className="flex-1 space-y-4">
                        <h3 className="text-2xl font-headline font-bold flex items-center gap-2">
                             <Sparkles className="text-pink-400" /> {t('aiStudioTitle')}
                        </h3>
                        <p className="text-muted-foreground">
                            {t('aiStudioDesc')}
                        </p>
                        <div className="flex flex-wrap items-center gap-4">
                            <Badge variant="outline" className="border-pink-500/30 text-pink-400">{t('generateBadge')}</Badge>
                            <Badge variant="outline" className="border-blue-500/30 text-blue-400">{t('accessBadge')}</Badge>
                        </div>
                    </div>
                    <div className="w-full md:w-48 aspect-square bg-gradient-to-br from-pink-500/20 to-blue-500/20 rounded-2xl border border-white/10 flex items-center justify-center">
                         <MessageSquare className="w-12 h-12 text-pink-400 opacity-50" />
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-2xl font-headline font-bold">{t('howToStart')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { step: "01", title: t('s1Title'), desc: t('s1Desc') },
                            { step: "02", title: t('s2Title'), desc: t('s2Desc') },
                            { step: "03", title: t('s3Title'), desc: t('s3Desc') },
                            { step: "04", title: t('s4Title'), desc: t('s4Desc') }
                        ].map((s, idx) => (
                            <div key={idx} className="p-6 rounded-2xl bg-white/2 border border-white/5 hover:bg-white/5 transition-colors">
                                <span className="text-xs font-bold text-pink-400 opacity-50">{s.step}</span>
                                <h4 className="font-bold text-lg mt-1">{s.title}</h4>
                                <p className="text-sm text-muted-foreground mt-2">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <Card className="glass-card border-primary/50 bg-primary/5 p-8 text-center space-y-6">
                 <h3 className="text-3xl font-headline font-bold">{t('footerTitle')}</h3>
                 <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                    {t('footerDesc')}
                 </p>
                 <Link href="/mypage">
                    <Button className="h-14 px-10 rounded-2xl text-lg font-bold bg-pink-500 hover:bg-pink-600 shadow-xl shadow-pink-500/20">
                        {t('startNow')}
                    </Button>
                 </Link>
            </Card>
        </div>
    );
}
