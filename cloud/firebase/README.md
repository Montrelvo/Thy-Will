# Step 7 — Firebase development foundation

This directory contains the repository-side Firebase configuration for Thy Will.

## Required development project setup

Create a dedicated development Firebase project, then:

1. Register a Web App.
2. Enable **Authentication > Anonymous**.
3. Create a **Cloud Firestore** database.
4. Enable **Firebase Hosting**.
5. Copy the Web App configuration values into `apps/client/.env` using
   `apps/client/.env.example` as the template.
6. Associate the repository with the real project using the Firebase CLI
   (`firebase use --add`) rather than committing a guessed project ID.
7. Deploy the development rules with `firebase deploy --only firestore:rules`.
8. Build the client and deploy Hosting with `firebase deploy --only hosting`.

Do not commit Firebase Admin credentials, service-account JSON, refresh tokens,
or other server secrets. The browser Web App configuration is an identifier set,
not a server credential.

## Local emulator

The committed `firebase.json` reserves Auth on 9099, Firestore on 8080, and
Hosting on 5000. Use a demo project ID when exercising emulators so accidental
production resource access is obvious.

The client only connects to the Auth emulator when
`VITE_FIREBASE_USE_EMULATORS=true`.

## Step boundary

Step 7 establishes identity and development access control. Firestore game-save
writes and reads begin in Step 8. Realtime Database remains intentionally absent.
