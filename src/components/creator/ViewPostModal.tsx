
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
import { Loader2, Trash2, X, Pencil, Save } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ViewPostModalProps {
  post: ContentPost;
  onClose: () => void;
}

export function ViewPostModal({ post, onClose }: ViewPostModalProps) {
  const { toast } = useToast();
  const [caption, setCaption] = useState(post.caption);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCaption(post.caption);
    setIsEditing(false);
  }, [post]);

  const handleUpdate = async () => {
    if (caption === post.caption) {
        setIsEditing(false);
        return;
    }
    setLoading(true);
    try {
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, { caption });
      toast({ title: 'Post Updated Successfully!' });
      setIsEditing(false);
      // No need to call onClose(), we want the modal to stay open.
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
      const fileRef = ref(storage, post.mediaUrl);
      await deleteObject(fileRef);
      toast({ title: 'Post Deleted Successfully' });
      onClose();
    } catch (error) {
      console.error("Delete failed:", error);
      toast({ variant: 'destructive', title: 'Failed to Delete Post' });
    } finally {
      setLoading(false);
    }
  };
  
  const isImage = post.mediaUrl.includes('.webp') || post.mediaUrl.includes('.png') || post.mediaUrl.includes('.jpg') || post.mediaUrl.includes('.jpeg') || post.mediaUrl.includes('image');

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-full max-h-[90vh] flex flex-col glass-card p-0">
        <Button onClick={onClose} className="absolute top-2 right-2 z-50 h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-black/80">
            <X className="h-4 w-4" />
        </Button>
        <DialogTitle className="sr-only">{isEditing ? 'Edit Post' : 'View Post'}</DialogTitle>
        <DialogDescription className="sr-only">Manage your published post. You can edit the caption or delete it permanently.</DialogDescription>
        
        <div className="grid grid-cols-1 md:grid-cols-10 h-full overflow-hidden">
          <div className="md:col-span-6 flex items-center justify-center bg-black/80 overflow-hidden">
            {isImage ? (
              <img src={post.mediaUrl} alt={post.caption || 'post'} className="max-w-full max-h-full w-auto h-auto object-contain"/>
            ) : (
              <video src={post.mediaUrl} controls autoPlay className="max-w-full max-h-full w-auto h-auto" />
            )}
          </div>
          <div className="md:col-span-4 flex flex-col justify-between p-6 bg-background/50 overflow-y-auto">
            <div className="space-y-4">
              <Label htmlFor="caption" className="text-lg font-medium">Caption</Label>
              {isEditing ? (
                <Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} className="h-40 bg-input/50" />
              ) : (
                <p className="text-sm text-muted-foreground min-h-[10rem] whitespace-pre-wrap border rounded-md p-3 bg-black/20">{caption || 'No caption provided.'}</p>
              )}
            </div>
            <div className="flex flex-col space-y-3 mt-4">
                <div className="flex gap-3">
                    {isEditing ? (
                        <Button onClick={handleUpdate} disabled={loading} className="w-full h-11 gap-2">
                            {loading ? <Loader2 className="animate-spin" /> : <><Save size={16}/> Save Changes</>}
                        </Button>
                    ) : (
                        <Button onClick={() => setIsEditing(true)} className="w-full h-11 gap-2">
                            <Pencil size={16}/> Edit Caption
                        </Button>
                    )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={loading} className='w-full h-11 gap-2'>
                        <Trash2 size={16}/> Delete Post
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your post from your profile, and remove its data from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Continue Deleting</AlertDialogAction>
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
