"use client";

import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { CreatorMedia, UserProfile, CreatorProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2, Video, Calendar } from 'lucide-react';
import { EditMediaModal } from './EditMediaModal';

export function ContainerTab() {
  const { user } = useWallet();
  const { toast } = useToast();
  const [mediaItems, setMediaItems] = useState<CreatorMedia[]>([]);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<CreatorMedia | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effect to fetch the creator's profile
  useEffect(() => {
    if (!user?.walletAddress) return;

    const profileDocRef = doc(db, 'creators', user.walletAddress);
    getDoc(profileDocRef).then(docSnap => {
      if (docSnap.exists()) {
        setCreatorProfile(docSnap.data() as CreatorProfile);
      } else {
        console.error("Creator profile not found in 'creators' collection!");
        toast({ variant: "destructive", title: "Error", description: "Could not load creator profile. Please try again later." });
      }
    });
  }, [user?.walletAddress, toast]);

  // Effect to fetch media items
  useEffect(() => {
    if (!user?.walletAddress) return;

    setLoading(true);
    const q = query(
      collection(db, 'creator_media'),
      where('creatorId', '==', user.walletAddress),
      where('status', 'in', ['draft', 'scheduled']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreatorMedia));
      setMediaItems(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.walletAddress]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.walletAddress) return;

    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    const mediaType = allowedImageTypes.includes(file.type) ? 'image' : allowedVideoTypes.includes(file.type) ? 'video' : null;

    if (!mediaType) {
      toast({ variant: 'destructive', title: 'Unsupported File Type', description: 'Please upload JPG, PNG, WEBP, MP4, MOV or WEBM files.' });
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `creator_media/${user.walletAddress}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {},
        (error) => {
          console.error("Upload failed:", error);
          toast({ variant: 'destructive', title: 'Upload Failed' });
          setUploading(false);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
            await addDoc(collection(db, 'creator_media'), {
              creatorId: user.walletAddress,
              mediaUrl: downloadURL,
              mediaType,
              caption: '',
              isPremium: false,
              priceULC: 0,
              status: 'draft',
              createdAt: serverTimestamp(),
            });
            toast({ title: 'Upload Complete', description: 'Your media is now in the container.' });
            setUploading(false);
          });
        }
      );
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({ variant: 'destructive', title: 'Upload Error' });
      setUploading(false);
    }
  };

  return (
    <Card className="glass-card border-white/10">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Container</CardTitle>
          <p className="text-muted-foreground text-sm">Prepare your media for publishing.</p>
        </div>
        <Button onClick={handleUploadClick} disabled={uploading || !creatorProfile}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Upload Media
        </Button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : mediaItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Your container is empty.</p>
            <p>Upload photos and videos to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {mediaItems.map(item => (
              <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-black/50" onClick={() => setSelectedMedia(item)}>
                {item.mediaType === 'image' ? (
                    <img src={item.mediaUrl} alt={item.caption || 'media'} className="w-full h-full object-cover" />
                ) : (
                    <video src={item.mediaUrl} muted loop playsInline className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors" />
                {item.mediaType === 'video' && <Video className="absolute top-2 left-2 h-5 w-5 text-white" />}
                {item.status === 'scheduled' && <Calendar className="absolute top-2 right-2 h-5 w-5 text-white bg-primary/80 p-1 rounded-full" />}
                 <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                    <p className='text-xs font-bold truncate'>{item.caption || 'Untitled'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {selectedMedia && creatorProfile && (
        <EditMediaModal
          media={selectedMedia}
          creatorProfile={creatorProfile} // Pass the fetched creator profile
          onClose={() => setSelectedMedia(null)}
          onPublished={() => setMediaItems(prev => prev.filter(item => item.id !== selectedMedia.id))}
        />
      )}
    </Card>
  );
}
