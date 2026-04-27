'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { AdminSidebar } from '@/components/layout/AdminSidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    // Allow access to login page without auth
    if (pathname === '/admin/login') return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }

    // Redirect to login if not a super admin
    if (!user?.isSuperAdmin) {
      router.push('/admin/login');
      return;
    }
  }, [isClient, isAuthenticated, user, router, pathname]);

  // Show loading while checking client state
  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  // Allow login page without authentication
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Show loading while redirecting
  if (!isAuthenticated || !user?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      <AdminSidebar />
      <main className="flex-1 lg:ml-0">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
