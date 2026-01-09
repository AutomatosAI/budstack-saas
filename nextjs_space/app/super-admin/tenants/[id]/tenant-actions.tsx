'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TenantActionsProps {
  tenant: {
    id: string;
    businessName: string;
    isActive: boolean;
  };
}

export default function TenantActions({ tenant }: TenantActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const toggleTenantStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}/toggle-active`, {
        method: 'PATCH',
      });

      if (!res.ok) throw new Error('Failed to update tenant');

      toast.success(`Tenant ${tenant.isActive ? 'deactivated' : 'activated'} successfully`);
      router.refresh();
    } catch (error) {
      toast.error('Failed to update tenant status');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTenant = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete tenant');

      toast.success('Tenant deleted successfully');
      router.push('/super-admin/tenants');
    } catch (error) {
      toast.error('Failed to delete tenant');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <Button
          variant={tenant.isActive ? 'destructive' : 'default'}
          className="w-full"
          onClick={toggleTenantStatus}
          disabled={isLoading}
        >
          {tenant.isActive ? 'Deactivate Tenant' : 'Activate Tenant'}
        </Button>

        <Button
          variant="destructive"
          className="w-full"
          onClick={() => setShowDeleteDialog(true)}
        >
          Delete Tenant
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the tenant <strong>{tenant.businessName}</strong> and
              all associated data including users, products, and orders. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTenant}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? 'Deleting...' : 'Delete Tenant'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
