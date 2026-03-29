"use client"

import { FreeArtGenerator } from '@/components/creator/FreeArtGenerator';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function FreeArtPage() {
    const t = useTranslations('AIStudio');
    
    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12 px-4 mt-6">
            <header className="flex items-center gap-4 border-b pb-10 border-white/10">
                <Link href="/creator">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-full bg-white/5 shrink-0"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-4xl font-headline font-bold gradient-text tracking-tighter">{t("tabFreeArt")}</h1>
                    <p className="text-muted-foreground text-sm font-medium mt-1">{t("freeArtDesc")}</p>
                </div>
            </header>
            
            <FreeArtGenerator />
        </div>
    );
}
