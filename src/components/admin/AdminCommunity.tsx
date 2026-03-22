
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, limit, increment } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Plus, Trash2, ExternalLink, Award, TrendingUp, Users, Flame, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserProfile, SystemConfig } from '@/lib/types';

export default function AdminCommunity() {
    const { toast } = useToast();
    const [loading, setLoading] = useState<string | null>(null);
    const [config, setConfig] = useState<any>(null);
    const [presentations, setPresentations] = useState<any>({ investor: [], creator: [] });
    const [creators, setCreators] = useState<UserProfile[]>([]);
    const [stats, setStats] = useState({
        totalUnlocks: 0,
        totalRevenue: 0,
        totalBurned: 0,
        activeCreators: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading('all');
        try {
            // 1. Fetch Community Config
            const configSnap = await getDoc(doc(db, 'config', 'community'));
            if (configSnap.exists()) setConfig(configSnap.data());
            else {
                // Initialize default config if missing
                const defaultCommunity = {
                    telegramUrl: "", twitterUrl: "", instagramUrl: "",
                    investorPresentationUrl: "/en/presentations/investor",
                    creatorPresentationUrl: "/en/presentations/creator",
                    forumCategories: ["General", "Updates", "Support"]
                };
                setConfig(defaultCommunity);
            }

            // 2. Fetch Presentations
            const invSnap = await getDoc(doc(db, 'presentations', 'investor'));
            const creSnap = await getDoc(doc(db, 'presentations', 'creator'));
            setPresentations({
                investor: invSnap.exists() ? invSnap.data().slides : [],
                creator: creSnap.exists() ? creSnap.data().slides : []
            });

            // 3. Fetch Program Creators
            const q = query(collection(db, 'users'), where('creatorInFirst100Program', '==', true));
            const userSnaps = await getDocs(q);
            const creatorsList = userSnaps.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
            setCreators(creatorsList);

            // 4. Fetch Global Stats (Simplified from system config)
            const sysSnap = await getDoc(doc(db, 'config', 'system'));
            const sysData = sysSnap.data();
            setStats({
                totalUnlocks: (creatorsList.reduce((acc, curr) => acc + (curr.totalUniquePremiumUnlocks || 0), 0)),
                totalRevenue: sysData?.totalTreasuryUSDT || 0,
                totalBurned: 0, // In real app, fetch from stats doc
                activeCreators: creatorsList.length
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
            toast({ title: "Community Settings Updated" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Save Failed" });
        } finally {
            setLoading(null);
        }
    };

    const saveSlides = async (type: 'investor' | 'creator') => {
        setLoading(type);
        try {
            await setDoc(doc(db, 'presentations', type), { slides: presentations[type] });
            toast({ title: `${type.toUpperCase()} Presentation Updated` });
        } catch (e) {
            toast({ variant: 'destructive', title: "Save Failed" });
        } finally {
            setLoading(null);
        }
    };

    const addSlide = (type: 'investor' | 'creator') => {
        const newSlide = { order: presentations[type].length + 1, title: "New Slide", subtitle: "", bullets: [] };
        setPresentations({ ...presentations, [type]: [...presentations[type], newSlide] });
    };

    const updateSlide = (type: 'investor' | 'creator', index: number, field: string, value: any) => {
        const updated = [...presentations[type]];
        updated[index] = { ...updated[index], [field]: value };
        setPresentations({ ...presentations, [type]: updated });
    };

    const removeSlide = (type: 'investor' | 'creator', index: number) => {
        const updated = presentations[type].filter((_: any, i: number) => i !== index);
        setPresentations({ ...presentations, [type]: updated });
    };

    const toggleFeatured = async (user: UserProfile) => {
        const newStatus = !user.featured;
        try {
            await updateDoc(doc(db, 'users', user.uid), { featured: newStatus });
            setCreators(creators.map(c => c.uid === user.uid ? { ...c, featured: newStatus } : c));
            toast({ title: `Creator ${newStatus ? 'Featured' : 'Unfeatured'}` });
        } catch (e) {
            toast({ variant: 'destructive', title: "Update Failed" });
        }
    };

    if (loading === 'all') return <div className="flex justify-center p-20"><Loader2 className="animate-spin w-10 h-10 opacity-20"/></div>;

    return (
        <div className="space-y-8 pb-20">
            {/* 1. Analytics & Pools Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="glass-card bg-blue-500/5 border-blue-500/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold text-blue-400">Total Unlocks</CardDescription>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <TrendingUp className="w-5 h-5"/> {stats.totalUnlocks}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="glass-card bg-green-500/5 border-green-500/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold text-green-400">Platform Revenue</CardDescription>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <DollarSign className="w-5 h-5"/> ${stats.totalRevenue.toFixed(2)}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="glass-card bg-red-500/5 border-red-500/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold text-red-400">ULC Burned</CardDescription>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <Flame className="w-5 h-5"/> {stats.totalBurned.toFixed(0)}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="glass-card bg-purple-500/5 border-purple-500/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold text-purple-400">Active Creators</CardDescription>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <Users className="w-5 h-5"/> {stats.activeCreators}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Tabs defaultValue="socials" className="w-full">
                <TabsList className="bg-white/5 border border-white/10 p-1 mb-6">
                    <TabsTrigger value="socials">Socials & Config</TabsTrigger>
                    <TabsTrigger value="presentations">Presentations</TabsTrigger>
                    <TabsTrigger value="creators">Creator Management</TabsTrigger>
                </TabsList>

                {/* SOCIALS & CONFIG */}
                <TabsContent value="socials">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle>Community & Link Configuration</CardTitle>
                            <CardDescription>Update global social links and presentation entry points.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs opacity-50 uppercase font-bold">X (Twitter) URL</label>
                                    <Input value={config?.twitterUrl} onChange={(e) => setConfig({...config, twitterUrl: e.target.value})} className="bg-white/5 border-white/10 h-12" placeholder="https://x.com/..."/>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs opacity-50 uppercase font-bold">Telegram URL</label>
                                    <Input value={config?.telegramUrl} onChange={(e) => setConfig({...config, telegramUrl: e.target.value})} className="bg-white/5 border-white/10 h-12" placeholder="https://t.me/..."/>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs opacity-50 uppercase font-bold">Instagram URL</label>
                                    <Input value={config?.instagramUrl} onChange={(e) => setConfig({...config, instagramUrl: e.target.value})} className="bg-white/5 border-white/10 h-12" placeholder="https://instagram.com/..."/>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs opacity-50 uppercase font-bold">Investor Presentation URL</label>
                                    <Input value={config?.investorPresentationUrl} onChange={(e) => setConfig({...config, investorPresentationUrl: e.target.value})} className="bg-white/5 border-white/10 h-12"/>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs opacity-50 uppercase font-bold">Creator Presentation URL</label>
                                    <Input value={config?.creatorPresentationUrl} onChange={(e) => setConfig({...config, creatorPresentationUrl: e.target.value})} className="bg-white/5 border-white/10 h-12"/>
                                </div>
                            </div>
                            <Button onClick={saveConfig} disabled={loading === 'config'} className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-bold gap-2">
                                {loading === 'config' ? <Loader2 className="animate-spin w-4 h-4"/> : <><Save className="w-4 h-4"/> Save Community Settings</>}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* PRESENTATIONS EDITOR */}
                <TabsContent value="presentations">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {['investor', 'creator'].map((type: any) => (
                            <Card key={type} className="glass-card">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="capitalize">{type} Slides</CardTitle>
                                        <CardDescription>Dynamic slides for the {type} presentation.</CardDescription>
                                    </div>
                                    <Button onClick={() => addSlide(type)} size="sm" variant="outline" className="gap-1 border-white/20"><Plus className="w-3 h-3"/> Add Slide</Button>
                                </CardHeader>
                                <CardContent className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                    {presentations[type].map((slide: any, idx: number) => (
                                        <div key={idx} className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3 relative group">
                                            <Button onClick={() => removeSlide(type, idx)} size="icon" variant="ghost" className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 className="w-4 h-4"/>
                                            </Button>
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs">{slide.order}</div>
                                                <div className="flex-1 space-y-2">
                                                    <Input value={slide.title} onChange={(e) => updateSlide(type, idx, 'title', e.target.value)} className="bg-transparent border-white/20 font-bold" placeholder="Slide Title"/>
                                                    <Input value={slide.subtitle} onChange={(e) => updateSlide(type, idx, 'subtitle', e.target.value)} className="bg-transparent border-white/10 text-xs" placeholder="Slide Subtitle (Optional)"/>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <Button onClick={() => saveSlides(type)} disabled={loading === type} className="w-full mt-4 bg-purple-600 hover:bg-purple-700 font-bold gap-2">
                                        {loading === type ? <Loader2 className="animate-spin w-4 h-4"/> : <><Save className="w-4 h-4"/> Update {type.toUpperCase()} Slides</>}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* CREATOR MANAGEMENT */}
                <TabsContent value="creators">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle>First 100 Creator Program</CardTitle>
                            <CardDescription>Monitor progress and feature creators on the platform.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-white/10">
                                        <TableHead>Creator</TableHead>
                                        <TableHead>Unlocks</TableHead>
                                        <TableHead>Milestones</TableHead>
                                        <TableHead>Rewards</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {creators.map(c => (
                                        <TableRow key={c.uid} className="border-white/5">
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                                                        {c.avatar && <img src={c.avatar} alt={c.username} className="w-full h-full object-cover"/>}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold">{c.username}</p>
                                                        <p className="text-[10px] opacity-50 font-mono">{c.uid.slice(0, 10)}...</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">{c.totalUniquePremiumUnlocks || 0}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    {[1,2,3,4,5].map(m => (
                                                        <div key={m} className={`w-2 h-2 rounded-full ${(c.milestoneRewardCount || 0) >= m ? 'bg-green-500' : 'bg-white/10'}`}/>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-yellow-400">
                                                {c.totalMilestoneRewardULC || 0} ULC
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button onClick={() => toggleFeatured(c)} size="sm" variant={c.featured ? "default" : "outline"} className={c.featured ? "bg-yellow-400 text-black hover:bg-yellow-500" : "border-white/20 text-xs"}>
                                                    {c.featured ? <Award className="w-3 h-3 mr-1"/> : null}
                                                    {c.featured ? 'Featured' : 'Feature'}
                                                </Button>
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
