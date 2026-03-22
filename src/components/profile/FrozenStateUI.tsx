'use client';

import { ShieldAlert, Home, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function FrozenStateUI({ username }: { username: string }) {
    const t = useTranslations('Moderation');
    
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="relative group mb-8">
                <div className="absolute -inset-4 bg-red-500/20 blur-2xl rounded-full opacity-50 group-hover:opacity-80 transition-opacity" />
                <div className="relative w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20 shadow-2xl">
                    <ShieldAlert className="w-12 h-12 text-red-500" />
                </div>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
                <h1 className="text-4xl font-headline font-bold tracking-tight">@{username}</h1>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-widest">
                    HESAP ASKIYA ALINDI
                </div>
                
                <p className="text-muted-foreground leading-relaxed pt-2">
                    Bu hesap topluluk kurallarımızı ihlal ettiği veya dondurulduğu için içeriği şu anda erişilebilir değil. 
                </p>

                <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href="/">
                        <Button className="h-12 px-8 rounded-2xl font-bold gap-2">
                            <Home className="w-4 h-4" /> Keşfet'e Dön
                        </Button>
                    </Link>
                    <Link href="/support">
                        <Button variant="outline" className="h-12 px-8 rounded-2xl border-white/10 hover:bg-white/5 font-bold">
                            Destek Merkezi
                        </Button>
                    </Link>
                </div>
            </div>

            <p className="mt-12 text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-bold opacity-30">
                UNVERSE PROTOCOL // MODERATION LAYER ACTIVE
            </p>
        </div>
    );
}
