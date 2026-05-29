import { config } from "dotenv";

// Load ONLY .env.test — never the real .env / .env.local / Railway secrets.
// override: true guarantees the deterministic throwaway test values win even
// if a real key leaked into the ambient environment.
config({ path: ".env.test", override: true });

// lib/encryption.ts reads process.env.ENCRYPTION_KEY at module load. Guarantee a
// deterministic throwaway key is present before any test imports that module.
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = "budstack-unit-test-key-not-a-real-secret-0123456789";
}
