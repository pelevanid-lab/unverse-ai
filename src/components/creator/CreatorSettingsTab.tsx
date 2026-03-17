
"use client"

import { useState, useEffect, FormEvent } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db, storage } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { Creator } from '@/lib/types';
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
    const [creatorData, setCreatorData] = useState<Partial<Creator>>({});

    useEffect(() => {
        if (user?.isCreator && user.uid) {
            const unsub = onSnapshot(doc(db, 'creators', user.uid), (doc) => {
                if (doc.exists()) {
                    setCreatorData(doc.data() as Creator);
                }
            });
            return () => unsub();
        }
    }, [user]);

    const handleUpdate = (field: keyof Creator, value: any) => {
        setCreatorData(prev => ({ ...prev, [field]: value }));
    };

    const handleFormSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!user?.uid) return;

        setLoading(true);
        try {
            const creatorRef = doc(db, 'creators', user.uid);
            const { username, ...dataToUpdate } = creatorData;
            dataToUpdate.subscriptionPrice = Number(dataToUpdate.subscriptionPrice) || 0;
            await updateDoc(creatorRef, dataToUpdate);
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
            const creatorRef = doc(db, 'creators', user.uid);
            await updateDoc(creatorRef, { [type]: downloadURL });
            handleUpdate(type, downloadURL);
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
                            <Input id="displayName" value={creatorData.displayName || ''} onChange={(e) => handleUpdate('displayName', e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="creatorBio">Bio</Label>
                            <Textarea id="creatorBio" value={creatorData.creatorBio || ''} onChange={(e) => handleUpdate('creatorBio', e.target.value)} />
                        </div>
                        
                        <div className="space-y-4">
                            <Label>Avatar Image</Label>
                            <ImageUploader 
                                onUploadComplete={(url) => handleImageUploadComplete(url, 'avatar')} 
                                currentImageUrl={creatorData.avatar}
                                label="Avatar"
                                recommendedSize="400x400px, Max 2MB"
                                storagePath={`creator-assets/${user?.uid}/avatar`}
                                previewType='avatar'
                            />
                        </div>

                        <div className="space-y-4">
                             <Label>Cover Image</Label>
                             <ImageUploader 
                                onUploadComplete={(url) => handleImageUploadComplete(url, 'coverImage')} 
                                currentImageUrl={creatorData.coverImage}
                                label="Cover Image"
                                recommendedSize="1600x400px, Max 4MB"
                                storagePath={`creator-assets/${user?.uid}/coverImage`}
                                previewType='cover'
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="subscriptionPrice">Subscription Price (ULC per month)</Label>
                            <Input id="subscriptionPrice" type="number" value={creatorData.subscriptionPrice || 0} onChange={(e) => handleUpdate('subscriptionPrice', e.target.value)} />
                        </div>
                        
                         <div className="space-y-2">
                            <Label htmlFor="twitterLink">X (Twitter) Profile</Label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                                    <Twitter className="h-5 w-5" />
                                </span>
                                <Input 
                                    id="twitterLink" 
                                    value={creatorData.socialLinks?.x || ''} 
                                    onChange={(e) => handleUpdate('socialLinks', { ...creatorData.socialLinks, x: e.target.value })} 
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
