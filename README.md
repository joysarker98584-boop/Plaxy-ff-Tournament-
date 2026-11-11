ArenaX Firebase Tournament Website
Files
index.html — all website sections and navigation
styles.css — responsive dark-blue/purple mobile design
app.js — Firebase Authentication and Firestore logic
firestore.rules — database access rules
1. GitHub upload
Upload index.html, styles.css, and app.js to the ROOT of your GitHub Pages repository (same level as README.md). Do not upload only the enclosing folder. Commit changes, then open the GitHub Pages URL and refresh.
2. Firebase setup
In Firebase Console:
Authentication > Sign-in method > enable Email/Password.
Firestore Database > Create database.
Open Firestore > Rules, replace the rules with firestore.rules, then Publish.
Ensure the Firebase project matches the config already included in app.js.
3. Make your own account Admin
Open Firebase Console > Authentication > Users.
Create your account through the website first.
Copy your account's UID from Authentication > Users.
Open Firestore Database > Data.
Create collection users if it does not exist.
Create a document whose Document ID is EXACTLY your Auth UID.
Add fields:
displayName (string): your name
email (string): your email
role (string): admin
Save. Sign out and sign in again on the website. Admin Panel will appear.
Do not make a public admin signup form. Never promote users by trusting a browser-side button.
4. Payments
The site shows the manual payment number 01346022330 for bKash/Nagad. Players send money in their own wallet app and submit the Transaction ID. Admin checks the transaction in their actual merchant/personal account and approves/rejects the request in Admin Panel. Never ask users for PIN, OTP or payment password. This is NOT an automatic bKash/Nagad gateway. The number must be yours or you must have permission to collect payments on it. Confirm the account type and provider rules before collecting money.
5. Important production notes
This is a starter MVP. Payment approval and wallet display are manual; no money is transferred by this website.
Do not use the displayed balance as a real financial ledger. Before enabling paid entry fees, withdrawals or automatic wallet debits, implement trusted server-side Cloud Functions/Cloud Run with transaction validation, idempotency and audit logs.
Firestore rules protect admin actions, but room details are currently stored on tournament documents readable to all visitors. Do not enter real room passwords until you move room credentials to a protected per-user collection and add server-side access controls.
Add your own privacy policy, terms, support availability, and refund rules before public launch.# Plaxy-ff-Tournament-