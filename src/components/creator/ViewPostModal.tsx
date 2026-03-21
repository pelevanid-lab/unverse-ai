
"use client";

import { useState, useEffect } from 'react';
import { ContentPost, PostContentType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, X, Pencil, Save, Coins, Globe, Lock, Clock } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

interface ViewPostModalProps {
  post: ContentPost;
  onClose: () => void;
}

export function ViewPostModal({ post, onClose }: ViewPostModalProps) {
  const { toast } = useToast();
  const [caption, setCaption] = useState('');
  const [contentType, setContentType] = useState<PostContentType>('public');
  const [unlockPrice, setUnlockPrice] = useState(0);
  const [totalSupply, setTotalSupply] = useState(100);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (post) {
        setCaption(post.content || '');
        setContentType(post.contentType || 'public');
        setUnlockPrice(post.contentType === 'limited' ? (post.limited?.price || 0) : (post.unlockPrice || 0));
        setTotalSupply(post.limited?.totalSupply || 100);
        setIsEditing(false);
    }
  }, [post]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const postRef = doc(db, 'posts', post.id);
      const updateData: any = { 
        content: caption,
        contentType,
        unlockPrice: (contentType === 'premium' || contentType === 'limited') ? Number(unlockPrice) : 0,
      };

      if (contentType === 'limited') {
          updateData.limited = {
              totalSupply: Number(totalSupply),
              soldCount: post.limited?.soldCount || 0,
              price: Number(unlockPrice)
          };
      } else {
          updateData.limited = null;
      }

      await updateDoc(postRef, updateData);
      toast({ title: 'Post Updated Successfully!' });
      setIsEditing(false);
    } catch (error) {
      console.error("Update failed:", error);
      toast({ variant: 'destructive', title: 'Failed to Update Post' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      if (post.mediaUrl) {
          try {
            const fileRef = ref(storage, post.mediaUrl);
            await deleteObject(fileRef);
          } catch (e) {
            console.warn("Storage deletion failed:", e);
          }
      }
      toast({ title: 'Post Deleted Successfully' });
      onClose();
    } catch (error) {
      console.error("Delete failed:", error);
      toast({ variant: 'destructive', title: 'Failed to Delete Post' });
    } finally {
      setLoading(false);
    }
  };
  
  const isImage = post.mediaUrl?.includes('.webp') || post.mediaUrl?.includes('.png') || post.mediaUrl?.includes('.jpg') || post.mediaUrl?.includes('.jpeg') || post.mediaUrl?.includes('image');

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-full max-h-[90vh] flex flex-col glass-card p-0 overflow-hidden">
        <Button onClick={onClose} className="absolute top-2 right-2 z-50 h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-black/80 text-white">
            <X className="h-4 w-4" />
        </Button>
        <DialogTitle className="sr-only">{isEditing ? 'Edit Post' : 'View Post'}</DialogTitle>
        <DialogDescription className="sr-only">Manage your published post.</DialogDescription>
        
        <div className="flex flex-col md:grid md:grid-cols-10 h-full overflow-y-auto md:overflow-hidden">
          <div className="md:col-span-6 flex items-center justify-center bg-black/80 overflow-hidden">
            {isImage ? (
              <img src={post.mediaUrl} alt="post" className="max-w-full max-h-full w-auto h-auto object-contain"/>
            ) : post.mediaUrl ? (
              <video src={post.mediaUrl} controls autoPlay className="max-w-full max-h-full w-auto h-auto" />
            ) : (
                <div className="text-muted-foreground italic">No media preview available.</div>
            )}
          </div>
          <div className="md:col-span-4 flex flex-col justify-between p-6 bg-background/50 overflow-y-auto custom-scrollbar">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="caption" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Caption</Label>
                {isEditing ? (
                  <Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} className="bg-input/50" rows={2} maxLength={280} />
                ) : (
                  <p className="text-sm text-muted-foreground border rounded-md p-3 bg-black/20">{caption || 'No caption provided.'}</p>
                )}
              </div>

              <div className="space-y-4">
                <Label className='text-sm font-bold uppercase tracking-wider text-muted-foreground'>Content Type</Label>
                {isEditing ? (
                    <RadioGroup value={contentType} onValueChange={(v) => setContentType(v as PostContentType)} className="grid grid-cols-1 gap-2">
                         <div className="flex items-center space-x-2 bg-white/5 p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                            <RadioGroupItem value="public" id="e-public" />
                            <Label htmlFor="e-public" className="flex-1 cursor-pointer flex items-center gap-2">
                                <Globe className="w-4 h-4 text-green-400" />
                                <div className="flex flex-col">
                                    <span className="font-bold">Public</span>
                                    <span className="text-[10px] opacity-60">Visible to everyone</span>
                                </div>
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2 bg-white/5 p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                            <RadioGroupItem value="premium" id="e-premium" />
                            <Label htmlFor="e-premium" className="flex-1 cursor-pointer flex items-center gap-2">
                                <Lock className="w-4 h-4 text-primary" />
                                <div className="flex flex-col">
                                    <span className="font-bold">Premium</span>
                                    <span className="text-[10px] opacity-60">Subscriber-only & Unlocks</span>
                                </div>
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2 bg-white/5 p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                            <RadioGroupItem value="limited" id="e-limited" />
                            <Label htmlFor="e-limited" className="flex-1 cursor-pointer flex items-center gap-2">
                                <Clock className="w-4 h-4 text-yellow-400" />
                                <div className="flex flex-col">
                                    <span className="font-bold">Limited</span>
                                    <span className="text-[10px] opacity-60">Restricted supply edition</span>
                                </div>
                            </Label>
                        </div>
                    </RadioGroup>
                ) : (
                    <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
                        {contentType === 'public' && <><Globe className="w-4 h-4 text-green-400" /><span className="font-bold">Public Content</span></>}
                        {contentType === 'premium' && <><Lock className="w-4 h-4 text-primary" /><span className="font-bold">Premium Content</span></>}
                        {contentType === 'limited' && <><Clock className="w-4 h-4 text-yellow-400" /><span className="font-bold">Limited Content</span></>}
                    </div>
                )}

                {contentType !== 'public' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="e-price" className='text-xs font-bold uppercase tracking-wider text-muted-foreground'>Unlock Price (ULC)</Label>
                            {isEditing ? (
                                <div className="relative">
                                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                                    <Input id="e-price" type="number" value={unlockPrice} onChange={(e) => setUnlockPrice(Number(e.target.value))} className="bg-input/50 pl-10 h-11 font-bold" />
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-2xl font-bold font-headline text-primary">
                                    <Coins className="w-6 h-6" /> {unlockPrice} ULC
                                </div>
                            )}
                        </div>

                        {contentType === 'limited' && (
                            <div className="space-y-2">
                                <Label htmlFor="e-supply" className='text-xs font-bold uppercase tracking-wider text-muted-foreground'>Supply Strategy</Label>
                                {isEditing ? (
                                    <Input id="e-supply" type="number" value={totalSupply} onChange={(e) => setTotalSupply(Number(e.target.value))} className="bg-input/50 h-11 font-bold" />
                                ) : (
                                    <div className="text-sm font-bold flex items-center gap-2">
                                        <Badge variant="secondary" className="bg-yellow-400/10 text-yellow-400 border-yellow-400/20">
                                            {post.limited?.soldCount || 0} / {totalSupply} SOLD
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
              </div>
            </div>

            <div className="flex flex-col space-y-3 mt-8">
                <div className="flex gap-3">
                    {isEditing ? (
                        <Button onClick={handleUpdate} disabled={loading} className="w-full h-12 text-lg font-bold gap-2 rounded-xl">
                            {loading ? <Loader2 className="animate-spin" /> : <><Save size={20}/> Save Changes</>}
                        </Button>
                    ) : (
                        <Button onClick={() => setIsEditing(true)} className="w-full h-12 text-lg font-bold gap-2 rounded-xl">
                            <Pencil size={20}/> Edit Content
                        </Button>
                    )}
                </div>
                
                {isEditing && (
                    <Button variant="ghost" onClick={() => setIsEditing(false)} className="w-full h-11 rounded-xl">Cancel</Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" disabled={loading} className='w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2 h-11 rounded-xl'>
                        <Trash2 size={16}/> Delete Content
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className='rounded-[2rem]'>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Permanent Deletion</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the post and media. History of existing unlocks will be preserved.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className='rounded-xl'>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl">Confirm Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
