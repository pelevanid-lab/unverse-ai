
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, BarChart3, Settings, Upload, DollarSign, Coins, ArrowUpRight, Loader2, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { handleCreatorWithdrawal } from '@/lib/ledger';
import Link from 'next/link';

export default function CreatorPanel() {
  const { user, isConnected } = useWallet();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
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
      toast({ title: "Content Published", description: "Your post is now live." });
      e.target.reset();
      setIsPremium(false);
    } catch (err) {
      toast({ variant: 'destructive', title: "Failed to Post" });
    }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!user || user.ulcBalance.available <= 0) return;
    setWithdrawing(true);
    try {
      await handleCreatorWithdrawal(user, user.ulcBalance.available);
      toast({ title: "Withdrawal Initiated", description: "Processing your earnings." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Withdrawal Failed", description: e.message });
    }
    setWithdrawing(false);
  };

  if (!isConnected) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <DollarSign className="w-16 h-16 text-primary" />
      <h1 className="text-3xl font-headline font-bold">Creator Portal</h1>
      <p className="text-muted-foreground">Connect your wallet to manage your content.</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-8 border-white/10">
        <div>
          <h1 className="text-5xl font-headline font-bold gradient-text">Creator Panel</h1>
          <p className="text-muted-foreground mt-2">Manage your digital empire.</p>
        </div>
        <div className="flex gap-4">
          <Card className="glass-card border-primary/20 bg-primary/5 flex items-center gap-4 px-6 py-3 rounded-2xl">
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Available Earnings</p>
              <p className="text-2xl font-bold font-headline">{user?.ulcBalance.available.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">ULC</span></p>
            </div>
            <Button size="sm" onClick={handleWithdraw} disabled={withdrawing || user?.ulcBalance.available === 0} className="rounded-xl gap-2">
              {withdrawing ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              Withdraw
            </Button>
          </Card>
          <Link href={`/profile/${user?.uid}`}>
            <Button variant="outline" className="h-full rounded-2xl gap-2"><ExternalLink className="w-4 h-4" /> View Public Profile</Button>
          </Link>
        </div>
      </header>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-14 bg-muted/20 p-1 rounded-2xl border border-white/5 mb-8">
          <TabsTrigger value="create" className="rounded-xl gap-2 data-[state=active]:bg-primary">
            <Plus className="w-4 h-4" /> New Post
          </TabsTrigger>
          <TabsTrigger value="content" className="rounded-xl gap-2 data-[state=active]:bg-primary">
            <Upload className="w-4 h-4" /> Content
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-xl gap-2 data-[state=active]:bg-primary">
            <BarChart3 className="w-4 h-4" /> Stats
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl gap-2 data-[state=active]:bg-primary">
            <Settings className="w-4 h-4" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card className="glass-card max-w-2xl mx-auto border-white/10">
            <CardHeader>
              <CardTitle>Publish Content</CardTitle>
              <CardDescription>Upload media and set price.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePost} className="space-y-6">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input name="title" placeholder="Post title..." required className="bg-muted/30 border-none h-12" />
                </div>
                
                <div className="space-y-2">
                  <Label>Caption</Label>
                  <Textarea name="caption" placeholder="Describe your post..." required className="bg-muted/30 border-none min-h-[120px]" />
                </div>

                <div className="border-2 border-dashed rounded-2xl p-12 text-center flex flex-col items-center gap-4 bg-muted/10 border-white/10">
                  <Upload className="w-10 h-10 text-primary" />
                  <p className="text-sm font-bold">Media Upload (Placeholder)</p>
                </div>

                <div className="flex items-center justify-between p-5 bg-muted/20 rounded-2xl border border-white/5">
                  <div className="space-y-0.5">
                    <Label className="font-bold">Premium Access</Label>
                    <p className="text-[10px] text-muted-foreground">Require tokens to unlock.</p>
                  </div>
                  <Switch checked={isPremium} onCheckedChange={setIsPremium} />
                </div>

                {isPremium && (
                  <div className="space-y-2 p-5 bg-primary/5 rounded-2xl border border-primary/20">
                    <Label className="text-xs uppercase font-bold text-primary">Price ($ULC)</Label>
                    <div className="relative">
                      <Input name="price" type="number" defaultValue="5" className="bg-muted/30 border-none h-12 text-lg font-bold pl-12" />
                      <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                    </div>
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full h-16 text-lg font-bold rounded-2xl shadow-lg">
                  {loading ? 'Publishing...' : 'Publish to Feed'}
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
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card p-6">
              <p className="text-xs font-bold uppercase text-muted-foreground">Total Views</p>
              <div className="text-3xl font-bold mt-2 font-headline">0</div>
            </Card>
            <Card className="glass-card p-6">
              <p className="text-xs font-bold uppercase text-muted-foreground">Earnings</p>
              <div className="text-3xl font-bold mt-2 font-headline">{user?.totalEarnings.toFixed(2)} ULC</div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="glass-card max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Economic Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label>Default Price ($ULC)</Label>
                <Input type="number" defaultValue="5" className="w-24 text-right" />
              </div>
              <Button className="w-full">Save Rules</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
