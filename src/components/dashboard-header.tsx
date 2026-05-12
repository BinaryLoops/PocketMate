
"use client";

import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ExportReport from '@/components/export-report';
import { PdfExport } from '@/components/pdf-export';
import { useApp } from '@/hooks/use-app';

const pageTitles: { [key: string]: string } = {
  '/dashboard': 'Dashboard Overview',
  '/check-in': 'Daily Expense Check-in',
  '/goals': 'Financial Goals',
  '/expenses': 'Expense Analysis',
  '/fixed-expenses': 'Fixed Expenses Analysis',
  '/emergency-fund': 'Emergency Fund',
  '/onboarding': 'Welcome to PocketMate',
  '/settings': 'Profile Settings',
};

export function DashboardHeader() {
  const pathname = usePathname();
  const { profile, user } = useApp();
  
  const displayName = profile?.name ?? user?.displayName;
  const title = (displayName && pathname === '/dashboard')
    ? `Hello, ${displayName.split(' ')[0]}!`
    : pageTitles[pathname] || 'PocketMate';

  const getInitials = (emailOrName: string | undefined) => {
    if (!emailOrName) return 'U';
    // If it's a name with spaces, use initials of first/last name
    if (emailOrName.includes(' ')) {
        const parts = emailOrName.split(' ');
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    // Otherwise, use the first letter (for email or single name)
    return emailOrName.charAt(0).toUpperCase();
  }
  
  const avatarIdentifier = profile?.name || user?.displayName || user?.email || 'user';

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <SidebarTrigger className="md:hidden" />
      <h1 className="flex-1 text-xl font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-2 mr-3">
        <ExportReport />
        <PdfExport />
      </div>
      <Avatar>
        <AvatarImage src={`https://avatar.vercel.sh/${avatarIdentifier}.png`} />
        <AvatarFallback>{getInitials(avatarIdentifier)}</AvatarFallback>
      </Avatar>
    </header>
  );
}
