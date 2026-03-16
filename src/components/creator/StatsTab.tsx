"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, Unlock, Users, FileText } from 'lucide-react';

export function StatsTab() {
  return (
    <Card className="glass-card border-white/10">
        <CardHeader>
            <CardTitle>Your Analytics</CardTitle>
            <CardDescription>An overview of your creator performance.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard icon={DollarSign} title="Total Earnings" value="--" description="Under Construction" />
                <StatCard icon={Unlock} title="Premium Unlocks" value="--" description="Under Construction" />
                <StatCard icon={Users} title="Subscribers" value="--" description="Under Construction" />
                <StatCard icon={FileText} title="Total Posts" value="--" description="Under Construction" />
            </div>
        </CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, title, value, description }: { icon: React.ElementType, title: string, value: string, description: string }) {
    return (
        <Card className="bg-muted/30 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
        </Card>
    )
}
