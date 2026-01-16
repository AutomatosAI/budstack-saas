
const cryptoModule = require("crypto");
const https = require("https");

const ALGORITHM = "aes-256-gcm";
const KEY = '90ee117817fbf467d2c1aaf636ea3a1757ba1cb67d432290a3ba2f6847c218cd';

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

const encryptedApiKey = 'd4a04de08825fdd5aeaf143ce66513c0:25a10678595c5895e90283df032069fc:052be38ca64eeef1865f41ce460a3fa7a5eb2eff64fa1c5a7f345f697ec51fcc3618c5afa3afa8e791350dac1e9139e0c8c77ccc981d1e102ae9613acbe3142fb60155a81cc737d92d6438354ecae2c1b78926bcbf30eef3593b42e405042fcf8d2043607e18035c4b888aae385a88271e1b28bc60d0ebfbadc76d0c2b605abdc0239da8676531c6f2f220a9a4ed193a08ed1ae494ad6ea9848869791bf7d75ceaa46ea4a68c6b857dc5c001076d8ccc702264b54dbb2dcd762f5e56ba6e53092e766db89f94820a0beff5eb0a5ff8ca033d3a7768126d334be28af1d40f1d19130b0ecf53c34e71';
const encryptedSecretKey = '9661d455b76e504e12c935b397180b68:b10015777d95c3d7be976cd56b5db2f9:0b7f1696be4f11c02fd14d688e3f484267e9f8eaedcde12c99f6ee73b017e31c0084eca9b52d8cb044838c86e25ca0f74a35a07b9099f25a4424c9636435ecc00e294c353d09d5a85ff0c2c719028f99450d91659b9703d1b536bc19f16bb6fe92333d7e9dc52108f19de661f41ba488be966955b9c45eaabdd8e7fbe6d94f8d8c4e4e731d42612ac2a71bd6c0f8bdfdc9bdbedb00477140759c83a54a0e193e903b05e677e69c973ce82ca7dcaa8b85c02c8883cd16686635d51a6f363f3226ef1e5b29f668ec2d51c91da61435801d101903be31f806d3b4eab931c7809f5819b571d182ce3d792cde03a575188c29ee90b292775c4bf2c5b3bc0e6da738509bd9e4cf3896b194936830d5d9136a18995a0b83c74744dd03cc1d11d447686d1d794c0b7aa419626de42c8c14267fee251ba32a84ae00683fdb51f7';
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
