"use client"

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Search as SearchIcon, Users, ArrowRight, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function SearchPage() {
  const t = useTranslations('SearchPage');
  const [searchQuery, setSearchQuery] = useState('');
  const [creators, setCreators] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCreators = async () => {
      try {
        const q = query(collection(db, 'users'), where('isCreator', '==', true));
        const querySnapshot = await getDocs(q);
        const creatorsList: UserProfile[] = [];
        querySnapshot.forEach((doc) => {
          creatorsList.push(doc.data() as UserProfile);
        });
        setCreators(creatorsList);
      } catch (error) {
        console.error("Error fetching creators:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCreators();
  }, []);

  const filteredCreators = creators.filter(creator => 
    creator.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8 pb-24 lg:pb-8">
      {/* Header */}
      <div className="mb-10 text-center lg:text-left">
        <h1 className="text-4xl font-headline font-black tracking-tight mb-2 uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">
          {t('title')}
        </h1>
        <p className="text-muted-foreground text-lg italic">
          {t('subtitle')}
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-12 group max-w-2xl mx-auto lg:mx-0">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <SearchIcon className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <Input
          type="text"
          placeholder={t('placeholder')}
          className="w-full bg-card/40 backdrop-blur-xl border-white/5 h-16 pl-12 pr-4 rounded-2xl text-lg font-medium ring-offset-background placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-2xl shadow-black/20"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Results */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight uppercase italic">
            {searchQuery ? t('title') : t('allCreators')}
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent ml-4" />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="bg-card/20 border-white/5 rounded-2xl overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-16 h-16 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCreators.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCreators.map((creator) => (
              <Link key={creator.uid} href={`/profile/${creator.uid}`}>
                <Card className="group bg-card/20 hover:bg-card/40 border-white/5 hover:border-primary/30 rounded-2xl transition-all duration-300 overflow-hidden cursor-pointer shadow-xl hover:shadow-primary/5">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="w-16 h-16 border-2 border-white/5 group-hover:border-primary/50 transition-colors shadow-lg shadow-black/40">
                          <AvatarImage src={creator.avatar} />
                          <AvatarFallback className="bg-primary/20 text-lg font-bold">
                            {creator.username?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {creator.featured && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-card shadow-lg">
                            <SparkleIcon className="w-3 h-3 text-white fill-current" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors tracking-tight">
                          {creator.username}
                        </h3>
                        {creator.bio && (
                          <p className="text-muted-foreground text-sm line-clamp-1 italic">
                            {creator.bio}
                          </p>
                        )}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all duration-300">
                        <ArrowRight className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-card/10 rounded-3xl border border-dashed border-white/5">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
              <SearchIcon className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-xl font-bold mb-2">
              {t('noResults', { query: searchQuery })}
            </h3>
            <Button 
                variant="outline" 
                className="mt-4 rounded-xl border-white/10 hover:bg-white/5"
                onClick={() => setSearchQuery('')}
            >
              Show all creators
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}
