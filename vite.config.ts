import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAQNRCYDsorUxuyZYp_iolRWLWNnXhH6B4",
    authDomain: "fish-frenzy-mobile.firebaseapp.com",
      databaseURL: "https://fish-frenzy-mobile-default-rtdb.firebaseio.com",
        projectId: "fish-frenzy-mobile",
          storageBucket: "fish-frenzy-mobile.firebasestorage.app",
            messagingSenderId: "5130585649",
              appId: "1:5130585649:web:26ac3b9b28af881b117710",
                measurementId: "G-N2PKR17E84"
                };

                // Initialize Firebase
                const app = initializeApp(firebaseConfig);
                const analytics = getAnalytics(app);
export default defineConfig(() => {
  return {
    base: process.env.GITHUB_ACTIONS === 'true' ? '/Ih/' : './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
