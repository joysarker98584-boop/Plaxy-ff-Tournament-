ARENAX Tournament Website — Expansion v1

Files: index.html, styles.css, app.js plus original PWA assets.
Backend: existing Firebase project configuration retained from your source files.

Included: existing login/profile/wallet/deposit/withdraw/manual verification/tournament registration/admin controls, plus tournament format/rules/registration status, match fixture creation, match score/status updates, public fixtures/results, announcements, and player dispute submissions.

Payment: bKash/Nagad Send Money to 01346022330. This is MANUAL verification only. Players submit amount, method and Transaction ID; Admin reviews before wallet credit. No automatic bKash/Nagad API or SSLCommerz settlement is enabled. Never collect PIN/OTP.

Deployment: Upload the contents of this folder to the same GitHub Pages site, replacing the corresponding old files after keeping a backup. Keep manifest.json, service-worker.js, and any referenced icons/assets.

IMPORTANT SECURITY: Existing client-side Firebase app requires Firestore Security Rules. Ensure only users can create their own payment/dispute/registration records, and only trusted admin accounts can approve payments, issue prizes, create tournaments/matches/notices, or alter wallet ledger entries. Do not rely on hidden UI buttons as security. Test with a non-admin account before public launch.
