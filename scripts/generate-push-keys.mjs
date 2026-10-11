// Run once: `node scripts/generate-push-keys.mjs`
// Prints the VAPID keys and a CRON_SECRET to add to your host's environment variables.
import { webcrypto as crypto } from "node:crypto";
const b64 = (buf) => Buffer.from(buf).toString("base64url");
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
console.log(`VAPID_PUBLIC_KEY=${b64(raw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log(`CRON_SECRET=${b64(crypto.getRandomValues(new Uint8Array(32)))}`);
