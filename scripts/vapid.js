// ============================================================
//  Generate the VAPID key pair for browser push notifications.
//
//  Run from the project root:
//      npm run keys
//
//  Copy the two values into Vercel → Settings → Environment
//  Variables, then redeploy. Keep the private key secret.
// ============================================================
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('');
console.log('  Copy these into Vercel → Environment Variables');
console.log('  ────────────────────────────────────────────────');
console.log('');
console.log('  VAPID_PUBLIC_KEY');
console.log(`  ${publicKey}`);
console.log('');
console.log('  VAPID_PRIVATE_KEY');
console.log(`  ${privateKey}`);
console.log('');
console.log('  VAPID_CONTACT');
console.log('  mailto:support@oakhavenyield.com');
console.log('');
console.log('  Then press Redeploy. Never share the private key.');
console.log('');
