"use client"

import { useState } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { AlertCircle, Trash2, ChevronLeft, Loader2 } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from '@/components/ui/use-toast';

export default function UserProfileManagement() {
  const t = useTranslations('UserProfileManagement');
  const { isConnected, user, disconnectWallet } = useWallet();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isConnected || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <h1 className="text-3xl font-headline font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
        <Link href="/"><Button className="mt-4 rounded-xl px-8 py-6">Connect Wallet</Button></Link>
      </div>
    );
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const deleteFn = httpsCallable(functions, 'deleteUserAccount');
      await deleteFn();
      
      toast({
        title: t('deleteSuccess'),
        variant: "default",
      });

      // Disconnect and redirect
      await disconnectWallet();
      router.push('/');
    } catch (error: any) {
      console.error("Deletion error:", error);
      toast({
        title: t('deleteError'),
        description: error.message || "Unknown error",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 px-4 mt-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/mypage" className="p-2 hover:bg-white/5 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-4xl font-headline font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Security & Danger Zone */}
        <Card className="border-destructive/20 bg-destructive/5 overflow-hidden">
          <CardHeader className="bg-destructive/10 pb-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <CardTitle className="text-lg font-bold uppercase tracking-wider">{t('dangerZone')}</CardTitle>
            </div>
            <CardDescription className="text-destructive/80 font-medium">
              {t('deleteDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <p className="font-bold text-xl">{t('deleteAccount')}</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  {t('deleteConfirmDesc')}
                </p>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="lg" 
                    className="rounded-2xl h-14 px-8 font-bold shadow-xl shadow-destructive/20 gap-2 hover:scale-105 transition-transform"
                    disabled={isDeleting}
                  >
                    {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    {isDeleting ? t('deleting') : t('deleteAccount')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-card border-white/10 rounded-3xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-headline font-bold">{t('deleteConfirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('deleteConfirmDesc')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-3 mt-4">
                    <AlertDialogCancel className="rounded-xl border-white/10 hover:bg-white/5">{t('cancelButton')}</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteAccount();
                      }}
                      className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold"
                    >
                      {t('confirmButton')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
