"use client"

import { PromoCardTab } from '@/components/creator/PromoCardTab';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function PromoCardPage() {
    const t = useTranslations('Creator');
    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12 px-4 mt-6">
            <header className="flex items-center gap-4 border-b pb-6 border-white/10">
                <Link href="/creator">
                    <Button variant="outline">{t('backToDashboard')}</Button>
                </Link>
                <h1 className="text-3xl font-headline font-bold">{t('promoCardTab')}</h1>
            </header>
            <PromoCardTab />
        </div>
    );
}
