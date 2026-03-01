const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tenant = await prisma.tenants.findUnique({ where: { subdomain: 'healingbuds' } });
    if (!tenant) return console.log('Tenant not found');

    const { decrypt } = require('./lib/encryption');

    const isEncrypted = (val) => val && val.split(':').length === 3;

    const apiKey = isEncrypted(tenant.drGreenApiKey) ? decrypt(tenant.drGreenApiKey) : tenant.drGreenApiKey;
    const secretKey = isEncrypted(tenant.drGreenSecretKey) ? decrypt(tenant.drGreenSecretKey) : tenant.drGreenSecretKey;

    console.log('API Key starts with:', apiKey.substring(0, 15));
    console.log('Secret Key starts with:', secretKey.substring(0, 15));
}

main().catch(console.error).finally(() => prisma.$disconnect());
