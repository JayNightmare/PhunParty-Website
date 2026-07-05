import { HashRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import Header from "@/components/Header";
import ErrorBoundary from "@/components/ErrorBoundary";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import Landing from "@/pages/Landing";
import NewSession from "@/pages/NewSession";
import ActiveSessions from "@/pages/ActiveSessions";
import ActiveQuiz from "@/pages/ActiveQuiz";
import PostGameStats from "@/pages/PostGameStats";
import Account from "@/pages/Account";
import Join from "@/pages/Join";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import VerifyEmail from "@/pages/VerifyEmail";
import EditProfile from "@/pages/EditProfile";
import ForgotPassword from "@/pages/ForgotPassword";
import SessionWaitingRoom from "@/pages/SessionWaitingRoom";
import { useEffect } from "react";
import {
  preloadCriticalComponents,
  usePerformanceMonitoring,
} from "@/components/Performance";
import DevTools from "@/components/DevTools";

export default function App() {
  // Performance monitoring
  usePerformanceMonitoring();

  // Register service worker for PWA functionality
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const handleControllerChange = () => {
        const reloadKey = "phunparty-sw-reloaded";
        if (sessionStorage.getItem(reloadKey) === "1") return;
        sessionStorage.setItem(reloadKey, "1");
        window.location.reload();
      };

      const handleLoad = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            registration.update().catch(() => {
              // Ignore update check failures; normal navigation still works.
            });
          })
          .catch(() => {
            // Service worker registration failed
          });

        navigator.serviceWorker.addEventListener(
          "controllerchange",
          handleControllerChange
        );
      };

      window.addEventListener("load", handleLoad);
      preloadCriticalComponents();

      return () => {
        window.removeEventListener("load", handleLoad);
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          handleControllerChange
        );
      };
    }

    // Preload critical components on idle
    preloadCriticalComponents();
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <Header />
            <PWAInstallPrompt />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/new" element={<NewSession />} />
              <Route path="/sessions" element={<ActiveSessions />} />
              <Route
                path="/session/:sessionCode/waiting"
                element={<SessionWaitingRoom />}
              />
              <Route path="/play/:sessionId" element={<ActiveQuiz />} />
              <Route path="/stats/:sessionId" element={<PostGameStats />} />
              <Route path="/account" element={<Account />} />
              <Route path="/account/edit" element={<EditProfile />} />
              <Route path="/join/:sessionId" element={<Join />} />
            </Routes>
            <DevTools />
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
