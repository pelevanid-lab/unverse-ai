"use client"

import { PromoCardTab } from '@/components/creator/PromoCardTab';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function PromoCardPage() {
    const t = useTranslations('Creator');
    const router = useRouter(); // Initialized useRouter
    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12 px-4 mt-6">
            <header className="flex items-center gap-4 border-b pb-6 border-white/10">
                {/* Replaced Link with Button using onClick for navigation */}
                <Button variant="ghost" size="icon" onClick={() => router.push('/creator')} className="rounded-full bg-white/5 h-12 w-12 hover:bg-primary/20 transition-all">
                    <ChevronLeft className="h-6 w-6" /> {/* Added ChevronLeft icon */}
                </Button>
                <h1 className="text-3xl font-headline font-bold">{t('promoCardTab')}</h1>
            </header>
            <PromoCardTab />
        </div>
    );
}
