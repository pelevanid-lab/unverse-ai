
"use client";

import { useState, useEffect } from 'react';
import { ContentPost } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Trash2, X, Pencil, Save, Coins } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ViewPostModalProps {
  post: ContentPost;
  onClose: () => void;
}

export function ViewPostModal({ post, onClose }: ViewPostModalProps) {
  const { toast } = useToast();
  // State initialization with fallbacks
  const [caption, setCaption] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [unlockPrice, setUnlockPrice] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Synchronize state when the post prop changes
  useEffect(() => {
    if (post) {
        setCaption(post.content || post.caption || '');
        setIsPremium(post.isPremium || false);
        setUnlockPrice(post.unlockPrice || post.priceULC || 0);
        setIsEditing(false);
    }
  }, [post]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const postRef = doc(db, 'posts', post.id);
      const updateData = { 
        content: caption,
        caption: caption, // Update both for safety
        isPremium,
        unlockPrice: isPremium ? Number(unlockPrice) : 0,
        priceULC: isPremium ? Number(unlockPrice) : 0 // Update both for safety
      };

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
            console.warn("Storage deletion failed or file already gone:", e);
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
        <Button onClick={onClose} className="absolute top-2 right-2 z-50 h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-black/80">
            <X className="h-4 w-4" />
        </Button>
        <DialogTitle className="sr-only">{isEditing ? 'Edit Post' : 'View Post'}</DialogTitle>
        <DialogDescription className="sr-only">Manage your published post.</DialogDescription>
        
        <div className="grid grid-cols-1 md:grid-cols-10 h-full overflow-hidden">
          <div className="md:col-span-6 flex items-center justify-center bg-black/80 overflow-hidden">
            {isImage ? (
              <img src={post.mediaUrl} alt="post" className="max-w-full max-h-full w-auto h-auto object-contain"/>
            ) : post.mediaUrl ? (
              <video src={post.mediaUrl} controls autoPlay className="max-w-full max-h-full w-auto h-auto" />
            ) : (
                <div className="text-muted-foreground italic">No media preview available.</div>
            )}
          </div>
          <div className="md:col-span-4 flex flex-col justify-between p-6 bg-background/50 overflow-y-auto">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="caption" className="text-lg font-medium">Caption</Label>
                {isEditing ? (
                  <Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} className="bg-input/50" rows={2} maxLength={280} />
                ) : (
                  <p className="text-sm text-muted-foreground border rounded-md p-3 bg-black/20">{caption || 'No caption provided.'}</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4 bg-black/20">
                    <div className='space-y-1'>
                        <Label htmlFor="isPremiumEdit" className='text-base font-bold'>Premium Content</Label>
                        <p className='text-xs text-muted-foreground'>Requires ULC to unlock.</p>
                    </div>
                    {isEditing ? (
                        <Switch id="isPremiumEdit" checked={isPremium} onCheckedChange={setIsPremium} />
                    ) : (
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${isPremium ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-muted/30 text-muted-foreground'}`}>
                            {isPremium ? 'PREMIUM' : 'FREE'}
                        </div>
                    )}
                </div>

                {(isPremium || isEditing) && (
                    <div className={`space-y-2 transition-opacity duration-200 ${!isPremium && isEditing ? 'opacity-50 pointer-events-none' : ''}`}>
                        <Label htmlFor="priceEdit" className='text-sm font-bold uppercase tracking-wider text-muted-foreground'>Unlock Price (ULC)</Label>
                        {isEditing ? (
                            <div className="relative">
                                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                                <Input id="priceEdit" type="number" value={unlockPrice} onChange={(e) => setUnlockPrice(Number(e.target.value))} className="bg-input/50 pl-10 h-12 font-bold text-lg" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-3xl font-bold font-headline text-primary bg-primary/5 p-4 rounded-xl border border-primary/10">
                                <Coins className="w-8 h-8" /> {unlockPrice} <span className='text-sm font-normal text-muted-foreground'>ULC</span>
                            </div>
                        )}
                    </div>
                )}
              </div>
            </div>

            <div className="flex flex-col space-y-3 mt-8">
                <div className="flex gap-3">
                    {isEditing ? (
                        <Button onClick={handleUpdate} disabled={loading} className="w-full h-14 text-lg font-bold gap-2 rounded-2xl">
                            {loading ? <Loader2 className="animate-spin" /> : <><Save size={20}/> Save Changes</>}
                        </Button>
                    ) : (
                        <Button onClick={() => setIsEditing(true)} className="w-full h-14 text-lg font-bold gap-2 rounded-2xl shadow-lg shadow-primary/20">
                            <Pencil size={20}/> Edit Post
                        </Button>
                    )}
                </div>
                
                {isEditing && (
                    <Button variant="ghost" onClick={() => setIsEditing(false)} className="w-full rounded-2xl">Cancel</Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" disabled={loading} className='w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2 h-12 rounded-2xl'>
                        <Trash2 size={16}/> Delete Post
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className='rounded-[2rem]'>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this content?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. All earnings data will remain in the ledger, but the media and post will be gone forever.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className='rounded-xl'>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl">Yes, Delete Post</AlertDialogAction>
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
