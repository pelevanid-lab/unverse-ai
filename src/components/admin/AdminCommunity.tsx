'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Plus, Trash2, ExternalLink, Award, TrendingUp, Users, Flame, DollarSign, Image as ImageIcon, Video, RotateCcw, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserProfile } from '@/lib/types';

export default function AdminCommunity() {
    const { toast } = useToast();
    const [loading, setLoading] = useState<string | null>(null);
    const [config, setConfig] = useState<any>(null);
    const [presentations, setPresentations] = useState<any>({ 
        investor: { title: "", subtitle: "", slides: [] }, 
        creator: { title: "", subtitle: "", slides: [] } 
    });
    const [creators, setCreators] = useState<UserProfile[]>([]);
    const [stats, setStats] = useState({
        totalUnlocks: 0,
        totalRevenue: 0,
        totalBurned: 0,
        activeCreators: 0
    });

    useEffect(() => {
        fetchData();
        
        // Real-time listener for v3 presentations
        const unsubInv = onSnapshot(doc(db, 'presentations', 'investor_v3'), (snap) => {
            if (snap.exists()) setPresentations((prev: any) => ({ ...prev, investor: snap.data() }));
        });
        const unsubCre = onSnapshot(doc(db, 'presentations', 'creator_v3'), (snap) => {
            if (snap.exists()) setPresentations((prev: any) => ({ ...prev, creator: snap.data() }));
        });

        return () => { unsubInv(); unsubCre(); };
    }, []);

    const fetchData = async () => {
        setLoading('all');
        try {
            // 1. Fetch Community Config
            const configSnap = await getDoc(doc(db, 'config', 'community'));
            if (configSnap.exists()) setConfig(configSnap.data());

            // 2. Fetch All Creators for global stats
            const allCreatorsSnap = await getDocs(query(collection(db, 'users'), where('isCreator', '==', true)));
            const allCreators = allCreatorsSnap.docs.map(d => d.data() as UserProfile);

            // 3. Fetch Program Creators for table
            const q = query(collection(db, 'users'), where('creatorInFirst100Program', '==', true));
            const userSnaps = await getDocs(q);
            const creatorsList = userSnaps.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
            setCreators(creatorsList);

            // 4. Fetch Global Stats
            const sysSnap = await getDoc(doc(db, 'config', 'system'));
            const sysData = sysSnap.data();
            
            // Fetch high-frequency stats
            const statsSnap = await getDoc(doc(db, 'config', 'stats'));
            const statsData = statsSnap.data();

            setStats({
                totalUnlocks: (allCreators.reduce((acc, curr) => acc + (curr.totalUniquePremiumUnlocks || 0), 0)),
                totalRevenue: sysData?.totalTreasuryUSDC || 0,
                totalBurned: statsData?.totalBurnedULC || 0,
                activeCreators: allCreators.length
            });

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(null);
        }
    };

    const saveConfig = async () => {
        setLoading('config');
        try {
            await setDoc(doc(db, 'config', 'community'), config);
            toast({ title: "Unity Settings Updated" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Save Failed" });
        } finally {
            setLoading(null);
        }
    };

    const saveSlides = async (type: 'investor' | 'creator') => {
        setLoading(type);
        try {
            const docId = `${type}_v3`;
            await setDoc(doc(db, 'presentations', docId), presentations[type]);
            toast({ title: `${type.toUpperCase()} Presentation Updated` });
        } catch (e) {
            toast({ variant: 'destructive', title: "Save Failed" });
        } finally {
            setLoading(null);
        }
    };

    const addSlide = (type: 'investor' | 'creator') => {
        const newSlide = { 
            id: Math.random().toString(36).substr(2, 9),
            order: presentations[type].slides.length + 1, 
            title: "New Slide", 
            slogan: "",
            description: "", 
            bullets: [],
            mediaUrl: "",
            mediaType: "image"
        };
        setPresentations({ 
            ...presentations, 
            [type]: { 
                ...presentations[type], 
                slides: [...presentations[type].slides, newSlide] 
            } 
        });
    };

    const updateSlide = (type: 'investor' | 'creator', index: number, field: string, value: any) => {
        const updatedSlides = [...presentations[type].slides];
        updatedSlides[index] = { ...updatedSlides[index], [field]: value };
        setPresentations({ 
            ...presentations, 
            [type]: { ...presentations[type], slides: updatedSlides } 
        });
    };

    const removeSlide = (type: 'investor' | 'creator', index: number) => {
        const updatedSlides = presentations[type].slides.filter((_: any, i: number) => i !== index);
        setPresentations({ 
            ...presentations, 
            [type]: { ...presentations[type], slides: updatedSlides } 
        });
    };

    const restoreDefaults = async (type: 'investor' | 'creator') => {
        if (!confirm(`Are you sure you want to restore ${type} defaults to the latest v3 draft?`)) return;
        
        const defaults: any = {
            investor: {
                title: "Unverse AI",
                subtitle: "The Future of Creator Economy",
                slides: [
                    { id: "inv-1", order: 1, title: "The Future of Creator Economy", slogan: "We combine creativity with financial freedom.", description: "Traditional platforms exploit creators. Unverse makes creators owners.", bullets: [] },
                    { id: "inv-2", order: 2, title: "M-Floor Protocol", slogan: "Protocol Security", description: "Dynamic price floor targeting 15M USDC ecosystem value.", bullets: ["Burn reduces supply", "Floor increases automatically", "Treasury-backed stability"] },
                    { id: "inv-3", order: 3, title: "Deflation Engine", slogan: "Token Scarcity", description: "Every action reduces supply.", bullets: ["AI generation burns tokens", "Unlocks burn tokens", "Perfect edits burn tokens"] },
                    { id: "inv-4", order: 4, title: "Treasury & Buyback", slogan: "Value Growth", description: "33% of platform revenue goes to buyback pool.", bullets: ["Continuous support", "Revenue-backed economy"] },
                    { id: "inv-5", order: 5, title: "Go-To-Market", slogan: "Global Expansion", description: "Strategic listing and launch roadmap.", bullets: ["3-phase presale", "Base network launch", "CEX listing strategy"] },
                    { id: "inv-6", order: 6, title: "Seal & Token Security", slogan: "Immutable Economy", description: "Supply is permanently fixed.", bullets: ["No minting possible", "20-year vesting protection"] }
                ]
            },
            creator: {
                title: "Create. Monetize. Scale.",
                subtitle: "AI Powered Creator Economy",
                slides: [
                    { id: "cre-1", order: 1, title: "Elite Creator Program", slogan: "Join the Elite", description: "Only first 100 creators join the elite club.", bullets: ["milestone rewards", "exclusive benefits", "early advantage"] },
                    { id: "cre-2", order: 2, title: "AI Studio", slogan: "Limitless Creation", description: "No skills required. Just imagine.", bullets: ["instant content generation", "premium-ready visuals"] },
                    { id: "cre-3", order: 3, title: "85/15 Revenue Model", slogan: "Fair Earnings", description: "You earn instantly.", bullets: ["85% creator share", "no delays", "direct earnings"] },
                    { id: "cre-4", order: 4, title: "Unverse Copilot", slogan: "AI Premium", description: "Your AI manager.", bullets: ["content optimization", "trend analysis", "smart editing"] },
                    { id: "cre-5", order: 5, title: "Grow With the Platform", slogan: "Shared Success", description: "Your tokens grow as ecosystem grows.", bullets: ["vesting benefits", "long-term value"] }
                ]
            }
        };

        setPresentations({ ...presentations, [type]: defaults[type] });
        toast({ title: "Defaults Loaded. Click Save to apply to Firestore." });
    };

    if (loading === 'all') return <div className="flex justify-center p-20"><Loader2 className="animate-spin w-10 h-10 opacity-20"/></div>;

    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto px-4">
            {/* Analytics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: "Total Unlocks", value: stats.totalUnlocks, color: "blue", icon: TrendingUp },
                    { label: "Platform Revenue", value: `$${stats.totalRevenue.toFixed(2)}`, color: "green", icon: DollarSign },
                    { label: "ULC Burned", value: stats.totalBurned.toFixed(0), color: "red", icon: Flame },
                    { label: "Active Creators", value: stats.activeCreators, color: "purple", icon: Users },
                ].map((s, i) => (
                    <Card key={i} className={`glass-card bg-${s.color}-500/5 border-${s.color}-500/20`}>
                        <CardHeader className="pb-2">
                            <CardDescription className={`text-[10px] uppercase font-bold text-${s.color}-400`}>{s.label}</CardDescription>
                            <CardTitle className="text-2xl flex items-center gap-2">
                                <s.icon className="w-5 h-5"/> {s.value}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            <Tabs defaultValue="presentations" className="w-full">
                <TabsList className="bg-white/5 border border-white/10 p-1 mb-6">
                    <TabsTrigger value="socials">Socials & Config</TabsTrigger>
                    <TabsTrigger value="presentations">Presentations v3</TabsTrigger>
                    <TabsTrigger value="creators">Creator Management</TabsTrigger>
                </TabsList>

                {/* SOCIALS & CONFIG */}
                <TabsContent value="socials">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle>Unity Configuration</CardTitle>
                            <CardDescription>Social links and presentation entry points.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {['twitterUrl', 'telegramUrl', 'instagramUrl', 'gitUrl'].map(f => (
                                    <div key={f} className="space-y-2">
                                        <label className="text-xs opacity-50 uppercase font-bold">
                                            {f === 'twitterUrl' ? 'X / Twitter' : f === 'gitUrl' ? 'GitHub' : f.replace('Url', '')}
                                        </label>
                                        <Input value={config?.[f]} onChange={(e) => setConfig({...config, [f]: e.target.value})} className="bg-white/5 border-white/10 h-12"/>
                                    </div>
                                ))}
                            </div>
                            <Button onClick={saveConfig} disabled={loading === 'config'} className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-bold gap-2">
                                {loading === 'config' ? <Loader2 className="animate-spin w-4 h-4"/> : <><Save className="w-4 h-4"/> Save All</>}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* PRESENTATIONS v3 EDITOR */}
                <TabsContent value="presentations" className="space-y-8">
                    {['investor', 'creator'].map((type: any) => (
                        <div key={type} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold capitalize flex items-center gap-2">
                                    {type} Presentation
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold border-yellow-500/50 text-yellow-500">v3 Active</Badge>
                                </h2>
                                <div className="flex gap-2">
                                    <Button onClick={() => restoreDefaults(type)} variant="outline" size="sm" className="gap-2 text-xs border-white/10 hover:bg-white/5">
                                        <RotateCcw className="w-3 h-3"/> Restore v3 Defaults
                                    </Button>
                                    <Button onClick={() => addSlide(type)} size="sm" className="gap-2 bg-yellow-500 text-black hover:bg-yellow-600 font-bold">
                                        <Plus className="w-3 h-3"/> Add Slide
                                    </Button>
                                    <Button onClick={() => saveSlides(type)} disabled={loading === type} size="sm" className="gap-2 bg-purple-600 hover:bg-purple-700 font-bold px-6">
                                        {loading === type ? <Loader2 className="animate-spin w-3 h-3"/> : <><Save className="w-3 h-3"/> Save To Cloud</>}
                                    </Button>
                                </div>
                            </div>

                            <Card className="glass-card bg-black/40 border-white/5">
                                <CardContent className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold opacity-40">Main Title</label>
                                            <Input value={presentations[type].title} onChange={(e) => setPresentations({...presentations, [type]: {...presentations[type], title: e.target.value}})} className="bg-white/5 border-white/10 font-bold text-lg"/>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold opacity-40">Global Subtitle</label>
                                            <Input value={presentations[type].subtitle} onChange={(e) => setPresentations({...presentations, [type]: {...presentations[type], subtitle: e.target.value}})} className="bg-white/5 border-white/10"/>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {presentations[type].slides.map((slide: any, idx: number) => (
                                            <div key={slide.id || idx} className="group relative border border-white/5 bg-white/[0.02] rounded-2xl overflow-hidden hover:border-white/20 transition-all">
                                                <div className="flex">
                                                    {/* Drag Handle & Order */}
                                                    <div className="w-12 bg-white/5 flex flex-col items-center justify-center border-r border-white/5">
                                                        <GripVertical className="w-4 h-4 opacity-20 group-hover:opacity-40 mb-2"/>
                                                        <span className="text-[10px] font-bold opacity-30">#{slide.order}</span>
                                                    </div>

                                                    {/* Slide Content Multi-Field */}
                                                    <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                        <div className="space-y-4 lg:col-span-2">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-1">
                                                                    <label className="text-[8px] uppercase font-bold opacity-30">Slogan</label>
                                                                    <Input value={slide.slogan} onChange={(e) => updateSlide(type, idx, 'slogan', e.target.value)} placeholder="Quick slogan..." className="h-8 text-xs bg-white/5 border-white/5 text-yellow-500 font-bold"/>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-[8px] uppercase font-bold opacity-30">Title</label>
                                                                    <Input value={slide.title} onChange={(e) => updateSlide(type, idx, 'title', e.target.value)} className="h-8 font-bold bg-white/5 border-white/10"/>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[8px] uppercase font-bold opacity-30">Description</label>
                                                                <Textarea value={slide.description} onChange={(e) => updateSlide(type, idx, 'description', e.target.value)} className="bg-white/5 border-white/10 resize-none h-24 text-sm" placeholder="Detailed description..."/>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[8px] uppercase font-bold opacity-30">Bullets (Comma separated)</label>
                                                                <Input value={slide.bullets?.join(', ')} onChange={(e) => updateSlide(type, idx, 'bullets', e.target.value.split(',').map((b: string) => b.trim()).filter((b: string) => b !== ''))} className="bg-white/5 border-white/5 text-xs"/>
                                                            </div>
                                                        </div>

                                                        {/* Media Section */}
                                                        <div className="space-y-4 bg-white/5 p-4 rounded-xl border border-white/5">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[8px] uppercase font-bold opacity-40">Visual Content</label>
                                                                <Select value={slide.mediaType} onValueChange={(val) => updateSlide(type, idx, 'mediaType', val)}>
                                                                    <SelectTrigger className="w-[100px] h-6 text-[10px] bg-white/5 border-white/10">
                                                                        <SelectValue placeholder="Type"/>
                                                                    </SelectTrigger>
                                                                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                                                        <SelectItem value="image">Image</SelectItem>
                                                                        <SelectItem value="video">Video</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="relative aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center border border-white/10 group/media">
                                                                {slide.mediaUrl ? (
                                                                    slide.mediaType === 'video' ? 
                                                                    <video src={slide.mediaUrl} className="w-full h-full object-cover" /> :
                                                                    <img src={slide.mediaUrl} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="text-center">
                                                                        {slide.mediaType === 'video' ? <Video className="w-6 h-6 mx-auto opacity-20 mb-2"/> : <ImageIcon className="w-6 h-6 mx-auto opacity-20 mb-2"/>}
                                                                        <span className="text-[8px] opacity-20 uppercase">No Media Loaded</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <Input value={slide.mediaUrl} onChange={(e) => updateSlide(type, idx, 'mediaUrl', e.target.value)} placeholder="Media URL (HTTPS)..." className="h-8 text-[10px] bg-white/10 border-white/10 p-2"/>
                                                        </div>
                                                    </div>

                                                    {/* Delete Action */}
                                                    <Button onClick={() => removeSlide(type, idx)} variant="ghost" className="bg-red-500/0 hover:bg-red-500/20 text-red-500 rounded-none w-12 flex items-center justify-center border-l border-white/5">
                                                        <Trash2 className="w-4 h-4"/>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ))}
                </TabsContent>

                {/* CREATOR MANAGEMENT */}
                <TabsContent value="creators">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle>First 100 Program</CardTitle>
                            <CardDescription>Featured creators and rewards.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-white/10 hover:bg-transparent">
                                        <TableHead>Creator</TableHead>
                                        <TableHead>Unlocks</TableHead>
                                        <TableHead>Rewards</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {creators.map(c => (
                                        <TableRow key={c.uid} className="border-white/5 hover:bg-white/5">
                                            <TableCell className="font-bold flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center overflow-hidden border border-yellow-500/30">
                                                    {c.avatar ? <img src={c.avatar} className="w-full h-full object-cover"/> : <Users className="w-4 h-4 opacity-50"/>}
                                                </div>
                                                {c.username}
                                            </TableCell>
                                            <TableCell><Badge variant="outline">{c.totalUniquePremiumUnlocks || 0}</Badge></TableCell>
                                            <TableCell className="text-yellow-500 font-mono">{c.totalMilestoneRewardULC || 0} ULC</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="outline" className="text-xs border-white/10">View Profile</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
