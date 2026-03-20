
"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Users, Coins, Zap, Heart, MessageSquare, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

export default function CreatorTokenomics() {
    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-20">
            <header className="space-y-4">
                <Link href="/tokenomics">
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary">
                        <ChevronLeft className="w-4 h-4" /> Geri Dön
                    </Button>
                </Link>
                <div className="space-y-2">
                    <Badge className="bg-pink-500/20 text-pink-400 border-none">İçerik Üreticileri İçin</Badge>
                    <h1 className="text-5xl font-headline font-bold tracking-tighter text-pink-400">Nasıl Kazanç Sağlarım?</h1>
                    <p className="text-xl text-muted-foreground">Unverse AI ekosisteminde içerik üreterek ve topluluğunuzu büyüterek nasıl gelir elde edebileceğinizi keşfedin.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="glass-card border-pink-500/20 bg-pink-500/5">
                    <CardHeader className="text-center">
                        <div className="p-3 bg-pink-500/20 rounded-2xl w-fit mx-auto mb-2"><Users className="text-pink-400" /></div>
                        <CardTitle className="text-lg">Abonelikler</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-3xl font-bold font-headline text-pink-400">%85 <span className="text-sm font-normal opacity-50">Sizin</span></p>
                        <p className="text-xs text-muted-foreground mt-2">Aylık USDT abonelik gelirlerinizin %85'i anında bakiyenize eklenir.</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-yellow-500/20 bg-yellow-500/5">
                    <CardHeader className="text-center">
                        <div className="p-3 bg-yellow-500/20 rounded-2xl w-fit mx-auto mb-2"><Zap className="text-yellow-400" /></div>
                        <CardTitle className="text-lg">Premium Unlock</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-3xl font-bold font-headline text-yellow-400">%85 <span className="text-sm font-normal opacity-50">Sizin</span></p>
                        <p className="text-xs text-muted-foreground mt-2">Özel içeriklerinizi açan kullanıcılardan gelen ULC'lerin %85'i hesabınıza geçer.</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-blue-500/20 bg-blue-500/5">
                    <CardHeader className="text-center">
                        <div className="p-3 bg-blue-500/20 rounded-2xl w-fit mx-auto mb-2"><Heart className="text-blue-400" /></div>
                        <CardTitle className="text-lg">Bahşişler</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-3xl font-bold font-headline text-blue-400">%100 <span className="text-sm font-normal opacity-50">Sizin</span></p>
                        <p className="text-xs text-muted-foreground mt-2">Takipçilerinizden gelen ULC bahşişleri kesintisiz olarak size ulaşır.</p>
                    </CardContent>
                </Card>
            </div>

            <section className="space-y-10">
                <div className="flex flex-col md:flex-row items-center gap-8 bg-white/5 p-8 rounded-3xl border border-white/10">
                    <div className="flex-1 space-y-4">
                        <h3 className="text-2xl font-headline font-bold flex items-center gap-2">
                             <Sparkles className="text-pink-400" /> AI Studio ile Üretin
                        </h3>
                        <p className="text-muted-foreground">
                            Kendi AI Karakterinizi yaratın veya AI Studio araçlarını kullanarak saniyeler içinde büyüleyici görseller oluşturun. 
                            Hazırladığınız her içerik size ömür boyu pasif gelir getirebilir.
                        </p>
                        <div className="flex items-center gap-4">
                            <Badge variant="outline" className="border-pink-500/30 text-pink-400">Görsel Oluşturma: 3 ULC</Badge>
                            <Badge variant="outline" className="border-blue-500/30 text-blue-400">Erişim: Sınırsız</Badge>
                        </div>
                    </div>
                    <div className="w-full md:w-48 aspect-square bg-gradient-to-br from-pink-500/20 to-blue-500/20 rounded-2xl border border-white/10 flex items-center justify-center">
                         <MessageSquare className="w-12 h-12 text-pink-400 opacity-50" />
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-2xl font-headline font-bold">Nasıl Başlanır?</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { step: "01", title: "Profilini Oluştur", desc: "Cüzdanını bağla ve üretici profilini dakikalar içinde hazırla." },
                            { step: "02", title: "İçerik Paylaş", desc: "AI Studio veya kendi tasarımlarınla topluluğunu etkile." },
                            { step: "03", title: "Abone Kazan", desc: "USDT cinsinden aylık abonelik ücretini belirle ve kazanmaya başla." },
                            { step: "04", title: "Gelirini Çek", desc: "Bakiyendeki USDT'leri istediğin zaman cüzdanına çek." }
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
                 <h3 className="text-3xl font-headline font-bold">Hayal Gücünü Gelire Dönüştür.</h3>
                 <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                    Unverse AI, içerik üreticilerinin emeğini en adil şekilde ödüllendiren SocialFi platformudur. 
                    Oranlar sabittir, ödemeler anlıktır.
                 </p>
                 <Link href="/">
                    <Button className="h-14 px-10 rounded-2xl text-lg font-bold bg-pink-500 hover:bg-pink-600 shadow-xl shadow-pink-500/20">
                        Hemen Başla
                    </Button>
                 </Link>
            </Card>
        </div>
    );
}
