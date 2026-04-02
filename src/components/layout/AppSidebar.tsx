"use client"

import { Link, usePathname } from '@/i18n/routing';
import { 
  Home, 
  Sparkles, 
  LayoutDashboard, 
  Users, 
  User, 
  Menu, 
  Search, 
  Compass, 
  MessageSquare, 
  Heart, 
  PlusSquare,
  LogOut,
  Settings,
  Wallet,
  Coins,
  Flame
} from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function AppSidebar() {
  const t = useTranslations('Navbar');
  const tCreator = useTranslations('Creator');
  const tStudio = useTranslations('AIStudio');
  const pathname = usePathname();
  const { user, isConnected, connectWallet, disconnectWallet, isAdmin } = useWallet();
  const locale = useLocale();

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
      name: t('mypage'), // Unit
      href: '/mypage', 
      icon: User 
    },
    { 
      name: t('community'), // Unity
      href: '/community', 
      icon: Users 
    },
    { 
      name: t('tokenomics'), // Pre-sale / Ön Satış
      href: '/tokenomics', 
      icon: Coins 
    },
    { 
      name: t('staking'), // Unstake
      href: '/staking', 
      icon: Flame 
    },
    { 
      name: t('search'), 
      href: '/search', 
      icon: Search 
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r bg-background z-50 px-3 py-8">
      {/* Logo */}
      <div className="px-3 mb-10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-black/50 border border-white/5 shadow-lg shadow-primary/20">
            <img 
              src="/logo.png" 
              alt="Unverse Logo" 
              className="w-full h-full object-cover scale-[1.6]" 
              style={{ mixBlendMode: 'screen' }}
            />
          </div>
          <span className="font-headline text-2xl font-black tracking-tighter">UNVERSE</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-primary/10 text-primary font-bold' 
                  : item.href === '/tokenomics' 
                    ? 'hover:bg-white/5 text-yellow-500 hover:text-yellow-400 font-semibold'
                    : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'text-primary' : 'group-hover:scale-110 transition-transform'}`} />
              <span className="text-base flex items-center gap-2">
                {item.name}
                {item.href === '/staking' && (
                  <span className="text-[9px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-full border border-red-500/20 font-bold whitespace-nowrap hidden lg:inline-block">
                    EARN 🔥
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto space-y-2">
        {isConnected ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-4 px-3 py-6 rounded-xl hover:bg-white/5">
                <Avatar className="w-6 h-6 border border-white/10">
                  <AvatarImage src={user?.avatar || ""} />
                  <AvatarFallback className="bg-primary/20 text-[10px]">
                    {user?.username?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[120px]">{user?.username || "Account"}</span>
                <Menu className="w-4 h-4 ml-auto text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-white/10 rounded-xl overflow-hidden">
              <DropdownMenuItem className="py-3 cursor-pointer gap-3" asChild>
                <Link href="/creator/settings">
                  <Settings className="w-4 h-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="py-3 cursor-pointer gap-3" asChild>
                <Link href="/wallet">
                  <Wallet className="w-4 h-4" /> Wallet
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem className="py-3 cursor-pointer gap-3 text-red-400 focus:text-red-400 font-bold" asChild>
                  <Link href="/admin">
                    <LayoutDashboard className="w-4 h-4" /> Admin
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem 
                className="py-3 cursor-pointer gap-3 text-red-400 focus:text-red-400"
                onClick={disconnectWallet}
              >
                <LogOut className="w-4 h-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button 
            onClick={connectWallet} 
            className="w-full justify-start gap-4 px-3 py-6 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold"
          >
            <Wallet className="w-6 h-6" />
            <span>Connect</span>
          </Button>
        )}
      </div>
    </aside>
  );
}
