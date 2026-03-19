
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ContainerTab } from './ContainerTab';
import { AIStudioTab } from './AIStudioTab';
import { PublishContentsTab } from './PublishContentsTab';
import { CreatorInbox } from './CreatorInbox';
import { PromoCardTab } from './PromoCardTab';

const tabs = [
    { id: 'container', name: 'Container' },
    { id: 'ai-studio', name: 'AI Studio' },
    { id: 'published', name: 'Published' },
    { id: 'promo', name: 'Promo Card' },
    { id: 'messages', name: 'Messages' },
];

export function CreatorTabs() {
    const [activeTab, setActiveTab] = useState('container');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-center bg-black/20 p-1 rounded-full max-w-2xl mx-auto overflow-x-auto custom-scrollbar">
                {tabs.map(tab => (
                    <Button 
                        key={tab.id}
                        variant={activeTab === tab.id ? 'primary' : 'ghost'}
                        onClick={() => setActiveTab(tab.id)}
                        className={`rounded-full transition-all duration-300 px-6 shrink-0 ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : ''}`}
                    >
                        {tab.name}
                    </Button>
                ))}
            </div>

            <div className="animate-in fade-in duration-500">
                {activeTab === 'container' && <ContainerTab />}
                {activeTab === 'ai-studio' && <AIStudioTab />}
                {activeTab === 'published' && <PublishContentsTab />}
                {activeTab === 'promo' && <PromoCardTab />}
                {activeTab === 'messages' && <CreatorInbox />}
            </div>
        </div>
    );
}
