
"use client"

import { UserInbox } from '@/components/profile/UserInbox';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

function MessagesContent() {
    const t = useTranslations('MyPage');
    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12 px-4 mt-6">
            <header className="flex items-center gap-4 border-b pb-6 border-white/10">
                <Link href="/mypage">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-white/5">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-headline font-bold">{t('messages')}</h1>
            </header>
            <UserInbox />
        </div>
    );
}

export default function MessagesPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin w-10 h-10 text-primary" /></div>}>
            <MessagesContent />
        </Suspense>
    );
}
