"use client"

import { Link, usePathname } from '@/i18n/routing';
import { 
  Home, 
  Sparkles, 
  LayoutDashboard, 
  Users, 
  User as UserIcon
} from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function MobileBottomNav() {
  const t = useTranslations('Navbar');
  const tCreator = useTranslations('Creator');
  const pathname = usePathname();
  const { user, isConnected } = useWallet();

  const navItems = [
    { 
      name: t('discover'), // Unfold
      href: '/', 
      icon: Home 
    },
    { 
      name: "Uniq", 
      href: '/uniq', 
      icon: Sparkles 
    },
    { 
      name: tCreator('panelTitle'), // Creator Panel
      href: '/creator', 
      icon: LayoutDashboard 
    },
    { 
      name: t('community'), // Unity
      href: '/community', 
      icon: Users 
    },
    { 
      name: t('mypage'), // Unit
      href: '/mypage', 
      icon: UserIcon 
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-xl border-t z-50 flex lg:hidden items-center justify-around px-4 pb-safe">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link 
            key={item.href} 
            href={item.href}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground active:scale-90'
            }`}
          >
            {item.name === t('mypage') && isConnected && user?.avatar ? (
                <div className={`p-0.5 rounded-full border-2 ${isActive ? 'border-primary scale-110' : 'border-transparent'}`}>
                    <Avatar className="w-5 h-5">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="text-[8px] bg-primary/20">{user.username?.charAt(0)}</AvatarFallback>
                    </Avatar>
                </div>
            ) : (
                <Icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
