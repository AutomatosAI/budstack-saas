import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function debugAuth() {
    const email = 'gerard400@gmail.com';
    const password = "asdfghjkl;'";

    console.log('\n🔍 FULL AUTH DEBUG');
    console.log('Email:', email);
    console.log('Password:', password);

    // Step 1: Find user
    // Step 1: Find user
    const user = await prisma.users.findFirst({
        where: { email },
        include: { tenants: true },
    });

    console.log('\n1️⃣ User lookup:');
    if (!user) {
        console.log('❌ User not found');
        await prisma.$disconnect();
        return;
    }
    console.log('✅ User found:', user.email);
    console.log('   Has password:', !!user.password);
    console.log('   Password length:', user.password?.length);

    // Step 2: Password comparison
    console.log('\n2️⃣ Password comparison:');
    const isValidPassword = await bcrypt.compare(password, user.password || '');
    console.log('   bcrypt.compare result:', isValidPassword);

    // Step 3: Check what would be returned
    console.log('\n3️⃣ Auth would return:');
    if (!user || !user.password) {
        console.log('   ❌ Would return NULL (no user or password)');
    } else if (!isValidPassword) {
        console.log('   ❌ Would return NULL (invalid password)');
    } else {
        console.log('   ✅ Would return user object:');
        console.log('   {');
        console.log('     id:', user.id);
        console.log('     email:', user.email);
        console.log('     name:', user.name);
        console.log('     role:', user.role);
        console.log('     tenantId:', user.tenantId);
        console.log('   }');
    }

    await prisma.$disconnect();
}

debugAuth().catch((error) => {
    console.error('Error:', error);
    prisma.$disconnect();
});
