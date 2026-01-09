
import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CustomerEditForm from './customer-edit-form';
import CustomerActions from './customer-actions';
import { Breadcrumbs } from '@/components/admin/shared';

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);

    if (!session || !['TENANT_ADMIN', 'SUPER_ADMIN'].includes(session.user.role!)) {
        redirect('/auth/login');
    }

    // Tenant admins can only access their own tenant's customers
    const tenantId = session.user.role === 'TENANT_ADMIN' ? session.user.tenantId : undefined;

    const customer = await prisma.users.findFirst({
        where: {
            id: params.id,
            role: 'PATIENT',
            ...(tenantId && { tenantId }),
        },
        include: {
            _count: {
                select: {
                    orders: true,
                    consultations: true,
                },
            },
        },
    });

    if (!customer) {
        notFound();
    }

    // Verify tenant access for tenant admins
    if (session.user.role === 'TENANT_ADMIN' && customer.tenantId !== tenantId) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-gray-50 theme-force-light">
            <div className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {/* Breadcrumbs */}
                    <Breadcrumbs
                        items={[
                            { label: 'Dashboard', href: '/tenant-admin' },
                            { label: 'Customers', href: '/tenant-admin/customers' },
                            { label: customer.name || customer.email || 'Customer Details' },
                        ]}
                        className="mb-4"
                    />
                    <div className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-gray-900">{customer.name || customer.email}</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Customer Details */}
                    <div className="lg:col-span-2 space-y-6">
                        <CustomerEditForm customer={customer} />

                        {/* Order History */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Order History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-500">
                                    Total Orders: <span className="font-semibold">{customer._count.orders}</span>
                                </p>
                                <p className="text-sm text-gray-500 mt-2">
                                    Integration with Dr. Green API for detailed order history
                                </p>
                            </CardContent>
                        </Card>

                        {/* Consultation History */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Consultation History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-500">
                                    Total Consultations: <span className="font-semibold">{customer._count.consultations}</span>
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Actions */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Actions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CustomerActions customer={customer} />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
