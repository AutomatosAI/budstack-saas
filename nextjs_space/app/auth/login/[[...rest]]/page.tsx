"use client";

import { SignIn, useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Allow authenticated users to access this page
  // They can sign out if they want to sign in as a different user
  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      // Force a page reload to clear any cached state
      window.location.href = "/auth/login";
    } catch (error) {
      console.error("Error signing out:", error);
      setIsSigningOut(false);
    }
  };

  return (
    <div className="budstacks-theme min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 pt-24 pb-16">
        {isSignedIn ? (
          <div className="w-full max-w-md space-y-4 text-center">
            <div className="rounded-2xl border border-bs-border bg-bs-bg-1 shadow-xl p-8">
              <h2 className="font-bs-serif text-2xl font-medium text-bs-fg-0 mb-4">Already Signed In</h2>
              <p className="text-bs-fg-2 mb-6">
                You are currently signed in as <strong className="text-bs-fg-0">{user?.emailAddresses[0]?.emailAddress}</strong>
              </p>
              <div className="space-y-3">
                <Button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full bg-bs-green-500 text-bs-bg-0 hover:bg-bs-green-400 rounded-xl"
                >
                  {isSigningOut ? "Signing out..." : "Sign Out and Sign In as Different User"}
                </Button>
                <Button
                  onClick={() => router.push("/auth/callback")}
                  className="w-full bg-bs-bg-2 text-bs-fg-1 border border-bs-border hover:bg-bs-bg-2/80 rounded-xl"
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <SignIn
            routing="path"
            path="/auth/login"
            signUpUrl="/onboarding"
            afterSignInUrl="/auth/callback"
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
