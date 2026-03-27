
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ContainerTab } from './ContainerTab';
import { AIStudioTab } from './AIStudioTab';
import { CreatorInbox } from './CreatorInbox';
import { PromoCardTab } from './PromoCardTab';

import { useTranslations } from 'next-intl';

export function CreatorTabs() {
    const t = useTranslations('Creator');
    const [activeTab, setActiveTab] = useState('container');

    const tabs = [
        { id: 'container', name: t('containerTab'), icon: '📦' },
        { id: 'ai-studio', name: t('aiStudioTab'), icon: '✨' },
        { id: 'promo', name: t('promoCardTab'), icon: '🎴' },
        { id: 'messages', name: t('messagesTab'), icon: '💬' },
    ];

    return (
        <div className="space-y-8">
            {/* Motivational Header */}
            <div className="text-center space-y-2 mb-4 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary tracking-[0.2em] uppercase">
                    Protocol Phase: Scale
                </div>
                <h2 className="text-3xl md:text-5xl font-headline font-bold tracking-tight">
                    CREATE <span className="text-primary opacity-50">&gt;</span> EARN <span className="text-primary opacity-50">&gt;</span> SCALE
                </h2>
                <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                    Transform your imagination into a high-yielding digital empire with Uniq AI.
                </p>
            </div>

            <div className="flex items-center justify-center bg-black/20 p-1.5 rounded-[2rem] max-w-3xl mx-auto overflow-x-auto custom-scrollbar border border-white/5 shadow-2xl">
                {tabs.map(tab => (
                    <Button 
                        key={tab.id}
                        variant={activeTab === tab.id ? 'default' : 'ghost'}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "rounded-full transition-all duration-300 px-6 shrink-0 h-11 font-bold text-xs gap-2",
                            activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white'
                        )}
                    >
                        <span>{tab.icon}</span>
                        {tab.name}
                        {(tab as any).badge && (
                            <span className="bg-orange-600 text-[8px] px-1.5 py-0.5 rounded-sm font-black animate-pulse">
                                {(tab as any).badge}
                            </span>
                        )}
                    </Button>
                ))}
            </div>

            <div className="animate-in fade-in duration-500">
                {activeTab === 'container' && <ContainerTab />}
                {activeTab === 'ai-studio' && <AIStudioTab />}
                {activeTab === 'promo' && <PromoCardTab />}
                {activeTab === 'messages' && <CreatorInbox />}
            </div>
        </div>
    );
}
