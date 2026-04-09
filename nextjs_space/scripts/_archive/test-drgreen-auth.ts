
const cryptoModule = require("crypto");
const https = require("https");

const ALGORITHM = "aes-256-gcm";
const KEY = process.env.DECRYPTION_KEY;
const encryptedApiKey = process.env.ENCRYPTED_API_KEY;
const encryptedSecretKey = process.env.ENCRYPTED_SECRET_KEY;

if (!KEY || !encryptedApiKey || !encryptedSecretKey) {
    throw new Error("Required environment variables missing: DECRYPTION_KEY, ENCRYPTED_API_KEY, ENCRYPTED_SECRET_KEY");
}

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

const URL_BASE = 'https://budstack-backend-main-development.up.railway.app/api/v1';

// This is likely the user's drGreenClientId causing the issue
// From usage, it seems we check client status
const TEST_CLIENT_ID = "616161245"; // dummy ID for auth check

async function main() {
    const apiKey = decryptText(encryptedApiKey);
    const secretKey = decryptText(encryptedSecretKey);

    console.log("Testing API fetch for Client...");

    // Test fetchClient logic
    // endpoint: /clients/{id}
    // GET request
    // Signed? Yes, client logic signs even GET requests if they have params or usually simply adds signature.
    // The previous code adds signature if method != GET OR payload exists.
    // BUT for GET /clients/123 there is no query string.
    // Let's see `drgreen-api-client.ts` logic again.

    // "if (signaturePayload || method !== 'GET')"
    // signaturePayload for GET is query string.
    // for /clients/123, query string is empty.
    // So signaturePayload is empty.
    // So it does NOT add signature header for simple GETs without params?

    // Let's emulate exactly what the code does.

    const endpoint = `/clients/${TEST_CLIENT_ID}`;
    const url = `${URL_BASE}${endpoint}`;

    console.log(`URL: ${url}`);

    const parts = endpoint.split('?');
    const signaturePayload = parts.length > 1 ? parts[1] : '';

    const headers: any = {
        'Content-Type': 'application/json',
        'x-auth-apikey': apiKey,
    };

    // Always sign?
    headers['x-auth-signature'] = generateSignature(signaturePayload, secretKey);
    console.log("Adding signature for payload:", signaturePayload === '' ? '(empty string)' : signaturePayload);

    try {
        const res = await fetch(url, { headers });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${text.substring(0, 500)}`);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

main().catch(console.error);
