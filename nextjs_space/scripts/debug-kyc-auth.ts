
const cryptoModule = require("crypto");
const { PrismaClient } = require("@prisma/client");
const https = require("https"); // or fetch if node 18+

const prisma = new PrismaClient();

const ALGORITHM = "aes-256-gcm";
const KEY = '90ee117817fbf467d2c1aaf636ea3a1757ba1cb67d432290a3ba2f6847c218cd';
const URL_BASE = 'https://budstack-backend-main-development.up.railway.app/api/v1';

function getKeyId() {
    return cryptoModule.createHash("sha256").update(String(KEY)).digest();
}

function decryptText(text: any) {
    if (!text) return "";
    const parts = text.split(":");
    if (parts.length !== 3) return text;
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getKeyId();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = cryptoModule.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

function generateSignature(payload: string, secretKey: string): string {
    let privateKeyPEM = secretKey;
    if (!secretKey.includes('BEGIN PRIVATE KEY')) {
        try {
            privateKeyPEM = Buffer.from(secretKey, 'base64').toString('utf-8');
        } catch (error) {
            // ignore
        }
    }

    const sign = cryptoModule.createSign('SHA256');
    sign.update(payload);
    sign.end();

    return sign.sign(privateKeyPEM).toString('base64');
}

async function main() {
    try {
        // 1. Get Tenant Keys (healingbuds)
        const tenant = await prisma.tenants.findUnique({
            where: { subdomain: 'healingbuds' }
        });

        if (!tenant) throw new Error("Tenant not found");

        const apiKey = decryptText(tenant.drGreenApiKey);
        const secretKey = decryptText(tenant.drGreenSecretKey);

        // 2. Get User ID (gerard161+buds@gmail.com)
        const user = await prisma.users.findFirst({
            where: { email: 'gerard161+buds@gmail.com' }
        });

        if (!user || !user.drGreenClientId) {
            console.error("User or DrGreenClientId not found:", user);
            return;
        }

        const clientId = user.drGreenClientId;
        console.log("Testing with Client ID:", clientId);

        // 3. Test different signature payloads
        const endpoint = `/clients/${clientId}`;
        const url = `${URL_BASE}${endpoint}`;

        const payloadsToTest = [
            { name: "Empty String", payload: "" },
            { name: "URL Path", payload: endpoint }, // /clients/123
            { name: "Full URL", payload: url },
            { name: "Query String (undefined)", payload: undefined }, // should behave like empty string
            { name: "JSON empty object", payload: "{}" },
            // Timestamps? API doesn't seem to ask for timestamp header so unlikely
        ];

        for (const test of payloadsToTest) {
            console.log(`\n--- Testing Payload: ${test.name} ---`);
            const signature = test.payload !== undefined
                ? generateSignature(test.payload, secretKey)
                : undefined;

            const headers: any = {
                'Content-Type': 'application/json',
                'x-auth-apikey': apiKey,
            };

            if (signature) {
                headers['x-auth-signature'] = signature;
            }

            try {
                const res = await fetch(url, { headers });
                console.log(`Status: ${res.status}`);
                if (res.status !== 200) {
                    const txt = await res.text();
                    console.log("Error:", txt.substring(0, 100));
                } else {
                    console.log("SUCCESS!");
                    const json = await res.json();
                    console.log("Data:", JSON.stringify(json, null, 2).substring(0, 200));
                }
            } catch (e) {
                console.error("Fetch error:", e);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
