
"use client"

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, CheckCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ImageUploaderProps {
  onUploadComplete: (url: string) => void;
  currentImageUrl?: string;
  label: string;
  recommendedSize: string;
  storagePath: string;
  previewType: 'avatar' | 'cover';
}

export function ImageUploader({ 
  onUploadComplete, 
  currentImageUrl, 
  label, 
  recommendedSize,
  storagePath,
  previewType
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentImageUrl);
  const { user } = useWallet();
  const { toast } = useToast();

  useEffect(() => {
    setPreviewUrl(currentImageUrl);
  }, [currentImageUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      toast({ variant: 'destructive', title: 'File too large', description: 'Please upload an image smaller than 2MB.' });
      return;
    }

    setUploading(true);
    setUploaded(false);
    
    const reader = new FileReader();
    reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const fileId = uuidv4();
      const fullStoragePath = `${storagePath}/${user.walletAddress}/${fileId}`;
      const storageRef = ref(storage, fullStoragePath);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      onUploadComplete(downloadURL);
      setUploaded(true);
      toast({ title: 'Upload successful!', description: `${label} has been updated.` });

    } catch (error) {
      console.error("Upload failed:", error);
      toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload the image.' });
      setPreviewUrl(currentImageUrl); // Revert on failure
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="font-medium">{label}</label>
        {previewUrl && previewType === 'cover' && (
            <div className="w-full aspect-[4/1] rounded-lg bg-muted overflow-hidden mb-2 relative">
                <img src={previewUrl} alt="Cover preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20"/>
            </div>
        )}
        <div className="flex items-center gap-4">
        {previewUrl && previewType === 'avatar' && <img src={previewUrl} alt={label} className="w-16 h-16 rounded-lg object-cover" />}
        <div className="flex-1">
            <label htmlFor={`file-upload-${label}`} className={`relative flex justify-center items-center w-full h-24 px-4 py-2 text-sm text-center border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploading ? 'bg-muted/50' : 'border-muted hover:border-primary/50'}`}>
                {uploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                ) : uploaded ? (
                    <div className='text-center text-green-500'>
                        <CheckCircle className="w-8 h-8 mx-auto mb-1"/>
                        <p className='text-sm font-bold'>Upload Complete</p>
                    </div>
                ) : (
                    <div className='text-center text-muted-foreground'>
                        <UploadCloud className="w-8 h-8 mx-auto mb-1"/>
                        <p className='text-sm font-bold'>Click or drag to upload</p>
                    </div>
                )}
                <input id={`file-upload-${label}`} type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" />
            </label>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Recommended size: {recommendedSize}. Max 2MB.</p>
    </div>
  );
}
