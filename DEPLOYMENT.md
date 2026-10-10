# LabSlot Deployment Guide

## 1. Firebase Project Setup
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Authentication** and activate the **Email/Password** sign-in method.
3. Enable **Firestore Database** in production mode.
4. Go to Project Settings, add a Web App, and copy the Firebase configuration.

## 2. Environment Configuration
1. Rename `.env.example` to `.env.local` in your local environment.
2. Populate the `.env.local` variables with your Firebase project configuration.
3. **Important:** Never commit `.env.local` to version control.

## 3. Administrator Setup
Since public admin registration is disabled for security:
1. Register an account normally through the application.
2. Go to the Firebase Console -> Firestore Database.
3. Find your user document in the `users` collection.
4. Change the `role` field from `"student"` to `"admin"`.
5. Log out and log back in to activate admin privileges.

## 4. Deployment
To deploy LabSlot to Firebase Hosting and apply Firestore rules:

1. Install Firebase CLI globally:
   ```bash
   npm install -g firebase-tools
   ```
2. Login to Firebase:
   ```bash
   firebase login
   ```
3. Initialize Firebase (if not already done) and link your project:
   ```bash
   firebase use --add
   ```
   Select your newly created Firebase project and assign an alias (e.g., `default`).
   
4. Build the application for production:
   ```bash
   npm run build
   ```
5. Deploy to Firebase:
   ```bash
   firebase deploy
   ```

## 5. PWA Installation
LabSlot is configured as a Progressive Web App (PWA). Once deployed via HTTPS on Firebase Hosting:
- **Desktop (Chrome/Edge):** An install icon will appear in the URL bar, and the "Install LabSlot" prompt on the landing page will become active.
- **Android (Chrome):** The "Install LabSlot" prompt will appear, and users can add it to their home screen.
- **iOS (Safari):** Due to Apple's limitations, programmatic install prompts do not work. Users must manually tap "Share" and then "Add to Home Screen".
