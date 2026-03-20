
"use client"

import { useState, useEffect, FormEvent } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { UserProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ImageUploader } from '@/components/creator/ImageUploader';
import { useRouter } from 'next/navigation';
import { 
    Loader2, 
    ChevronLeft as ChevronLeftIcon, 
    Twitter as TwitterIcon, 
    Sparkles as SparklesIcon, 
    Wallet as WalletIcon, 
    ChevronRight as ChevronRightIcon,
    Zap
} from 'lucide-react';

export default function CreatorSettingsPage() {
    const { user, isConnected, loading: walletLoading, connectWallet } = useWallet();
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [avatar, setAvatar] = useState('');
    const [coverImage, setCoverImage] = useState('');
    const [subscriptionPrice, setSubscriptionPrice] = useState(0);
    const [twitterLink, setTwitterLink] = useState('');

    useEffect(() => {
        if (!walletLoading && isConnected && user && !user.isCreator) {
            router.push('/creator');
        }
    }, [user, isConnected, walletLoading, router]);

    useEffect(() => {
        if (user?.uid) {
            const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as UserProfile;
                    setUsername(data.username || '');
                    setBio(data.bio || '');
                    setAvatar(data.avatar || '');
                    setCoverImage(data.creatorData?.coverImage || '');
                    setSubscriptionPrice(data.creatorData?.subscriptionPriceMonthly || 0);
                    const socials = (data as any).socials;
                    setTwitterLink(socials?.twitter || '');
                }
            });
            return () => unsub();
        }
    }, [user]);

    const handleFormSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!user?.uid) return;

        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                username,
                bio,
                'creatorData.subscriptionPriceMonthly': Number(subscriptionPrice) || 0,
                'socials.twitter': twitterLink,
            });
            toast({ title: "Settings Updated", description: "Your creator profile has been updated." });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Update Failed", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpdate = async (url: string, type: 'avatar' | 'coverImage') => {
        if (!user?.uid) return;
        try {
            const userRef = doc(db, 'users', user.uid);
            const field = type === 'avatar' ? 'avatar' : 'creatorData.coverImage';
            await updateDoc(userRef, { [field]: url });
            toast({ title: 'Image Updated' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Upload Failed", description: error.message });
        }
    };

    // 1. Loading State
    if (walletLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="animate-spin w-10 h-10 text-primary" />
                <p className="text-muted-foreground animate-pulse font-headline">Authenticating Empire...</p>
            </div>
        );
    }

    // 2. Not Connected State
    if (!isConnected || !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
                <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center">
                    <WalletIcon className="w-10 h-10 text-muted-foreground opacity-40" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-headline font-bold">Empire Offline</h1>
                    <p className="text-muted-foreground max-w-xs mx-auto">You must connect your sovereign wallet to manage your creator settings.</p>
                </div>
                <Button onClick={connectWallet} className="gap-2 rounded-2xl px-8 h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20">
                    <Zap className="w-5 h-5 fill-white" /> Connect Wallet
                </Button>
            </div>
        );
    }

    // 3. Main Settings UI
    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-20 px-4">
            <header className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/creator')} className="h-10 w-10 rounded-full bg-white/5">
                    <ChevronLeftIcon className="w-6 h-6" />
                </Button>
                <div>
                    <h1 className="text-4xl font-headline font-bold gradient-text">Empire Settings</h1>
                    <p className="text-muted-foreground">Customize your public presence and monetization.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-8">
                <Card className="glass-card border-white/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-primary"/> Public Identity</CardTitle>
                        <CardDescription>How your followers see you on the platform.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleFormSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <Label>Profile Avatar</Label>
                                    <ImageUploader 
                                        onUploadComplete={(url) => handleImageUpdate(url, 'avatar')} 
                                        currentImageUrl={avatar}
                                        label="Avatar"
                                        storagePath={`user-assets/${user?.uid}/avatar`}
                                        previewType='avatar'
                                    />
                                </div>
                                <div className="space-y-4">
                                    <Label>Cover Banner</Label>
                                    <ImageUploader 
                                        onUploadComplete={(url) => handleImageUpdate(url, 'coverImage')} 
                                        currentImageUrl={coverImage}
                                        label="Cover"
                                        storagePath={`user-assets/${user?.uid}/cover`}
                                        previewType='cover'
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="username">Display Username</Label>
                                    <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="bg-white/5 h-12" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bio">Creator Bio</Label>
                                    <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} className="bg-white/5 min-h-[120px] resize-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="price">Monthly Subscription (USDT)</Label>
                                    <div className="relative">
                                        <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                                        <Input id="price" type="number" value={subscriptionPrice} onChange={(e) => setSubscriptionPrice(Number(e.target.value))} className="bg-white/5 pl-10 h-12" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="twitter">X (Twitter) Link</Label>
                                    <div className="relative">
                                        <TwitterIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input id="twitter" value={twitterLink} onChange={(e) => setTwitterLink(e.target.value)} placeholder="https://x.com/..." className="pl-10 bg-white/5 h-12" />
                                    </div>
                                </div>
                            </div>

                            <Button type="submit" disabled={loading} className="w-full h-14 text-lg font-bold shadow-xl shadow-primary/20 rounded-2xl">
                                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                Save Empire Settings
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10 overflow-hidden relative group cursor-pointer hover:border-blue-500/30 transition-colors" onClick={() => router.push('/creator/collection-wallets')}>
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
                    <CardHeader>
                        <CardTitle className='flex items-center gap-2 text-blue-400'><WalletIcon className="w-5 h-5"/> Collection Addresses</CardTitle>
                        <CardDescription>Manage your TRON and TON destinations for earnings withdrawal.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-end pt-0">
                         <div className="flex items-center gap-2 text-sm font-bold text-blue-400 group-hover:gap-3 transition-all">
                            Manage Addresses <ChevronRightIcon className="w-4 h-4" />
                         </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
