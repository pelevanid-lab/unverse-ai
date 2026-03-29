'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Plus, Trash2, ExternalLink, Award, TrendingUp, Users, Flame, DollarSign, Image as ImageIcon, Video, RotateCcw, GripVertical, UploadCloud, X as XIcon } from 'lucide-react';
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
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [dragOver, setDragOver] = useState<string | null>(null);

    const uploadSlideMedia = useCallback(async (file: File, type: string, idx: number) => {
        const key = `${type}-${idx}`;
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            toast({ variant: 'destructive', title: 'Unsupported file type', description: 'Please upload an image or video.' });
            return;
        }
        const ext = file.name.split('.').pop();
        const path = `presentations/slides/${type}_${idx}_${Date.now()}.${ext}`;
        const storageRef = ref(storage, path);
        const task = uploadBytesResumable(storageRef, file);

        setUploadProgress(prev => ({ ...prev, [key]: 0 }));

        task.on('state_changed',
            (snap) => {
                const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                setUploadProgress(prev => ({ ...prev, [key]: pct }));
            },
            (err) => {
                toast({ variant: 'destructive', title: 'Upload Failed', description: err.message });
                setUploadProgress(prev => { const n = {...prev}; delete n[key]; return n; });
            },
            async () => {
                const url = await getDownloadURL(task.snapshot.ref);
                const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
                updateSlide(type as any, idx, 'mediaUrl', url);
                updateSlide(type as any, idx, 'mediaType', mediaType);
                setUploadProgress(prev => { const n = {...prev}; delete n[key]; return n; });
                toast({ title: '✅ Media Uploaded', description: 'URL saved to slide.' });
            }
        );
    }, [presentations]);
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
        }, (err) => console.warn("Admin Community Investor Presentation fetch error:", err));
        const unsubCre = onSnapshot(doc(db, 'presentations', 'creator_v3'), (snap) => {
            if (snap.exists()) setPresentations((prev: any) => ({ ...prev, creator: snap.data() }));
        }, (err) => console.warn("Admin Community Creator Presentation fetch error:", err));

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
                subtitle: "The Future of Creator Economy (Base Ecosystem)",
                slides: [
                    { id: "inv-1", order: 1, title: "The Future of Creator Economy", slogan: "Powered by BASE", description: "Traditional platforms exploit creators. Unverse, built on the Base network, makes creators owners via smart-contracts.", bullets: ["Ethereum L2 Security", "Scalable Growth", "Coinbase Ecosystem Support"] },
                    { id: "inv-2", order: 2, title: "The Base Advantage", slogan: "Network of Choice", description: "Why we chose Base for the Unverse Hub.", bullets: ["Ultra-low Transaction Costs", "Native USDC Integration", "Smart Wallet / Account Abstraction Ready"] },
                    { id: "inv-3", order: 3, title: "M-Floor Protocol", slogan: "Secured by Base Liquidity", description: "Dynamic price floor targeting 15M USDC ecosystem value. Guaranteed by protocol-owned liquidity.", bullets: ["Burn reduces supply", "Floor increases automatically", "Treasury-backed stability"] },
                    { id: "inv-4", order: 4, title: "Revenue Flywheel", slogan: "Sustained Demand", description: "1/3 of all platform USDC revenue (subscriptions, unlocks) is used for $ULC buyback & burn.", bullets: ["Continuous market pressure", "Real-world revenue support", "Transparency via Ledger"] },
                    { id: "inv-5", order: 5, title: "AI-Powered Scalability", slogan: "Efficient Production", description: "AI reduces content production time by 90%, enabling creators to scale like never before.", bullets: ["100x faster generation", "Zero-skill requirement", "Massive output capacity"] },
                    { id: "inv-6", order: 6, title: "Staking & Yield", slogan: "Post-Mainnet Rewards", description: "Long-term holders and stakers share the success of the platform revenues.", bullets: ["Real yield from subscriptions", "Liquidity sink effect", "Aligned long-term incentives"] },
                    { id: "inv-7", order: 7, title: "Go-To-Market", slogan: "Global Expansion", description: "3-Phase strategy leading to the Base Mainnet launch.", bullets: ["Strategic pre-sale rounds", "Tier-1 exchange strategy", "Base ecosystem partnerships"] },
                    { id: "inv-8", order: 8, title: "Security & Vesting", slogan: "Immutable Economy", description: "Permanently fixed supply with 20-year locking mechanism for the reserve pool.", bullets: ["No new minting possible", "Smart-contract protection", "20-year reserve lock"] }
                ]
            },
            creator: {
                title: "Create. Monetize. Scale.",
                subtitle: "AI Powered Creator Economy (Base)",
                slides: [
                    { id: "cre-1", order: 1, title: "Elite Creator Program", slogan: "Exclusive First 100", description: "Be among the first 100 elite creators to launch on Unverse via the Base network.", bullets: ["Milestone rewards", "Early-stage advantage", "Exclusive governance rights"] },
                    { id: "cre-2", order: 2, title: "AI Studio & Variations", slogan: "Limitless Versatility", description: "Generate premium content and create endless variations using AI-powered editing and style transfer.", bullets: ["Instant visual generation", "Object removal & variation", "Studio-quality output"] },
                    { id: "cre-3", order: 3, title: "Container System", slogan: "Strategic Publishing", description: "Stock your content, manage your buffers, and schedule releases for maximum strategic impact.", bullets: ["Content stocking & buffering", "Publication scheduling", "Quality control hub"] },
                    { id: "cre-4", order: 4, title: "85/15 Revenue Model", slogan: "Fair & Instant Payouts", description: "You keep 85% of everything you earn. No hidden fees. Powered by Base USDC.", bullets: ["Native USDC payouts", "No payment delays", "Protocol-level transparency"] },
                    { id: "cre-5", order: 5, title: "Global Monetization", slogan: "Subscription Economy", description: "Unlock recurring revenue via platform-wide subscriptions and unique content unlocks.", bullets: ["Recurring USDC income", "Direct fan support", "Scalable earnings"] },
                    { id: "cre-6", order: 6, title: "Unverse Uniq Pro", slogan: "Premium AI Manager", description: "Your virtual manager helps you optimize content, analyze trends, and maximize revenue with advanced Pro features.", bullets: ["Advanced trend analysis", "Smart optimization & titles", "Revenue growth strategies"] },
                    { id: "cre-7", order: 7, title: "Shared Growth", slogan: "Value Alignment", description: "As the Unverse ecosystem grows, your tokens and status grow with it via the 20-year vision.", bullets: ["Vesting benefits", "Long-term incentive alignment", "Community-led future"] }
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

                                                        {/* Media Section — Drag & Drop Upload */}
                                                        <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
                                                            <label className="text-[8px] uppercase font-bold opacity-40">Visual Content</label>

                                                            {/* Drop Zone */}
                                                            <div
                                                                className={`relative aspect-video rounded-xl overflow-hidden border-2 border-dashed transition-all cursor-pointer flex items-center justify-center ${
                                                                    dragOver === `${type}-${idx}`
                                                                        ? 'border-yellow-500 bg-yellow-500/10'
                                                                        : 'border-white/10 bg-black hover:border-white/30'
                                                                }`}
                                                                onDragOver={(e) => { e.preventDefault(); setDragOver(`${type}-${idx}`); }}
                                                                onDragLeave={() => setDragOver(null)}
                                                                onDrop={(e) => {
                                                                    e.preventDefault();
                                                                    setDragOver(null);
                                                                    const file = e.dataTransfer.files[0];
                                                                    if (file) uploadSlideMedia(file, type, idx);
                                                                }}
                                                                onClick={() => {
                                                                    const input = document.createElement('input');
                                                                    input.type = 'file';
                                                                    input.accept = 'image/*,video/*';
                                                                    input.onchange = (e: any) => {
                                                                        const file = e.target.files[0];
                                                                        if (file) uploadSlideMedia(file, type, idx);
                                                                    };
                                                                    input.click();
                                                                }}
                                                            >
                                                                {uploadProgress[`${type}-${idx}`] !== undefined ? (
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <Loader2 className="w-8 h-8 animate-spin text-yellow-500"/>
                                                                        <span className="text-xs font-bold text-yellow-500">{uploadProgress[`${type}-${idx}`]}%</span>
                                                                    </div>
                                                                ) : slide.mediaUrl ? (
                                                                    <>
                                                                        {slide.mediaType === 'video'
                                                                            ? <video src={slide.mediaUrl} className="w-full h-full object-cover" />
                                                                            : <img src={slide.mediaUrl} className="w-full h-full object-cover" alt={slide.title} />
                                                                        }
                                                                        {/* Clear button */}
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); updateSlide(type as any, idx, 'mediaUrl', ''); }}
                                                                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 border border-white/20 flex items-center justify-center hover:bg-red-500/80 transition-colors"
                                                                        >
                                                                            <XIcon className="w-3 h-3"/>
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <div className="text-center pointer-events-none">
                                                                        <UploadCloud className="w-8 h-8 mx-auto opacity-20 mb-2"/>
                                                                        <span className="text-[9px] opacity-30 uppercase font-bold block">Drop or Click to Upload</span>
                                                                        <span className="text-[8px] opacity-20 uppercase">Image or Video</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Fallback manual URL input */}
                                                            <Input
                                                                value={slide.mediaUrl}
                                                                onChange={(e) => updateSlide(type as any, idx, 'mediaUrl', e.target.value)}
                                                                placeholder="…or paste Media URL (HTTPS)"
                                                                className="h-7 text-[9px] bg-white/5 border-white/10 p-2 opacity-50 focus:opacity-100 transition-opacity"
                                                            />
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
