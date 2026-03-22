
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/hooks/use-wallet';
import { Loader2, MessageSquare, Twitter, Send, Instagram, Play, Users, Award, Shield, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

export default function CommunityPage() {
    const t = useTranslations('Community');
    const { isConnected, walletAddress } = useWallet();
    const [config, setConfig] = useState<any>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch Community Config & Socials
        const unsubConfig = onSnapshot(doc(db, 'config', 'community'), (doc) => {
            if (doc.exists()) setConfig(doc.data());
            setLoading(false);
        });

        // Mock Categories for now (or fetch if exists)
        setCategories([
            { id: 'general', title: 'General Discussion', desc: 'Talk about anything Unverse.', topics: 12, posts: 45 },
            { id: 'creators', title: 'Creator Hub', desc: 'Tips, tricks and collaborations.', topics: 8, posts: 24 },
            { id: 'investors', title: 'Investor Lounge', desc: 'Tokenomics and roadmap talk.', topics: 5, posts: 18 },
            { id: 'support', title: 'Technical Support', desc: 'Need help? Ask here.', topics: 15, posts: 60 },
        ]);

        return () => unsubConfig();
    }, []);

    const socialLinks = [
        { name: 'X / Twitter', icon: <Twitter className="w-5 h-5"/>, url: config?.twitterUrl, color: 'hover:text-blue-400' },
        { name: 'Telegram', icon: <Send className="w-5 h-5"/>, url: config?.telegramUrl, color: 'hover:text-sky-400' },
        { name: 'Instagram', icon: <Instagram className="w-5 h-5"/>, url: config?.instagramUrl, color: 'hover:text-pink-400' },
    ];

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin w-10 h-10 opacity-20"/></div>;

    return (
        <div className="max-w-6xl mx-auto px-4 py-12 space-y-16">
            
            {/* 1. HERO SECTION */}
            <section className="text-center space-y-6">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-block px-4 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-500 text-[10px] uppercase font-bold tracking-widest mb-4"
                >
                    Official Community Hub
                </motion.div>
                <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-5xl md:text-7xl font-headline font-bold text-white tracking-tight"
                >
                    {t('hero')}
                </motion.h1>
                <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-lg text-white/50 max-w-2xl mx-auto font-light leading-relaxed"
                >
                    {t('heroDesc')}
                </motion.p>
                
                {/* Social Icons Bar */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex justify-center items-center gap-8 pt-6"
                >
                    {socialLinks.map((social) => (
                        <a 
                            key={social.name} 
                            href={social.url || '#'} 
                            target="_blank" 
                            className={`flex items-center gap-2 text-white/40 transition-all font-bold group ${social.color}`}
                        >
                            <div className="p-3 rounded-full bg-white/5 border border-white/5 group-hover:bg-white/10 group-hover:border-white/20 transition-all">
                                {social.icon}
                            </div>
                            <span className="text-xs uppercase tracking-tighter hidden md:block">{social.name}</span>
                        </a>
                    ))}
                </motion.div>
            </section>

            {/* 2. PRESENTATION CARDS (INVESTOR & CREATOR) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <Card className="glass-card group overflow-hidden border-blue-500/20 hover:border-blue-500/40 transition-all cursor-pointer relative">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-30 transition-opacity">
                            <Shield className="w-32 h-32 text-blue-400" />
                        </div>
                        <CardHeader className="pb-2">
                            <Badge className="w-fit mb-2 bg-blue-500/20 text-blue-400 border-none px-3 py-1 text-[10px] tracking-widest uppercase">{t('investorDeck')}</Badge>
                            <CardTitle className="text-3xl font-headline font-bold">Unverse Strategy</CardTitle>
                            <CardDescription className="text-white/40 leading-relaxed text-sm">
                                {t('investorDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <Link href={config?.investorPresentationUrl || '#'}>
                                <Button className="w-full h-14 bg-blue-600 hover:bg-blue-700 font-bold gap-3 group">
                                    <Play className="w-4 h-4 fill-current"/> {t('exploreInvestor')}
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform"/>
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <Card className="glass-card group overflow-hidden border-yellow-500/20 hover:border-yellow-500/40 transition-all cursor-pointer relative">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-30 transition-opacity">
                            <Award className="w-32 h-32 text-yellow-400" />
                        </div>
                        <CardHeader className="pb-2">
                            <Badge className="w-fit mb-2 bg-yellow-400/20 text-yellow-500 border-none px-3 py-1 text-[10px] tracking-widest uppercase">{t('creatorDeck')}</Badge>
                            <CardTitle className="text-3xl font-headline font-bold">First 100 Program</CardTitle>
                            <CardDescription className="text-white/40 leading-relaxed text-sm">
                                {t('creatorDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <Link href={config?.creatorPresentationUrl || '#'}>
                                <Button className="w-full h-14 bg-yellow-400 text-black hover:bg-yellow-500 font-bold gap-3 group">
                                    <Users className="w-4 h-4 fill-current"/> {t('viewCreator')}
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform"/>
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </motion.div>
            </section>

            {/* 3. FORUM PREVIEW */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-headline font-bold text-white">{t('forum')}</h2>
                        <p className="text-white/40 text-sm">{t('forumDesc')}</p>
                    </div>
                    {!isConnected && (
                        <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] uppercase font-bold text-white/50 animate-pulse">
                            {t('connectToPost')}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {categories.map((cat) => (
                        <Card key={cat.id} className="glass-card bg-white/2 hover:bg-white/5 border-white/5 hover:border-white/10 transition-all cursor-pointer group">
                           <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 group-hover:bg-yellow-400/10 group-hover:border-yellow-400/20 transition-all">
                                        <MessageSquare className="w-6 h-6 text-white/50 group-hover:text-yellow-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors uppercase tracking-widest">{cat.title}</h3>
                                        <p className="text-sm text-white/40">{cat.desc}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-10 text-center">
                                    <div>
                                        <p className="text-xl font-bold text-white">{cat.topics}</p>
                                        <p className="text-[10px] uppercase opacity-40 font-bold tracking-tighter">{t('topics')}</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-white">{cat.posts}</p>
                                        <p className="text-[10px] uppercase opacity-40 font-bold tracking-tighter">{t('replies')}</p>
                                    </div>
                                    <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowRight className="w-5 h-5"/>
                                    </Button>
                                </div>
                           </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Footer Tag */}
            <div className="text-center pt-10">
                <p className="text-[10px] uppercase tracking-[0.4em] opacity-20 font-bold">Unverse Community Platform // Beta v1.0</p>
            </div>
        </div>
    );
}
