# Blind Document Reader — App (Expo)

Cross-platform mobile app to capture a document with the camera, send to GPT for transcription, and speak it back to the user.
- Tech: Expo (React Native), TypeScript, expo-camera, expo-speech, expo-av, expo-haptics
- Audio is configured to play even in iOS Silent mode.

## Local dev
1) Install deps: `npm install` or `pnpm install`
2) Configure the backend endpoint:
   - Create `.env` with:
     EXPO_PUBLIC_BACKEND_URL=http://<your-computer-LAN-IP>:4000
3) Start: `npm run start` and open on device with Expo Go.

## Build notes
- Put secrets only in the server; the app reads a public backend URL via `EXPO_PUBLIC_BACKEND_URL`.
