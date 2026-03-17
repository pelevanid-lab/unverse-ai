
"use client";

import { useState } from 'react';
import { CreatorMedia, ContentPost, UserProfile } from '@/lib/types';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Trash2, X, Calendar as CalendarIcon, Upload } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EditMediaModalProps {
  media: CreatorMedia;
  creatorProfile: UserProfile;
  onClose: () => void;
  onPublished: () => void;
}

export function EditMediaModal({ creatorProfile, media, onClose, onPublished }: EditMediaModalProps) {
  const { user } = useWallet();
  const { toast } = useToast();
  const [caption, setCaption] = useState(media.caption || '');
  const [isPremium, setIsPremium] = useState(media.isPremium || false);
  const [priceULC, setPriceULC] = useState(media.priceULC || 10);
  const [loadingAction, setLoadingAction] = useState<'publish' | 'schedule' | 'delete' | null>(null);
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(
    media.status === 'scheduled' && media.scheduledFor ? new Date(media.scheduledFor) : undefined
  );

  const handlePublish = async () => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "Please ensure your wallet is connected." });
      return;
    }

    setLoadingAction('publish');
    try {
      const postData: Omit<ContentPost, 'id'> = {
        creatorId: user.uid,
        creatorName: creatorProfile.username,
        creatorAvatar: creatorProfile.avatar,
        mediaUrl: media.mediaUrl,
        mediaType: media.mediaType,
        caption: caption,
        isPremium: isPremium,
        priceULC: isPremium ? priceULC : 0,
        createdAt: Date.now(),
        likes: 0,
        unlockCount: 0,
        earningsULC: 0,
      };

      await addDoc(collection(db, 'posts'), postData);
      await deleteDoc(doc(db, 'creator_media', media.id));
      
      toast({ title: 'Post Published!', description: 'Your content is now live.' });
      onPublished();
      onClose();
    } catch (error) {
      console.error("Publishing failed:", error);
      toast({ variant: 'destructive', title: 'Publishing Failed' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleScheduleOrUpdate = async () => {
    if (!scheduledFor) {
      toast({ variant: 'destructive', title: 'Please select a date and hour for scheduling.' });
      return;
    }
    setLoadingAction('schedule');
    try {
      const finalScheduleTime = new Date(scheduledFor);
      finalScheduleTime.setMinutes(0, 0, 0);

      await updateDoc(doc(db, 'creator_media', media.id), {
        status: 'scheduled',
        scheduledFor: finalScheduleTime.getTime(),
        caption,
        isPremium,
        priceULC: isPremium ? priceULC : 0,
      });
      toast({ title: 'Post Scheduled Successfully!', description: `Your post is scheduled for ${format(finalScheduleTime, "PPP 'at' HH:00")}.` });
      onClose();
    } catch (error) {
      console.error("Scheduling/updating failed:", error);
      toast({ variant: 'destructive', title: 'Action Failed' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    setLoadingAction('delete');
    try {
      const fileRef = ref(storage, media.mediaUrl);
      await deleteObject(fileRef);
      await deleteDoc(doc(db, 'creator_media', media.id));
      toast({ title: 'Media Deleted' });
      onClose();
    } catch (error) {
      console.error("Delete failed:", error);
      toast({ variant: 'destructive', title: 'Delete Failed' });
    } finally {
      setLoadingAction(null);
    }
  };

  const isScheduled = media.status === 'scheduled';

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-full max-h-[90vh] flex flex-col glass-card p-0">
           <Button onClick={onClose} className="absolute top-2 right-2 z-50 h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-black/80">
              <X className="h-4 w-4" />
          </Button>
          <DialogTitle className="sr-only">Edit Media</DialogTitle>
          <DialogDescription className="sr-only">Prepare your media for publishing, scheduling, or deletion.</DialogDescription>

          <div className="grid grid-cols-1 md:grid-cols-10 h-full overflow-hidden">
              <div className="md:col-span-6 flex items-center justify-center bg-black/80 overflow-hidden">
                  {media.mediaType === 'image' ? (
                      <img src={media.mediaUrl} alt="Preview" className="max-w-full max-h-full w-auto h-auto object-contain"/>
                  ) : (
                      <video src={media.mediaUrl} controls autoPlay className="max-w-full max-h-full w-auto h-auto" />
                  )}
              </div>
              <div className="md:col-span-4 flex flex-col justify-between p-6 bg-background/50 overflow-y-auto">
                  <div className="space-y-4">
                      <div>
                          <Label htmlFor="caption" className='text-base'>Caption</Label>
                          <Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a catchy caption..." className="mt-2 bg-input/50" rows={1} maxLength={140} />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-4 bg-black/20">
                          <div className='space-y-1'>
                            <Label htmlFor="isPremium" className='text-base'>Premium Content</Label>
                            <p className='text-xs text-muted-foreground'>Charge a fee for unlocking this post.</p>
                          </div>
                          <Switch id="isPremium" checked={isPremium} onCheckedChange={setIsPremium} />
                      </div>
                      {isPremium && (
                          <div>
                              <Label htmlFor="price" className='text-base'>Price (in ULC)</Label>
                              <Input id="price" type="number" value={priceULC} onChange={(e) => setPriceULC(Number(e.target.value))} placeholder='e.g., 10' className="mt-2 bg-input/50" />
                          </div>
                      )}
                       <div className="space-y-3 pt-3">
                          <Label className='text-base'>{isScheduled ? 'Update Schedule' : 'Schedule Post'}</Label>
                          <Popover>
                              <PopoverTrigger asChild>
                                  <Button
                                      variant={"outline"}
                                      className={cn(
                                          "w-full justify-start text-left font-normal h-11",
                                          !scheduledFor && "text-muted-foreground"
                                      )}
                                  >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {scheduledFor ? format(scheduledFor, "PPP") : <span>Pick a date</span>}
                                  </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                  <Calendar
                                      mode="single"
                                      selected={scheduledFor}
                                      onSelect={(date) => {
                                          const newDate = date || new Date();
                                          const currentHour = scheduledFor?.getHours() || new Date().getHours();
                                          newDate.setHours(currentHour);
                                          setScheduledFor(newDate);
                                      }}
                                      initialFocus
                                  />
                              </PopoverContent>
                          </Popover>
                           <Select
                              value={scheduledFor ? String(scheduledFor.getHours()) : undefined}
                              onValueChange={(value) => {
                                  const hour = parseInt(value, 10);
                                  const newDate = scheduledFor ? new Date(scheduledFor) : new Date();
                                  newDate.setHours(hour);
                                  setScheduledFor(newDate);
                              }}
                          >    
                              <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Select hour" />
                              </SelectTrigger>
                              <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => (
                                      <SelectItem key={i} value={String(i)}>
                                          {String(i).padStart(2, '0')}:00
                                      </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
                  <div className="flex flex-col space-y-3 mt-4">
                      <Button onClick={handlePublish} disabled={!!loadingAction} className='h-12 w-full text-lg font-bold gap-2'>
                          {loadingAction === 'publish' ? <Loader2 className="animate-spin" /> : <><Upload size={18}/>Publish Now</>}
                      </Button>
                       <Button onClick={handleScheduleOrUpdate} disabled={!!loadingAction || !scheduledFor} className='h-12 w-full gap-2'>
                           {loadingAction === 'schedule' ? <Loader2 className="animate-spin" /> : <><CalendarIcon size={16}/>{isScheduled ? 'Update Schedule' : 'Confirm Schedule'}</>}
                      </Button>
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="ghost" disabled={!!loadingAction} className='w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2'>
                                  {loadingAction === 'delete' ? <Loader2 className="animate-spin h-4 w-4"/> : <><Trash2 size={16}/> Delete Media</>}
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      This will permanently delete the media file from your container. This action cannot be undone.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Yes, Delete It</AlertDialogAction>
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
