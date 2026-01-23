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
    <div className="min-h-screen canvas-bg flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 pt-24 pb-16">
        {isSignedIn ? (
          <div className="w-full max-w-md space-y-4 text-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-4">Already Signed In</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                You are currently signed in as <strong>{user?.emailAddresses[0]?.emailAddress}</strong>
              </p>
              <div className="space-y-3">
                <Button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full"
                  variant="default"
                >
                  {isSigningOut ? "Signing out..." : "Sign Out and Sign In as Different User"}
                </Button>
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                  className="w-full"
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
            signUpUrl="/auth/signup"
            afterSignInUrl="/auth/callback"
            // Allow users to switch accounts
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-xl",
              },
            }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
