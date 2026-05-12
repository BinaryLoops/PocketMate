import React from "react";
import { motion } from "framer-motion";
import { Wallet, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0.9 }}
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 3, repeat: Infinity, repeatType: "mirror" }}
      className={cn("flex items-center", className)}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("drop-shadow-md", className)}
      >
        <path
          d="M200 50C150 50 110 90 110 140C110 170 130 200 160 220L240 180C270 160 290 130 290 100C290 70 270 50 240 50H200Z"
          fill="#4ADE80"
        />
        <path
          d="M160 220C130 240 110 270 110 300C110 330 130 350 160 350H200C250 350 290 310 290 260C290 230 270 200 240 180L160 220Z"
          fill="#4ADE80"
        />
      </svg>
    </motion.div>
  );
}

export function SavingsIcon({ className }: { className?: string }) {
  return <PiggyBank className={cn("h-6 w-6 text-primary", className)} />;
}
