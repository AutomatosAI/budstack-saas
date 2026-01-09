
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';

export default async function CustomersListPage() {
    const session = await getServerSession(authOptions);

    if (!session || !['TENANT_ADMIN', 'SUPER_ADMIN'].includes(session.user.role!)) {
        redirect('/auth/login');
    }

    // Tenant admins only see their own customers
    const tenantId = session.user.role === 'TENANT_ADMIN' ? session.user.tenantId : undefined;

    if (!tenantId && session.user.role === 'TENANT_ADMIN') {
        redirect('/auth/login');
    }

    // Get customers count
    const customersCount = await prisma.users.count({
        where: {
            role: 'PATIENT',
            ...(tenantId && { tenantId }),
        },
    });

    // Get recent customers
    const customers = await prisma.users.findMany({
        where: {
            role: 'PATIENT',
            ...(tenantId && { tenantId }),
        },
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            _count: {
                select: {
                    orders: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
    });

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Customer Management</h1>
                <p className="text-slate-600 mt-2">Manage your customer base</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="border-none shadow-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-white overflow-hidden relative group hover:shadow-xl transition-shadow duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-cyan-50">Total Customers</CardTitle>
                        <Users className="h-5 w-5 text-cyan-100" />
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-bold">{customersCount}</div>
                        <p className="text-xs mt-2 text-cyan-100">Registered users</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white overflow-hidden relative group hover:shadow-xl transition-shadow duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-emerald-50">Active Customers</CardTitle>
                        <Users className="h-5 w-5 text-emerald-100" />
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-bold">{customers.length}</div>
                        <p className="text-xs mt-2 text-emerald-100">Currently active</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white overflow-hidden relative group hover:shadow-xl transition-shadow duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-purple-50">Recent Sign-ups</CardTitle>
                        <Users className="h-5 w-5 text-purple-100" />
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-bold">
                            {customers.filter((c: any) => {
                                const thirtyDaysAgo = new Date();
                                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                                return new Date(c.createdAt) > thirtyDaysAgo;
                            }).length}
                        </div>
                        <p className="text-xs mt-2 text-purple-100">Last 30 days</p>
                    </CardContent>
                </Card>
            </div>

            {/* Customers Table */}
            <Card className="shadow-lg border-slate-200">
                <CardHeader className="border-b bg-gradient-to-r from-cyan-50 to-blue-50">
                    <CardTitle className="text-2xl font-bold text-slate-900">All Customers</CardTitle>
                    <CardDescription className="text-slate-600">Manage your customer base</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Name</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Email</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Orders</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Joined</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((customer: any) => (
                                    <tr key={customer.id} className="border-b border-slate-200 hover:bg-slate-50">
                                        <td className="py-3 px-4 text-slate-900">{customer.name || 'N/A'}</td>
                                        <td className="py-3 px-4 text-slate-700">{customer.email}</td>
                                        <td className="py-3 px-4 text-slate-700">{customer._count.orders}</td>
                                        <td className="py-3 px-4 text-slate-700">{new Date(customer.createdAt).toLocaleDateString()}</td>
                                        <td className="py-3 px-4">
                                            <Link href={`/tenant-admin/customers/${customer.id}`}>
                                                <Button
                                                    size="sm"
                                                    className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium shadow-sm hover:shadow transition-all"
                                                >
                                                    View Details
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {customers.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-slate-500">
                                            No customers yet
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
