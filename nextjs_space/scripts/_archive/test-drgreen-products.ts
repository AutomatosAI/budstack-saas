
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
    if (parts.length !== 3) return text; // assume already decrypted if not in format
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

const URL_BASE = 'https://budstack-backend-main-development.up.railway.app/api/v1';

async function main() {
    const apiKey = decryptText(encryptedApiKey);
    const secretKey = decryptText(encryptedSecretKey);

    console.log("Testing API fetch for 'ZAF' (South Africa)...");

    // We need to sign the request or provide API key header. 
    // Looking at doctor-green-api.ts, typically 'x-api-key' is sent.

    // Let's use simple node fetch if available, else https

    const url = `${URL_BASE}/strains?country=ZAF`;

    console.log(`URL: ${url}`);

    // Construct request
    const options = {
        headers: {
            'x-auth-apikey': apiKey,
            'x-auth-signature': 'dummy_signature' // Testing if this triggers 500
        }
    };

    try {
        const res = await fetch(url, { headers: options.headers });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${text.substring(0, 500)}`); // detailed error
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

main().catch(console.error);
