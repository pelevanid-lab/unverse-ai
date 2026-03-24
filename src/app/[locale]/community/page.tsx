'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, query, collection, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/hooks/use-wallet';
import { 
    Loader2, 
    MessageSquare, 
    Send, 
    Instagram, 
    Play, 
    ArrowRight, 
    Github, 
    FileText, 
    Milestone, 
    Plus, 
    ChevronLeft, 
    User,
    Check,
    Lock,
    ShieldCheck,
    TrendingUp,
    Presentation,
    Users as UsersIcon
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { createTopicAction, postReplyAction, ForumTopic, ForumReply } from '@/lib/forum';
import { RoadmapOverlay } from '@/components/community/RoadmapOverlay';
import { WhitepaperOverlay } from '@/components/community/WhitepaperOverlay';
import { PresentationOverlay } from '@/components/community/PresentationOverlay';

const XIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.17l4.715 6.227L18.244 2.25zM16.083 19.77h1.833L7.084 4.126H5.117L16.083 19.77z"></path>
    </svg>
);

export default function CommunityPage() {
    const t = useTranslations('Community');
    const { isConnected, walletAddress } = useWallet();
    
    const [config, setConfig] = useState<any>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<ForumTopic | null>(null);
    const [topics, setTopics] = useState<ForumTopic[]>([]);
    const [replies, setReplies] = useState<ForumReply[]>([]);
    const [isCreatingTopic, setIsCreatingTopic] = useState(false);
    const [newTopicData, setNewTopicData] = useState({ title: '', content: '' });
    const [newReplyContent, setNewReplyContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showRoadmap, setShowRoadmap] = useState(false);
    const [showWhitepaper, setShowWhitepaper] = useState(false);
    const [presentationType, setPresentationType] = useState<'investor' | 'creator' | null>(null);

    useEffect(() => {
        // Fetch Community Config & Socials
        const unsubConfig = onSnapshot(doc(db, 'config', 'community'), (doc) => {
            if (doc.exists()) setConfig(doc.data());
            setLoading(false);
        });

        // Mock Categories for navigation (UI structure)
        setCategories([
            { id: 'general', title: 'General Discussion', desc: 'Talk about anything Unity.' },
            { id: 'creators', title: 'Unity Creator Hub', desc: 'Tips, tricks and collaborations.' },
            { id: 'investors', title: 'Unity Investor Lounge', desc: 'Tokenomics and roadmap talk.' },
            { id: 'support', title: 'Technical Support', desc: 'Need help? Ask here.' },
        ]);

        return () => unsubConfig();
    }, []);

    // Fetch Topics when category changes
    useEffect(() => {
        if (!selectedCategory) return;
        
        const q = query(
            collection(db, 'forum_topics'),
            where('categoryId', '==', selectedCategory),
            where('status', '==', 'active'),
            orderBy('lastReplyAt', 'desc'),
            limit(20)
        );

        const unsub = onSnapshot(q, (snap) => {
            setTopics(snap.docs.map(d => ({ id: d.id, ...d.data() } as ForumTopic)));
        });

        return () => unsub();
    }, [selectedCategory]);

    // Fetch Replies when topic changes
    useEffect(() => {
        if (!selectedTopic?.id) return;

        const q = query(
            collection(db, 'forum_replies'),
            where('topicId', '==', selectedTopic.id),
            orderBy('createdAt', 'asc')
        );

        const unsub = onSnapshot(q, (snap) => {
            setReplies(snap.docs.map(d => ({ id: d.id, ...d.data() } as ForumReply)));
        });

        return () => unsub();
    }, [selectedTopic]);

    const handleCreateTopic = async () => {
        if (!walletAddress || !selectedCategory) return;
        setIsSubmitting(true);
        try {
            await createTopicAction({
                title: newTopicData.title,
                content: newTopicData.content,
                authorId: walletAddress,
                authorName: 'User ' + walletAddress.slice(0, 6),
                categoryId: selectedCategory
            });
            setIsCreatingTopic(false);
            setNewTopicData({ title: '', content: '' });
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePostReply = async () => {
        if (!walletAddress || !selectedTopic?.id) return;
        setIsSubmitting(true);
        try {
            await postReplyAction({
                topicId: selectedTopic.id,
                content: newReplyContent,
                authorId: walletAddress,
                authorName: 'User ' + walletAddress.slice(0, 6)
            });
            setNewReplyContent('');
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const socialLinks = [
        { name: 'X', icon: <XIcon className="w-5 h-5"/>, url: config?.twitterUrl, color: 'hover:text-white' },
        { name: 'Telegram', icon: <Send className="w-5 h-5"/>, url: config?.telegramUrl, color: 'hover:text-sky-400' },
        { name: 'Instagram', icon: <Instagram className="w-5 h-5"/>, url: config?.instagramUrl, color: 'hover:text-pink-400' },
        { name: 'GitHub', icon: <Github className="w-5 h-5"/>, url: config?.gitUrl, color: 'hover:text-white' },
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
                    Official Unity Hub
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

            {/* 2. STRATEGIC RESOURCES (ROADMAP & WHITEPAPER) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 scroll-mt-24" id="roadmap">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <Card className="glass-card group overflow-hidden border-blue-500/20 hover:border-blue-500/40 transition-all cursor-pointer relative bg-blue-500/5">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-30 transition-opacity">
                            <Milestone className="w-32 h-32 text-blue-400" />
                        </div>
                        <CardHeader className="pb-2">
                            <Badge className="w-fit mb-2 bg-blue-500/20 text-blue-400 border-none px-3 py-1 text-[10px] tracking-widest uppercase">Strategic Vision</Badge>
                            <CardTitle className="text-3xl font-headline font-bold">{t('roadmapTitle')}</CardTitle>
                            <CardDescription className="text-white/40 leading-relaxed text-sm">
                                Explore our 4-phase journey to the Base Mainnet launch and ecosystem maturity.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="space-y-2 opacity-60">
                                <div className="flex items-center gap-2 text-xs font-bold text-blue-400"><Check className="w-3 h-3"/> PHASE 0: FOUNDATIONS</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-white"><Play className="w-3 h-3 text-yellow-400 animate-pulse"/> PHASE 1: GENESIS ERA</div>
                                <div className="flex items-center gap-2 text-xs font-bold opacity-40">PHASE 2: EXPANSION & GROWTH</div>
                            </div>
                            <Button 
                                onClick={() => setShowRoadmap(true)}
                                className="w-full h-14 bg-blue-600 hover:bg-blue-700 font-bold gap-3 group"
                            >
                                <FileText className="w-4 h-4"/> VIEW DETAILED ROADMAP
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform"/>
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <Card 
                        onClick={() => setShowWhitepaper(true)}
                        className="glass-card group overflow-hidden border-yellow-400/10 hover:border-yellow-400/40 transition-all cursor-pointer relative bg-yellow-400/5"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-30 transition-opacity">
                            <FileText className="w-32 h-32 text-yellow-400" />
                        </div>
                        <CardHeader className="pb-2">
                            <Badge className="w-fit mb-2 bg-yellow-400/20 text-yellow-400 border-none px-3 py-1 text-[10px] tracking-widest uppercase">Technical Document</Badge>
                            <CardTitle className="text-3xl font-headline font-bold">{t('whitepaperTitle')}</CardTitle>
                            <CardDescription className="text-white/40 leading-relaxed text-sm">
                                {t('whitepaperDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="space-y-2 opacity-60">
                                <div className="flex items-center gap-2 text-xs font-bold text-white"><ShieldCheck className="w-3 h-3 text-emerald-400"/> CORE ARCHITECTURE</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-white"><TrendingUp className="w-3 h-3 text-primary"/> ECONOMIC FLYWHEEL</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-white"><Lock className="w-3 h-3 text-blue-400"/> VESTING SCHEDULE</div>
                            </div>
                            <Button className="w-full h-14 bg-yellow-400 text-black font-bold gap-3 group">
                                <FileText className="w-4 h-4"/> {t('readWhitepaper')}
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform"/>
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            </section>

            {/* 2.5 PRESENTATIONS (RE-ADDED) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 scroll-mt-24">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <Card 
                        className="glass-card group overflow-hidden border-blue-500/10 hover:border-blue-500/40 transition-all cursor-pointer relative bg-blue-500/2"
                        onClick={() => setPresentationType('investor')}
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-30 transition-opacity">
                            <ShieldCheck className="w-24 h-24 text-blue-400" />
                        </div>
                        <CardHeader className="pb-2">
                            <Badge className="w-fit mb-2 bg-blue-500/20 text-blue-400 border-none px-3 py-1 text-[8px] tracking-widest uppercase font-bold">Investor Deck</Badge>
                            <CardTitle className="text-2xl font-headline font-bold">{t('investorTitle')}</CardTitle>
                            <CardDescription className="text-white/40 leading-relaxed text-xs">
                                {t('investorDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-3 group text-xs">
                                <Play className="w-3 h-3 fill-current"/> {t('exploreInvestor')}
                                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform"/>
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card 
                        className="glass-card group overflow-hidden border-yellow-400/5 hover:border-yellow-400/40 transition-all cursor-pointer relative bg-yellow-400/2"
                        onClick={() => setPresentationType('creator')}
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-30 transition-opacity">
                            <UsersIcon className="w-24 h-24 text-yellow-400" />
                        </div>
                        <CardHeader className="pb-2">
                            <Badge className="w-fit mb-2 bg-yellow-400/20 text-yellow-400 border-none px-3 py-1 text-[8px] tracking-widest uppercase font-bold">Creator Guide</Badge>
                            <CardTitle className="text-2xl font-headline font-bold">{t('creatorTitle')}</CardTitle>
                            <CardDescription className="text-white/40 leading-relaxed text-xs">
                                {t('creatorDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <Button className="w-full h-12 bg-yellow-400 hover:bg-yellow-500 text-black font-bold gap-3 group text-xs">
                                <UsersIcon className="w-3 h-3"/> {t('viewCreator')}
                                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform"/>
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            </section>

            {/* 3. LIVE FORUM */}
            <section className="space-y-6">
                <AnimatePresence mode="wait">
                    {!selectedCategory ? (
                        <motion.div 
                            key="categories"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-3xl font-headline font-bold text-white">{t('forum')}</h2>
                                    <p className="text-white/40 text-sm">{t('forumDesc')}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {categories.map((cat) => (
                                    <Card 
                                        key={cat.id} 
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className="glass-card bg-white/2 hover:bg-white/5 border-white/5 hover:border-white/10 transition-all cursor-pointer group"
                                    >
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
                                                <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ArrowRight className="w-5 h-5"/>
                                                </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </motion.div>
                    ) : !selectedTopic ? (
                        <motion.div 
                            key="topics"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="flex items-center justify-between">
                                <Button variant="ghost" className="gap-2 text-white/50 hover:text-white" onClick={() => setSelectedCategory(null)}>
                                    <ChevronLeft className="w-4 h-4"/> Back to Forums
                                </Button>
                                <Button 
                                    onClick={() => isConnected ? setIsCreatingTopic(true) : alert(t('connectToPost'))}
                                    className="bg-yellow-400 text-black font-bold gap-2"
                                >
                                    <Plus className="w-4 h-4"/> {t('newTopic')}
                                </Button>
                            </div>
                            
                            <div className="space-y-2">
                                {topics.length === 0 ? (
                                    <div className="p-20 text-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
                                        {t('noTopics')}
                                    </div>
                                ) : (
                                    topics.map(topic => (
                                        <Card 
                                            key={topic.id} 
                                            onClick={() => setSelectedTopic(topic)}
                                            className="glass-card hover:bg-white/5 transition-all cursor-pointer border-white/5"
                                        >
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden">
                                                        <User className="w-6 h-6 text-white/20"/>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white">{topic.title}</h4>
                                                        <p className="text-[10px] opacity-40 uppercase tracking-widest">by {topic.authorName} // {new Date(topic.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="secondary" className="bg-white/5 text-[10px] font-bold">{topic.replyCount} {t('replies')}</Badge>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="topic-detail"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="space-y-6"
                        >
                            <Button variant="ghost" className="gap-2 text-white/50 hover:text-white" onClick={() => setSelectedTopic(null)}>
                                <ChevronLeft className="w-4 h-4"/> Back to Topics
                            </Button>

                            <Card className="glass-card p-6 border-yellow-400/20">
                                <h3 className="text-2xl font-bold mb-4">{selectedTopic.title}</h3>
                                <p className="text-white/60 leading-relaxed whitespace-pre-wrap">{selectedTopic.content}</p>
                                <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-yellow-400 text-black flex items-center justify-center font-bold text-[10px]">AUTH</div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">{selectedTopic.authorName}</p>
                                    </div>
                                    <p className="text-[10px] opacity-30 font-bold uppercase">{new Date(selectedTopic.createdAt?.seconds * 1000).toLocaleString()}</p>
                                </div>
                            </Card>

                            <div className="space-y-4 pl-6 border-l-2 border-white/5">
                                {replies.map(reply => (
                                    <Card key={reply.id} className="glass-card p-4 bg-white/2 border-white/5">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-bold uppercase text-white/40">{reply.authorName}</p>
                                            <p className="text-[9px] opacity-20">{new Date(reply.createdAt?.seconds * 1000).toLocaleString()}</p>
                                        </div>
                                        <p className="text-sm text-white/80">{reply.content}</p>
                                    </Card>
                                ))}

                                {isConnected ? (
                                    <div className="pt-4 space-y-4">
                                        <textarea 
                                            value={newReplyContent}
                                            onChange={(e) => setNewReplyContent(e.target.value)}
                                            placeholder="Write your reply..."
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm h-32 focus:ring-1 focus:ring-yellow-400 focus:outline-none transition-all"
                                        />
                                        <Button 
                                            onClick={handlePostReply}
                                            disabled={isSubmitting || !newReplyContent.trim()}
                                            className="bg-yellow-400 text-black font-bold h-12 px-8 rounded-xl"
                                        >
                                            {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Send className="w-4 h-4 mr-2"/>} {t('postReply')}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="p-6 text-center bg-white/2 border border-white/5 rounded-2xl opacity-40">
                                        {t('connectToPost')}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>

            {/* New Topic Modal */}
            <AnimatePresence>
                {isCreatingTopic && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            onClick={() => setIsCreatingTopic(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative w-full max-w-xl glass-card bg-[#0a0a0a] border-yellow-400/30 p-8 space-y-6"
                        >
                            <h3 className="text-2xl font-bold font-headline">{t('createTopicTitle')}</h3>
                            <div className="space-y-4">
                                <input 
                                    value={newTopicData.title}
                                    onChange={(e) => setNewTopicData({...newTopicData, title: e.target.value})}
                                    placeholder={t('topicTitlePlaceholder')}
                                    className="w-full bg-white/5 border border-white/10 h-14 rounded-xl px-4 text-lg focus:ring-1 focus:ring-yellow-400 transition-all font-bold"
                                />
                                <textarea 
                                    value={newTopicData.content}
                                    onChange={(e) => setNewTopicData({...newTopicData, content: e.target.value})}
                                    placeholder={t('topicContentPlaceholder')}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm h-48 focus:ring-1 focus:ring-yellow-400 focus:outline-none transition-all"
                                />
                                <div className="flex gap-4">
                                    <Button 
                                        onClick={() => setIsCreatingTopic(false)}
                                        variant="ghost" 
                                        className="h-14 flex-1 font-bold"
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        onClick={handleCreateTopic}
                                        disabled={isSubmitting || !newTopicData.title.trim() || !newTopicData.content.trim()}
                                        className="h-14 flex-1 bg-yellow-400 text-black font-bold"
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin"/> : t('submitTopic')}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Overlays */}
            <RoadmapOverlay 
                isOpen={showRoadmap} 
                onClose={() => setShowRoadmap(false)} 
            />
            <WhitepaperOverlay
                isOpen={showWhitepaper}
                onClose={() => setShowWhitepaper(false)}
            />
            <PresentationOverlay
                isOpen={!!presentationType}
                onClose={() => setPresentationType(null)}
                type={presentationType as 'investor' | 'creator'}
            />

            {/* Footer Tag */}
            <div className="text-center pt-10">
                <p className="text-[10px] uppercase tracking-[0.4em] opacity-20 font-bold">Unverse Unity Platform // Beta v1.0</p>
            </div>
        </div>
    );
}
