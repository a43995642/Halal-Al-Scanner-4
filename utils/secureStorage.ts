
// Security Utility: Client-Side Tamper Detection
// This prevents casual users from modifying localStorage values directly (e.g., via DevTools)
// Note: For absolute security, sensitive state (Premium status) MUST be validated on a backend server.

const SALT = "HALAL_SCAN_V2_SECURE_SALT_99283";
const STORAGE_PREFIX = "HS_SEC_";

// Simple string hash function (DJB2 variant) for client-side checksum
const generateChecksum = (data: string): string => {
  let hash = 5381;
  const combined = data + SALT;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
  }
  return hash.toString(16);
};

export const secureStorage = {
  setItem: (key: string, value: any) => {
    try {
      const stringValue = JSON.stringify(value);
      // Create a checksum of the value + salt
      const checksum = generateChecksum(stringValue);
      
      // Store the data packaged with its checksum
      const payload = {
        data: stringValue,
        hash: checksum,
        ts: Date.now()
      };

      // Base64 encode the whole payload to make it unreadable at a glance
      const encodedPayload = btoa(encodeURIComponent(JSON.stringify(payload)));
      
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, encodedPayload);
    } catch (e) {
      console.warn("SecureStorage Write Failed", e);
    }
  },

  getItem: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (!item) return defaultValue;
      
      // 1. Decode Base64
      let payloadStr = "";
      try {
        payloadStr = decodeURIComponent(atob(item));
      } catch (e) {
        // If decoding fails, data is corrupted
        return defaultValue;
      }

      // 2. Parse JSON Payload
      const payload = JSON.parse(payloadStr);
      
      if (!payload || !payload.data || !payload.hash) {
        return defaultValue;
      }

      // 3. Verify Checksum (Tamper Check)
      // We re-calculate the hash of the stored data and compare it with the stored hash.
      // If the user manually changed 'data' in localStorage, the hash won't match.
      const calculatedHash = generateChecksum(payload.data);
      
      if (calculatedHash !== payload.hash) {
        console.error(`Security Alert: Data tampering detected for key: ${key}. Reverting to default.`);
        // Optional: clear the tampered data
        localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
        return defaultValue;
      }

      // 4. Return valid data
      return JSON.parse(payload.data) as T;

    } catch (e) {
      console.warn("SecureStorage Read Failed / Tampering Detected", e);
      return defaultValue;
    }
  },

  removeItem: (key: string) => {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  }
};
