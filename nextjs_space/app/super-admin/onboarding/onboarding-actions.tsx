
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

export default function OnboardingActions({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const approveTenant = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });

      if (!res.ok) throw new Error('Failed to approve tenant');

      toast.success('Tenant approved successfully');
      router.refresh();
    } catch (error) {
      toast.error('Failed to approve tenant');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const rejectTenant = async () => {
    if (!confirm('Are you sure you want to reject this tenant? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to reject tenant');

      toast.success('Tenant rejected');
      router.refresh();
    } catch (error) {
      toast.error('Failed to reject tenant');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={approveTenant}
        disabled={isLoading}
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={rejectTenant}
        disabled={isLoading}
      >
        Reject
      </Button>
    </div>
  );
}
