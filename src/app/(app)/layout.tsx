
"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutGrid,
  CheckCircle,
  Target,
  PieChart,
  LogOut,
  Settings,
  CreditCard,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '@/hooks/use-app';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarInset } from '@/components/ui/sidebar';
import { DashboardHeader } from '@/components/dashboard-header';
import Chatbot from '@/components/chatbot';
import { Logo } from '@/components/logo';
import { AI_DISABLED } from '@/lib/ai-disabled';

const navItems = [
  { href: '/dashboard', icon: <LayoutGrid />, label: 'Dashboard' },
  { href: '/check-in', icon: <CheckCircle />, label: 'Daily Check-in' },
  { href: '/goals', icon: <Target />, label: 'Goals' },
  { href: '/expenses', icon: <PieChart />, label: 'Expenses' },
  { href: '/fixed-expenses', icon: <CreditCard />, label: 'Fixed Expenses' },
  { href: '/emergency-fund', icon: <ShieldAlert />, label: 'Emergency Fund' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user, profile, authLoaded, importTransactions } = useApp();
  const [gmailAutoSynced, setGmailAutoSynced] = useState(false);

  useEffect(() => {
    if (!authLoaded) return;
    // If we've checked auth and there's no user, send them to login
    if (user === null) {
        router.replace('/login');
    }
  }, [authLoaded, user, router]);

  useEffect(() => {
    // Auto-sync Gmail once per app session (best-effort)
    if (!authLoaded || !user || gmailAutoSynced) return;
    if (pathname === '/onboarding') return;

    const run = async () => {
      try {
        const token = await user.getIdToken();
        const statusRes = await fetch('/api/gmail/status', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = await statusRes.json();
        if (!statusRes.ok || !status?.connected) return;

        // If last sync was within 6 hours, skip.
        const last = status.lastSyncedAt ? Date.parse(status.lastSyncedAt) : 0;
        const ageMs = Date.now() - (Number.isFinite(last) ? last : 0);
        if (last && ageMs < 6 * 60 * 60 * 1000) return;

        const syncRes = await fetch('/api/gmail/sync', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ maxMessages: 25 }),
        });
        const data = await syncRes.json();
        if (!syncRes.ok) return;

        const imported = (data.transactions || []) as any[];
        if (imported.length) {
          importTransactions(
            imported.map((t) => ({
              id: t.id,
              amount: t.amount,
              category: t.category,
              description: t.description,
              date: t.date,
              importSource: t.importSource,
              importMessageId: t.importMessageId,
              importRef: t.importRef,
            }))
          );
        }
      } catch {
        // silent best-effort
      } finally {
        setGmailAutoSynced(true);
      }
    };

    run();
  }, [authLoaded, user, gmailAutoSynced, pathname, importTransactions]);

  useEffect(() => {
    if (!authLoaded || !user) return;
    const hasCompletedOnboarding = profile && profile.role;
    const isOnboardingPage = pathname === '/onboarding';

    if (hasCompletedOnboarding && isOnboardingPage) {
        router.replace('/dashboard');
    } else if (!hasCompletedOnboarding && !isOnboardingPage) {
        router.replace('/onboarding');
    }
  }, [authLoaded, user, profile, pathname, router]);

  if (!authLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading your experience...</p>
      </div>
    );
  }

  if (user === null || !profile?.role) {
    // Show onboarding page if applicable, otherwise show a loading state while redirects occur
    if (pathname === '/onboarding') {
      return <>{children}</>;
    }

    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading your experience...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-secondary/50">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                  <img
                    src="/POCKETMATE.png"
                    alt="PocketMate"
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>
                <span className="font-bold text-lg text-[#4ADE80]">PocketMate</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href}>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      tooltip={item.label}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
             <SidebarMenu>
                <SidebarMenuItem>
                    <Link href="/settings">
                        <SidebarMenuButton tooltip="Settings" isActive={pathname === '/settings'}>
                            <Settings />
                            <span>Settings</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Log Out" onClick={logout}>
                        <LogOut />
                        <span>Log Out</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
             </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <SidebarInset>
            <main className="flex-1 p-4 md:p-6 lg:p-8">
              {children}
            </main>
          </SidebarInset>
        </div>
        {!AI_DISABLED && <Chatbot />}
      </div>
    </SidebarProvider>
  );
}
