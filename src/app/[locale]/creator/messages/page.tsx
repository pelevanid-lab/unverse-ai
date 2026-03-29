"use client"

import { CreatorInbox } from '@/components/creator/CreatorInbox';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function MessagesPage() {
    const t = useTranslations('Creator');
    const router = useRouter(); // Added useRouter hook
    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12 px-4 mt-6">
            <header className="flex items-center gap-4 border-b pb-6 border-white/10">
                <Link href="/creator"> {/* Changed href to /creator */}
                    <Button variant="ghost" size="icon" onClick={() => router.push('/creator')} className="rounded-full bg-white/5">
                        <ChevronLeft className="h-5 w-5" /> {/* Added ChevronLeft icon */}
                    </Button>
                </Link>
                <h1 className="text-3xl font-headline font-bold">{t('messagesTab')}</h1>
            </header>
            <CreatorInbox />
        </div>
    );
}
