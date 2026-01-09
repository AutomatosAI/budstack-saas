import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { CustomersTable } from './customers-table';

/** Default pagination settings */
const DEFAULT_PAGE_SIZE = 20;
const VALID_PAGE_SIZES = [10, 20, 50, 100];

/** Valid sort columns for customers table */
const VALID_SORT_COLUMNS = ['name', 'email', 'createdAt'] as const;
type SortColumn = typeof VALID_SORT_COLUMNS[number];

interface CustomersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CustomersListPage({ searchParams }: CustomersPageProps) {
  const session = await getServerSession(authOptions);

  if (!session || !['TENANT_ADMIN', 'SUPER_ADMIN'].includes(session.user.role!)) {
    redirect('/auth/login');
  }

  // Tenant admins only see their own customers
  const tenantId = session.user.role === 'TENANT_ADMIN' ? session.user.tenantId : undefined;

  if (!tenantId && session.user.role === 'TENANT_ADMIN') {
    redirect('/auth/login');
  }

  // Await searchParams (Next.js 15+ async searchParams)
  const params = await searchParams;

  // Parse pagination params from URL
  const pageParam = typeof params.page === 'string' ? parseInt(params.page, 10) : 1;
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const pageSizeParam = typeof params.pageSize === 'string' ? parseInt(params.pageSize, 10) : DEFAULT_PAGE_SIZE;
  const pageSize = VALID_PAGE_SIZES.includes(pageSizeParam) ? pageSizeParam : DEFAULT_PAGE_SIZE;

  // Parse search param from URL
  const search = typeof params.search === 'string' ? params.search.trim() : '';

  // Parse sort params from URL
  const sortByParam = typeof params.sortBy === 'string' ? params.sortBy : null;
  const sortOrderParam = typeof params.sortOrder === 'string' ? params.sortOrder : null;

  // Validate sort column
  const sortBy = sortByParam && VALID_SORT_COLUMNS.includes(sortByParam as SortColumn)
    ? (sortByParam as SortColumn)
    : null;
  const sortOrder = sortOrderParam === 'asc' || sortOrderParam === 'desc' ? sortOrderParam : 'asc';

  // Build Prisma where clause for server-side filtering
  const whereClause: Prisma.usersWhereInput = {
    role: 'PATIENT',
    ...(tenantId && { tenantId }),
  };

  // Apply search filter (case-insensitive across multiple fields)
  if (search) {
    whereClause.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Calculate skip for pagination
  const skip = (page - 1) * pageSize;

  // Build orderBy clause - default to createdAt desc if no sort specified
  const orderBy: Prisma.usersOrderByWithRelationInput = sortBy
    ? { [sortBy]: sortOrder }
    : { createdAt: 'desc' };

  // Get filtered count, paginated customers, and recent sign-ups in parallel
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [filteredCount, customers, totalCustomersCount, recentSignupsCount] = await Promise.all([
    prisma.users.count({ where: whereClause }),
    prisma.users.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    // Total customers count (without search filter) for stats
    prisma.users.count({
      where: {
        role: 'PATIENT',
        ...(tenantId && { tenantId }),
      },
    }),
    // Count recent sign-ups (last 30 days)
    prisma.users.count({
      where: {
        role: 'PATIENT',
        ...(tenantId && { tenantId }),
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

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
            <div className="text-3xl font-bold">{totalCustomersCount}</div>
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
            <div className="text-3xl font-bold">{totalCustomersCount}</div>
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
            <div className="text-3xl font-bold">{recentSignupsCount}</div>
            <p className="text-xs mt-2 text-purple-100">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Customers Table with Search and Pagination */}
      <CustomersTable
        customers={customers}
        totalCount={filteredCount}
      />
    </div>
  );
}
