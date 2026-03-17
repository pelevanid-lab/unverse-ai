
"use client"

import { useState, useEffect, FormEvent } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db, storage } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { UserProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Wallet, ChevronRight, Twitter } from 'lucide-react';
import { ImageUploader } from './ImageUploader';
import { useRouter } from 'next/navigation';

function CollectionWalletsLinkCard() {
    const router = useRouter();
    return (
        <Card className="glass-card max-w-2xl mx-auto border-white/10 mt-6">
            <CardHeader>
                <CardTitle className='flex items-center gap-2'><Wallet className="w-5 h-5 text-primary"/> Collection Wallets</CardTitle>
                <CardDescription>Manage the TRON and TON wallets where you will receive your earnings.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Button onClick={() => router.push('/creator/collection-wallets')} className='w-full'>
                    Manage Collection Wallets
                    <ChevronRight className="w-4 h-4 ml-2" />
                 </Button>
            </CardContent>
        </Card>
    );
}

export function CreatorSettingsTab() {
    const { user } = useWallet();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    
    // Separate states for form fields based on UserProfile
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [avatar, setAvatar] = useState('');
    const [coverImage, setCoverImage] = useState('');
    const [subscriptionPrice, setSubscriptionPrice] = useState(0);
    const [twitterLink, setTwitterLink] = useState('');

    useEffect(() => {
        if (user?.uid) {
            const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
                if (doc.exists()) {
                    const data = doc.data() as UserProfile;
                    setUsername(data.username || '');
                    setBio(data.bio || '');
                    setAvatar(data.avatar || '');
                    setCoverImage(data.creatorData?.coverImage || '');
                    setSubscriptionPrice(data.creatorData?.subscriptionPriceMonthly || 0);
                    setTwitterLink(data.socials?.twitter || '');
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
            
            const updatePayload: any = {
                username,
                bio,
                'creatorData.subscriptionPriceMonthly': Number(subscriptionPrice) || 0,
                'socials.twitter': twitterLink,
            };

            await updateDoc(userRef, updatePayload);
            toast({ title: "Settings Updated", description: "Your public profile has been updated successfully." });
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: "Update Failed", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleImageUploadComplete = async (downloadURL: string, type: 'avatar' | 'coverImage') => {
        if (!user?.uid) return;
        try {
            const userRef = doc(db, 'users', user.uid);
            const fieldToUpdate = type === 'avatar' ? 'avatar' : 'creatorData.coverImage';
            await updateDoc(userRef, { [fieldToUpdate]: downloadURL });
            
            if (type === 'avatar') {
                setAvatar(downloadURL);
            } else {
                setCoverImage(downloadURL);
            }
            
            toast({ title: 'Image Updated', description: `Your ${type === 'avatar' ? 'avatar' : 'cover image'} has been updated.` });
        } catch (error: any) {
             toast({ variant: 'destructive', title: "Update Failed", description: error.message });
        }
    };


    return (
        <div className="space-y-8">
            <Card className="glass-card max-w-2xl mx-auto border-white/10">
                <CardHeader>
                    <CardTitle>Creator Settings</CardTitle>
                    <CardDescription>Customize your public profile and monetization rules.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleFormSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">Display Name</Label>
                            <Input id="displayName" value={username} onChange={(e) => setUsername(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="creatorBio">Bio</Label>
                            <Textarea id="creatorBio" value={bio} onChange={(e) => setBio(e.target.value)} />
                        </div>
                        
                        <div className="space-y-4">
                            <Label>Avatar Image</Label>
                            <ImageUploader 
                                onUploadComplete={(url) => handleImageUploadComplete(url, 'avatar')} 
                                currentImageUrl={avatar}
                                label="Avatar"
                                recommendedSize="400x400px, Max 2MB"
                                storagePath={`user-assets/${user?.uid}/avatar`}
                                previewType='avatar'
                            />
                        </div>

                        <div className="space-y-4">
                             <Label>Cover Image</Label>
                             <ImageUploader 
                                onUploadComplete={(url) => handleImageUploadComplete(url, 'coverImage')} 
                                currentImageUrl={coverImage}
                                label="Cover Image"
                                recommendedSize="1600x400px, Max 4MB"
                                storagePath={`user-assets/${user?.uid}/coverImage`}
                                previewType='cover'
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="subscriptionPrice">Subscription Price (ULC per month)</Label>
                            <Input id="subscriptionPrice" type="number" value={subscriptionPrice} onChange={(e) => setSubscriptionPrice(Number(e.target.value))} />
                        </div>
                        
                         <div className="space-y-2">
                            <Label htmlFor="twitterLink">X (Twitter) Profile</Label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                                    <Twitter className="h-5 w-5" />
                                </span>
                                <Input 
                                    id="twitterLink" 
                                    value={twitterLink}
                                    onChange={(e) => setTwitterLink(e.target.value)}
                                    placeholder="https://x.com/yourhandle"
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </form>
                </CardContent>
            </Card>
            
            <CollectionWalletsLinkCard />
        </div>
    );
}
