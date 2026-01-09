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

interface CustomerActionsProps {
    customer: {
        id: string;
        name: string | null;
        email: string;
    };
}

export default function CustomerActions({ customer }: CustomerActionsProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const deleteCustomer = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/tenant-admin/customers/${customer.id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Failed to delete customer');

            toast.success('Customer deleted successfully (GDPR compliant)');
            router.push('/tenant-admin/customers');
        } catch (error) {
            toast.error('Failed to delete customer');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="space-y-2">
                <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowDeleteDialog(true)}
                >
                    Delete Customer (GDPR)
                </Button>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>GDPR Compliant Deletion</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will anonymize all personal data for <strong>{customer.name || customer.email}</strong>.
                            The customer record will be kept for order history integrity but all PII will be removed.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={deleteCustomer}
                            disabled={isLoading}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isLoading ? 'Deleting...' : 'Delete Customer Data'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
