
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db';
import { ProductsTable } from './products-table';

export default async function ProductsPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'TENANT_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/auth/login');
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    include: {
      tenant: {
        include: {
          products: {
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (!user?.tenant) {
    redirect('/tenant-admin');
  }

  const products = user.tenant.products;

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Product Management</h1>
            <p className="text-slate-600 mt-2">Manage your product catalog</p>
          </div>
          <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all">
            Sync from Dr Green Admin
          </Button>
        </div>
      </div>

      <ProductsTable products={products} />
    </div>
  );
}
