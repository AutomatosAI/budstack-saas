'use client';

import Link from 'next/link';
import { motion } from "framer-motion";

const MobileBottomActions = () => {
  return (
    <>
      {/* Fixed Bottom Action Bar - Mobile Only */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-background via-background to-background/95 backdrop-blur-xl border-t border-border/50 shadow-2xl"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex gap-3">
            <Link
              href="/consultation"
              className="flex-1 text-center font-body font-semibold text-white px-6 py-3.5 rounded-full transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl"
              style={{
                background: 'linear-gradient(135deg, hsl(164, 48%, 53%), hsl(178, 48%, 33%))',
              }}
            >
              Start Consultation
            </Link>
            <Link
              href="./login"
              className="flex-1 text-center font-body font-semibold text-foreground px-6 py-3.5 rounded-full transition-all duration-300 active:scale-95 border-2 border-primary/50 bg-background/90 hover:bg-primary/10 shadow-lg hover:shadow-xl"
            >
              Login
            </Link>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default MobileBottomActions;
