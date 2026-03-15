"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image as ImageIcon, Plus, BarChart3, Settings, Upload } from 'lucide-react';
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function CreatorPanel() {
  const { user, isConnected } = useWallet();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePost = async (e: any) => {
    e.preventDefault();
    if (!isConnected) return;
    setLoading(true);

    const formData = new FormData(e.target);
    const postData = {
      creatorId: user!.uid,
      creatorName: user!.username,
      creatorAvatar: user!.avatar,
      title: formData.get('title'),
      caption: formData.get('caption'),
      mediaUrl: `https://picsum.photos/seed/${Math.random()}/800/600`, // Simulated upload
      isPremium: isPremium,
      price: isPremium ? parseFloat(formData.get('price') as string) : 0,
      createdAt: Date.now()
    };

    try {
      await addDoc(collection(db, 'content'), postData);
      toast({ title: "Posted", description: "Your content is now live!" });
      e.target.reset();
    } catch (e) {
      toast({ title: "Error", description: "Failed to post content." });
    }
    setLoading(false);
  };

  if (!isConnected) return null;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-headline font-bold gradient-text">Creator Panel</h1>
          <p className="text-muted-foreground">Manage your content and creator brand.</p>
        </div>
        <div className="bg-primary/20 px-4 py-2 rounded-xl border border-primary/30 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Total Earnings: 0.00 ULC</span>
        </div>
      </header>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="create" className="gap-2"><Plus className="w-4 h-4" /> Create Content</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="w-4 h-4" /> Analytics</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings className="w-4 h-4" /> Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card className="glass-card max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>New Post</CardTitle>
              <CardDescription>Share public or premium content with your followers.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePost} className="space-y-6">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input name="title" placeholder="Catchy title..." required className="bg-muted" />
                </div>
                
                <div className="space-y-2">
                  <Label>Caption</Label>
                  <Textarea name="caption" placeholder="Tell your story..." required className="bg-muted" />
                </div>

                <div className="border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center gap-3 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer">
                  <Upload className="w-10 h-10 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-bold">Click to upload media</p>
                    <p className="text-xs text-muted-foreground">Support for JPG, PNG, MP4 up to 50MB</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border">
                  <div className="space-y-0.5">
                    <Label>Premium Content</Label>
                    <p className="text-xs text-muted-foreground">Require ULC payment to unlock this post.</p>
                  </div>
                  <Switch checked={isPremium} onCheckedChange={setIsPremium} />
                </div>

                {isPremium && (
                  <div className="space-y-2">
                    <Label>Unlock Price (ULC)</Label>
                    <Input name="price" type="number" defaultValue="5" className="bg-muted" />
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 py-6 text-lg">
                  {loading ? 'Posting...' : 'Post Content'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Profile Visits</p>
              <div className="text-2xl font-bold mt-2">1,204</div>
            </Card>
            <Card className="glass-card p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Content Unlocks</p>
              <div className="text-2xl font-bold mt-2">84</div>
            </Card>
            <Card className="glass-card p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subscribers</p>
              <div className="text-2xl font-bold mt-2">29</div>
            </Card>
            <Card className="glass-card p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tips Received</p>
              <div className="text-2xl font-bold mt-2">12.5 ULC</div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}