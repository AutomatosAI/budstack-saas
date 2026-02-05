import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MAX_RETRIES = 30; // 30 attempts
const RETRY_DELAY = 2000; // 2 seconds
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not defined');
    process.exit(1);
}

// Mask the password in the logs
const maskedUrl = DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
console.log(`🔌 Checking database connection... (${maskedUrl})`);

async function checkConnection(retries = MAX_RETRIES) {
    try {
        await prisma.$connect();
        // Try a simple query to ensure the DB is actually responsive
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ Database connection successful!');
        await prisma.$disconnect();
        process.exit(0);
    } catch (error: any) {
        if (retries > 0) {
            console.warn(`⚠️ Database not ready yet. Retrying in ${RETRY_DELAY / 1000}s... (${retries} retries left)`);
            if (error && error.message) {
                // Log the first line of the error message to keep logs clean but informative
                console.warn(`   Error: ${error.message.split('\n')[0]}`);
            }
            setTimeout(() => checkConnection(retries - 1), RETRY_DELAY);
        } else {
            console.error('❌ Could not connect to the database after multiple attempts.');
            console.error(error);
            process.exit(1);
        }
    }
}

checkConnection();
