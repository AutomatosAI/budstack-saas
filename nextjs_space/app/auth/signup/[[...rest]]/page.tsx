"use client";

import { SignUp } from "@clerk/nextjs";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

export default function SignupPage() {
  return (
    <div className="min-h-screen canvas-bg flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 pt-24 pb-16">
        <SignUp routing="path" path="/auth/signup" />
      </main>
      <Footer />
    </div>
  );
}
