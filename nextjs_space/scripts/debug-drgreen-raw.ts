import fs from 'fs';
import path from 'path';
import { generateDrGreenSignature } from '../lib/drgreen-api-client';

// Manually load env
const envPath = path.resolve(process.cwd(), '.env');
console.log('Loading .env from:', envPath);

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
} else {
    console.error('❌ .env file not found at', envPath);
}

const API_KEY = process.env.DOCTOR_GREEN_API_KEY;
const SECRET_KEY = process.env.DOCTOR_GREEN_SECRET_KEY;
const API_URL = process.env.DOCTOR_GREEN_API_URL || 'https://api.drgreennft.com/api/v1';

async function debugApi() {
    console.log('--- Dr Green API Debug ---');
    console.log('API URL:', API_URL);
    console.log('API Key present:', !!API_KEY);
    console.log('Secret Key present:', !!SECRET_KEY);

    if (!API_KEY || !SECRET_KEY) {
        console.error('❌ Missing credentials in environment');
        return;
    }

    const endpoint = '/strains?country=SA';
    const url = `${API_URL}${endpoint}`;

    console.log(`\nFetching: ${url}`);

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-auth-apikey': API_KEY,
        };

        // GET request usually doesn't need signature unless there is a body, 
        // but the client code says: "if (method !== 'GET' && payload) { add signature }"
        // So GET is just API Key?
        // Let's check the client code again. `generateDrGreenSignature` is used if payload exists.

        // Wait, the `drgreen-api-client.ts` says:
        // if (method !== 'GET' && payload) { requestHeaders['x-auth-signature'] = ... }
        // So for GET, no signature?

        const response = await fetch(url, {
            method: 'GET',
            headers: headers
        });

        console.log('Status:', response.status, response.statusText);

        if (!response.ok) {
            const text = await response.text();
            console.error('Error Body:', text);
            return;
        }

        const data = await response.json();
        console.log('\n--- RAW RESPONSE DATA (First Item) ---');
        if (data.data?.strains && data.data.strains.length > 0) {
            console.log(JSON.stringify(data.data.strains[0], null, 2));
        } else {
            console.log('No strains found or unexpected structure:', JSON.stringify(data, null, 2));
        }

    } catch (err) {
        console.error('Fetch error:', err);
    }
}

debugApi();
