"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, BarChart3, Settings, Upload, DollarSign, Users, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function CreatorPanel() {
  const { user, isConnected } = useWallet();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const [myContent, setMyContent] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'content'), where('creatorId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setMyContent(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  const handlePost = async (e: any) => {
    e.preventDefault();
    if (!isConnected || !user) return;
    setLoading(true);

    const formData = new FormData(e.target);
    const postData = {
      creatorId: user.uid,
      creatorName: user.username,
      creatorAvatar: user.avatar,
      title: formData.get('title'),
      caption: formData.get('caption'),
      mediaUrl: `https://picsum.photos/seed/${Math.random()}/800/800`,
      isPremium: isPremium,
      price: isPremium ? parseFloat(formData.get('price') as string) : 0,
      createdAt: Date.now()
    };

    try {
      await addDoc(collection(db, 'content'), postData);
      toast({ title: "Content Published", description: "Your post is now live in the Discover feed." });
      e.target.reset();
      setIsPremium(false);
    } catch (err) {
      toast({ variant: 'destructive', title: "Failed to Post" });
    }
    setLoading(false);
  };

  if (!isConnected) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <DollarSign className="w-16 h-16 text-primary" />
      <h1 className="text-3xl font-headline font-bold">Creator Access</h1>
      <p className="text-muted-foreground">Connect your wallet to start earning.</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-8 border-white/10">
        <div>
          <h1 className="text-5xl font-headline font-bold gradient-text">Creator Panel</h1>
          <p className="text-muted-foreground mt-2">Manage your digital empire and tokenized content.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-primary/10 border border-primary/20 px-6 py-3 rounded-2xl">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Creator Earnings</p>
            <p className="text-2xl font-bold font-headline">{user?.totalEarnings.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">ULC</span></p>
          </div>
          <Link href={`/mypage`}>
             <Button variant="outline" className="h-full rounded-2xl gap-2"><ExternalLink className="w-4 h-4" /> View Public Page</Button>
          </Link>
        </div>
      </header>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-14 bg-muted/20 p-1 rounded-2xl border border-white/5 mb-8">
          <TabsTrigger value="create" className="rounded-xl gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Plus className="w-4 h-4" /> New Post
          </TabsTrigger>
          <TabsTrigger value="content" className="rounded-xl gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Upload className="w-4 h-4" /> My Content
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-xl gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Settings className="w-4 h-4" /> Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card className="glass-card max-w-2xl mx-auto border-white/10 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">Publish Content</CardTitle>
              <CardDescription>Upload media and set your economic parameters.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePost} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Post Title</Label>
                  <Input name="title" placeholder="A catchy headline..." required className="bg-muted/30 border-none h-12" />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Caption / Description</Label>
                  <Textarea name="caption" placeholder="Describe your masterpiece..." required className="bg-muted/30 border-none min-h-[120px]" />
                </div>

                <div className="border-2 border-dashed rounded-2xl p-12 text-center flex flex-col items-center gap-4 bg-muted/10 hover:bg-muted/20 transition-all border-white/10 cursor-pointer group">
                  <div className="p-4 bg-primary/10 rounded-full group-hover:scale-110 transition-transform">
                    <Upload className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Drop your content here</p>
                    <p className="text-[10px] text-muted-foreground mt-1">High-quality JPG, PNG, or MP4 (Max 100MB)</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-5 bg-muted/20 rounded-2xl border border-white/5">
                  <div className="space-y-0.5">
                    <Label className="font-bold">Premium Content</Label>
                    <p className="text-[10px] text-muted-foreground">Tokens required to view this post.</p>
                  </div>
                  <Switch checked={isPremium} onCheckedChange={setIsPremium} />
                </div>

                {isPremium && (
                  <div className="space-y-2 p-5 bg-primary/5 rounded-2xl border border-primary/20 animate-in slide-in-from-top-2">
                    <Label className="text-xs uppercase font-bold text-primary">Unlock Price ($ULC)</Label>
                    <div className="relative">
                      <Input name="price" type="number" defaultValue="5" className="bg-muted/30 border-none h-12 text-lg font-bold pl-12" />
                      <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Platform Fee: 5% (split between Treasury & Staking rewards).
                    </p>
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 h-16 text-lg font-bold rounded-2xl shadow-lg shadow-primary/20">
                  {loading ? 'Transmitting to Ledger...' : 'Publish to Feed'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myContent.map((post) => (
              <Card key={post.id} className="glass-card overflow-hidden">
                <div className="relative aspect-video">
                  <img src={post.mediaUrl} className="w-full h-full object-cover" />
                  {post.isPremium && <Badge className="absolute top-2 right-2 bg-primary">Premium: {post.price} ULC</Badge>}
                </div>
                <CardContent className="p-4">
                  <h4 className="font-bold truncate">{post.title}</h4>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-[10px] text-muted-foreground">{new Date(post.createdAt).toLocaleDateString()}</span>
                    <Button variant="ghost" size="sm" className="h-8 text-[10px]">Delete Post</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {myContent.length === 0 && (
              <div className="col-span-full py-24 text-center text-muted-foreground">
                <p>You haven't published any content yet.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card p-6 border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Views</p>
              <div className="text-3xl font-bold mt-2 font-headline">24,802</div>
              <p className="text-[10px] text-green-400 mt-1">+12% from last week</p>
            </Card>
            <Card className="glass-card p-6 border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Premium Unlocks</p>
              <div className="text-3xl font-bold mt-2 font-headline">{myContent.filter(c => c.isPremium).length * 8}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Avg 5.2 ULC / unlock</p>
            </Card>
            <Card className="glass-card p-6 border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Subs</p>
              <div className="text-3xl font-bold mt-2 font-headline">152</div>
              <p className="text-[10px] text-green-400 mt-1">+4 today</p>
            </Card>
            <Card className="glass-card p-6 border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Revenue (USDT)</p>
              <div className="text-3xl font-bold mt-2 font-headline">$1,240</div>
              <p className="text-[10px] text-muted-foreground mt-1">Net platform fees</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="glass-card max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Content Economy Settings</CardTitle>
              <CardDescription>Define how users interact with your profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <Label>Default Unlock Price ($ULC)</Label>
                   <Input type="number" defaultValue="5" className="w-24 text-right" />
                 </div>
                 <div className="flex items-center justify-between">
                   <Label>Monthly Subscription ($USDT)</Label>
                   <Input type="number" defaultValue="10" className="w-24 text-right" />
                 </div>
                 <div className="flex items-center justify-between">
                   <Label>Direct Tipping Enabled</Label>
                   <Switch defaultChecked />
                 </div>
               </div>
               <Button className="w-full mt-6">Save Economic Rules</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
