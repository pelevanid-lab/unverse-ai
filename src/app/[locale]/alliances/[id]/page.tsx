"use client"

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, Shield, Zap, Info, Trophy, 
    LogOut, Trash2, ArrowLeft, Share2, 
    UserPlus, CheckCircle2, XCircle, Clock,
    Skull, Crown, Target, Settings
} from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { 
    getAlliance, getAllianceMembers, joinAllianceClient, leaveAllianceClient, isEligibleForReward,
    kickMemberClient, disbandAllianceClient
} from '@/lib/alliance-engine';
import { Alliance, AllianceMember } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/routing';

export default function AllianceDashboardPage() {
    const params = useParams();
    const allianceId = params.id as string;
    const t = useTranslations('Game');
    const router = useRouter();

    const { user, isConnected, connectWallet } = useWallet();
    const [alliance, setAlliance] = useState<Alliance | null>(null);
    const [members, setMembers] = useState<AllianceMember[]>([]);
    const [isMember, setIsMember] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isActing, setIsActing] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [a, m] = await Promise.all([
                    getAlliance(allianceId),
                    getAllianceMembers(allianceId)
                ]);
                setAlliance(a);
                setMembers(m);

                if (isConnected && user) {
                    const wallet = user.walletAddress || user.uid;
                    const me = m.find(mb => mb.walletAddress === wallet);
                    setIsMember(!!me);
                    setIsOwner(a?.founderAddress === wallet);
                }
            } catch (e) {
                console.error('Failed to load alliance details:', e);
            }
            setLoading(false);
        };
        load();
    }, [allianceId, isConnected, user]);

    const handleJoin = async () => {
        if (!user) return;
        setIsActing(true);
        try {
            const res = await joinAllianceClient({
                allianceId,
                walletAddress: user.walletAddress || user.uid
            });
            if (res.success) {
                window.location.reload();
            } else {
                alert(res.error);
            }
        } catch (e) {
            console.error(e);
        }
        setIsActing(false);
    };

    const handleLeave = async () => {
        if (!user) return;
        const confirmed = confirm("Are you sure you want to leave this alliance? Your contribution score for this team will be lost.");
        if (!confirmed) return;

        setIsActing(true);
        try {
            const res = await leaveAllianceClient({
                allianceId,
                walletAddress: user.walletAddress || user.uid
            });
            if (res.success) {
                router.push('/alliances');
            } else {
                alert(res.error);
            }
        } catch (e) {
            console.error(e);
        }
        setIsActing(false);
    };

    const handleKick = async (targetWallet: string) => {
        if (!user || !isOwner) return;
        const confirmed = confirm("Are you sure you want to kick this member?");
        if (!confirmed) return;

        setIsActing(true);
        try {
            const res = await kickMemberClient({
                allianceId,
                targetWallet,
                ownerAddress: user.walletAddress || user.uid
            });
            if (res.success) {
                setMembers(m => m.filter(mb => mb.walletAddress !== targetWallet));
            } else {
                alert(res.error);
            }
        } catch (e) {
            console.error(e);
        }
        setIsActing(false);
    };

    const handleDisband = async () => {
        if (!user || !isOwner) return;
        const confirmed = confirm("WARNING: This will permanently delete the alliance and remove all members. THIS ACTION CANNOT BE UNDONE. Confirm disbanding?");
        if (!confirmed) return;

        setIsActing(true);
        try {
            const res = await disbandAllianceClient({
                allianceId,
                ownerAddress: user.walletAddress || user.uid
            });
            if (res.success) {
                router.push('/alliances');
            } else {
                alert(res.error);
            }
        } catch (e) {
            console.error(e);
        }
        setIsActing(false);
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-yellow-500/40 border-t-yellow-500 rounded-full animate-spin" />
        </div>
    );

    if (!alliance) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <Skull className="w-16 h-16 opacity-10 mb-6" />
            <h1 className="text-2xl font-black mb-2">Alliance Not Detected</h1>
            <p className="text-muted-foreground text-center mb-8">This squad has been disbanded or never existed.</p>
            <Link href="/alliances"><Button variant="outline">Back to Hub</Button></Link>
        </div>
    );

    const totalScore = members.reduce((sum, m) => sum + m.contributionScore, 0);
    const slotsAvailable = 16 - alliance.memberCount;

    return (
        <div className="min-h-screen bg-background pb-32">
            {/* ── TOP ACTION BAR ── */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-4">
                <Link href="/alliances" className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1 flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-black text-yellow-500 italic bg-yellow-500/10 px-2 py-0.5 rounded">
                        [{alliance.symbol}]
                    </span>
                    <span className="font-headline font-black uppercase truncate">{alliance.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-2 text-muted-foreground">
                        <Share2 className="w-4 h-4" /> Share
                    </Button>
                    {!isMember && (
                        <Button 
                            onClick={handleJoin} 
                            disabled={slotsAvailable <= 0 || isActing}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-6 rounded-xl h-9"
                        >
                            {isActing ? 'Joining...' : 'Request Entry'}
                        </Button>
                    )}
                    {isMember && !isOwner && (
                        <Button 
                            onClick={handleLeave} 
                            disabled={isActing}
                            variant="ghost" 
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl h-9 gap-2"
                        >
                            <LogOut className="w-4 h-4" /> Leave
                        </Button>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    
                    {/* ── LEFT: TEAM CARD ── */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="p-8 rounded-3xl border border-white/10 bg-card/40 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-yellow-500 shadow-lg shadow-yellow-500/40" />
                            
                            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-transparent border border-white/10 mx-auto mb-6 flex items-center justify-center text-4xl font-black text-yellow-500 italic">
                                {alliance.symbol}
                            </div>
                            
                            <div className="text-center space-y-2 mb-8">
                                <h2 className="text-2xl font-black uppercase tracking-tight">{alliance.name}</h2>
                                <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase flex items-center justify-center gap-2">
                                    <Crown className="w-3 h-3 text-yellow-500" /> Lead: {alliance.founderAddress.slice(0, 6)}...{alliance.founderAddress.slice(-4)}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-8">
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                                    <div className="text-xl font-black text-foreground">{alliance.memberCount}</div>
                                    <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Hunters</div>
                                </div>
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                                    <div className="text-xl font-black text-yellow-400">{alliance.totalChestsFound}</div>
                                    <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Victories</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground mb-2">
                                        <span>Team Capacity</span>
                                        <span>{alliance.memberCount}/16</span>
                                    </div>
                                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-yellow-500 transition-all duration-1000" 
                                            style={{ width: `${(alliance.memberCount / 16) * 100}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/10">
                                    <div className="flex items-center gap-3 text-yellow-500/80 mb-1">
                                        <Trophy className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Total Earnings</span>
                                    </div>
                                    <div className="text-2xl font-black text-yellow-500">{alliance.totalRewardULC.toLocaleString()} <span className="text-xs opacity-50">ULC</span></div>
                                </div>
                            </div>

                            {isOwner && (
                                <div className="mt-8 pt-8 border-t border-white/5 space-y-3">
                                    <Button variant="outline" className="w-full border-white/10 hover:border-yellow-500/20 rounded-xl h-12 font-bold gap-2">
                                        <Settings className="w-4 h-4" /> Alliance Setup
                                    </Button>
                                    <Button 
                                        onClick={handleDisband}
                                        disabled={isActing}
                                        variant="ghost" 
                                        className="w-full text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl h-10 font-bold gap-2 text-xs"
                                    >
                                        <Trash2 className="w-4 h-4" /> Disband Alliance
                                    </Button>
                                    <p className="text-[9px] text-center text-muted-foreground mt-2 uppercase tracking-widest">Founding Rights Active</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT: MEMBERS & MINING ── */}
                    <div className="lg:col-span-2 space-y-8">
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-sm font-black tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Squad Roster
                                </h2>
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-black text-green-400">
                                    <Zap className="w-3 h-3" /> PPLNS Pool Active
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/5 bg-card/20 overflow-hidden divide-y divide-white/5">
                                {/* Table Header */}
                                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-white/5 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                    <div className="col-span-6">Hunter ID</div>
                                    <div className="col-span-2 text-center">Score</div>
                                    <div className="col-span-2 text-center">Share %</div>
                                    <div className="col-span-2 text-right">Status</div>
                                </div>

                                {members.map((member, i) => {
                                    const sharePct = totalScore > 0 ? (member.contributionScore / totalScore) * 100 : 0;
                                    const eligible = isEligibleForReward(member, totalScore);
                                    const isMe = user?.walletAddress === member.walletAddress || user?.uid === member.walletAddress;

                                    return (
                                        <motion.div 
                                            key={member.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className={`grid grid-cols-12 gap-4 px-6 py-5 items-center ${isMe ? 'bg-yellow-500/5' : ''}`}
                                        >
                                            <div className="col-span-6 flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                                                    {member.walletAddress === alliance.founderAddress ? <Crown className="w-5 h-5 text-yellow-500" /> : <Shield className="w-5 h-5 text-muted-foreground/40" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className={`font-bold truncate ${isMe ? 'text-yellow-400' : 'text-foreground'}`}>
                                                        {member.walletAddress.slice(0, 10)}...{member.walletAddress.slice(-6)}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-0.5">
                                                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="col-span-2 text-center">
                                                <div className="text-sm font-black text-foreground">{member.contributionScore.toLocaleString()}</div>
                                            </div>

                                            <div className="col-span-2 text-center">
                                                <div className={`text-sm font-black ${eligible ? 'text-green-400' : 'text-muted-foreground/30'}`}>
                                                    {sharePct.toFixed(1)}%
                                                </div>
                                            </div>

                                            <div className="col-span-2 text-right flex items-center justify-end gap-2">
                                                {isOwner && !isMe && (
                                                    <button 
                                                        onClick={() => handleKick(member.walletAddress)}
                                                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                                        title="Kick Member"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                {eligible ? (
                                                    <div className="inline-flex items-center gap-1.5 text-[9px] font-black text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                                                        <CheckCircle2 className="w-3 h-3" /> READY
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 text-[9px] font-black text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                                                        <Clock className="w-3 h-3" /> INACTIVE
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Eligibility explanation */}
                            <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-blue-400/80">
                                <Target className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div className="text-[11px] leading-relaxed">
                                    <span className="font-black text-blue-300">ELIGIBILITY PROTOCOL:</span> To remain in "READY" status for the next reward pool, a hunter must maintain at least <strong>2% of the total team score</strong> and have performed an action within the <strong>last 48 hours</strong>.
                                </div>
                            </div>
                        </div>

                        {/* Recent Team Activity */}
                        <div className="space-y-4">
                            <h2 className="text-sm font-black tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                                <History className="w-4 h-4" /> Tactical Logs
                            </h2>
                            <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 text-muted-foreground italic text-sm">
                                Initializing tactical log feed... No recent victories recorded in this fold.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function History({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="m12 7v5l4 2" />
        </svg>
    );
}
