"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useApp } from "@/hooks/use-app";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Bot, Goal, BarChart, Wallet, PiggyBank } from "lucide-react";
import { Logo } from "@/components/logo";
import { placeholderImages } from "@/lib/placeholder-images";

const heroImage = placeholderImages.find((p) => p.id === "hero-image");

const features = [
  {
    icon: <Goal className="h-10 w-10 text-primary" />,
    title: "Goal-First Budgeting",
    description: "Set financial goals and let our AI auto-allocate your income to help you achieve them faster.",
  },
  {
    icon: <CheckCircle className="h-10 w-10 text-primary" />,
    title: "Daily Expense Tracking",
    description: "Log your daily spending against a customizable limit and get instant profit/loss feedback.",
  },
  {
    icon: <Bot className="h-10 w-10 text-primary" />,
    title: "AI-Powered Chatbot",
    description: "Get financial advice, simulate scenarios, and receive role-specific tips from our Gemini-powered chatbot.",
  },
  {
    icon: <BarChart className="h-10 w-10 text-primary" />,
    title: "Smart Forecasting",
    description: "Our AI analyzes your spending patterns to predict future expenses and sends proactive alerts.",
  },
];

export default function LandingPage() {
  const { user, profile } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (user && profile?.role) {
      router.replace("/dashboard");
    }
  }, [user, profile, router]);

  if (user !== null && user !== undefined) {
    if (profile?.role) {
      return (
        <div className="flex h-screen items-center justify-center">
          <p>Loading...</p>
        </div>
      );
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-[#071226] via-[#072b3e] to-[#073d58]">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/6 bg-black/20 backdrop-blur supports-[backdrop-filter]:bg-black/20">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link href="/" className="mr-6 flex items-center space-x-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Image
                src="/POCKETMATE.png"
                alt="PocketMate"
                width={28}
                height={28}
                className="object-contain"
                priority
              />
            </div>
            <span className="font-bold text-white text-lg">PocketMate</span>
          </Link>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-3">
              <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button className="bg-[#4ADE80] hover:bg-[#4ADE80]/90 text-black font-medium" asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Animated background blobs / lights */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-[-10%] top-[-10%] z-0"
        animate={{ x: [-20, 10, -20], y: [0, 20, 0] }}
        transition={{ duration: 16, repeat: Infinity, repeatType: "mirror" }}
      >
        <div className="w-[36rem] h-[36rem] rounded-full bg-gradient-to-br from-[#0ea5c9]/20 via-[#7c3aed]/10 to-[#60a5fa]/6 blur-3xl" />
      </motion.div>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute right-[-6%] bottom-[-8%] z-0"
        animate={{ x: [0, -25, 0], y: [-10, 10, -10] }}
        transition={{ duration: 18, repeat: Infinity, repeatType: "mirror" }}
      >
        <div className="w-[44rem] h-[44rem] rounded-full bg-gradient-to-br from-[#06b6d4]/10 via-[#0ea5c9]/8 to-[#7c3aed]/6 blur-3xl" />
      </motion.div>

      <main className="flex-1">
        {/* HERO */}
        <section className="container mx-auto grid items-center gap-8 px-4 py-12 md:py-20">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
            {/* Left: hero copy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="z-10 max-w-xl"
            >
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-6xl">
                Master Your Money, <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-[#4ADE80] to-[#22c55e] bg-clip-text text-transparent">
                  Effortlessly.
                </span>
              </h1>

              <p className="mt-4 max-w-[680px] text-lg text-cyan-100/80">
                PocketMate is your AI financial co-pilot — goal-first budgeting, contextual
                coaching, and real-time insights built for India. Save smarter with powerful,
                personalized recommendations.
              </p>

              <div className="mt-6 flex gap-4">
                <motion.div whileHover={{ scale: 1.04 }}>
                  <Button size="lg" className="bg-[#4ADE80] hover:bg-[#4ADE80]/90 text-black font-medium shadow-lg shadow-[#4ADE80]/30">
                    <Link href="/signup">Start for Free</Link>
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.04 }}>
                  <Button variant="ghost" size="lg" className="border border-white/8 text-white/90">
                    <Link href="#features">See Features</Link>
                  </Button>
                </motion.div>
              </div>

              {/* quick bullets */}
              <div className="mt-8 flex flex-wrap gap-3">
                <div className="flex items-center gap-3 rounded-full bg-white/5 px-4 py-2 text-sm text-white/80">
                  <Wallet className="h-5 w-5 text-cyan-300" />
                  AI-driven budgets
                </div>
                <div className="flex items-center gap-3 rounded-full bg-white/5 px-4 py-2 text-sm text-white/80">
                  <PiggyBank className="h-5 w-5 text-cyan-300" />
                  Localized for India
                </div>
                <div className="flex items-center gap-3 rounded-full bg-white/5 px-4 py-2 text-sm text-white/80">
                  <Bot className="h-5 w-5 text-cyan-300" />
                  Multilingual AI chat
                </div>
              </div>
            </motion.div>

            {/* Right: floating 3D card + hero image */}
            <div className="relative z-10 flex justify-center">
              <motion.div
                initial={{ opacity: 0, y: 30, rotate: -6 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="relative w-[360px] sm:w-[420px] md:w-[520px] lg:w-[560px]"
              >
                {/* floating card mockup */}
                <motion.div
                  animate={{ y: [0, -12, 0], rotate: [0, 2, -2, 0] }}
                  transition={{ duration: 8, repeat: Infinity, repeatType: "mirror" }}
                  className="mx-auto"
                >
                  <div className="rounded-3xl bg-gradient-to-br from-[#062235] to-[#083249] p-1 shadow-2xl">
                    <div className="h-[260px] w-full rounded-3xl bg-black/40 backdrop-blur-md p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-[#4ADE80]">PocketMate • Smart Wallet</div>
                          <div className="mt-3 text-xl font-semibold">₹ 12,483.75</div>
                          <div className="mt-1 text-xs text-cyan-100/60">Projected monthly savings</div>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="text-xs text-cyan-200/80">Savings Goal</div>
                          <div className="mt-2 font-bold text-white">Vacation ₹50,000</div>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center gap-4">
                        <div className="flex-1 h-2 rounded-full bg-white/6">
                          <div className="h-2 rounded-full bg-[#4ADE80]" style={{ width: "25%" }} />
                        </div>
                        <div className="text-xs text-cyan-100/60">25% reached</div>
                      </div>

                      {/* small floating badges */}
                      <div className="absolute right-6 bottom-6 flex gap-3">
                        <div className="rounded-full bg-white/6 px-3 py-1 text-xs">AI Insights</div>
                        <div className="rounded-full bg-white/6 px-3 py-1 text-xs">UPI • Bank Sync</div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* hero image fallback (if provided) */}
                {heroImage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="absolute -right-6 -top-10 hidden md:block"
                  >
                    <Image
                      src={heroImage.imageUrl}
                      alt={heroImage.description}
                      width={220}
                      height={220}
                      className="rounded-xl shadow-2xl"
                      data-ai-hint={heroImage.imageHint}
                    />
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>
        </section>

        {/* FEATURES: floating 3D cards */}
        <section id="features" className="relative z-10 bg-transparent py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-12 max-w-2xl text-center text-white">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Your Personal Financial Coach</h2>
              <p className="mt-4 text-lg text-cyan-100/70">
                PocketMate provides the tools you need to take control of your finances — with gentle nudges
                and actionable plans.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ delay: i * 0.12, duration: 0.5 }}
                >
                  <Card className="glass p-6 text-center hover:shadow-xl hover:scale-105 transition-transform">
                    <CardHeader className="mb-2">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/6">
                        {feature.icon}
                      </div>
                      <CardTitle className="mt-4 text-white">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-cyan-100/75">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-4xl rounded-2xl bg-gradient-to-r from-[#042033]/60 to-[#052b3c]/50 p-8 text-center backdrop-blur-md border border-white/6">
            <h2 className="text-3xl font-bold text-white">Ready to transform your financial future?</h2>
            <p className="mt-4 text-lg text-cyan-100/70">
              Join PocketMate today and start your journey towards financial freedom.
            </p>
            <div className="mt-8">
              <Button size="lg" className="bg-[#4ADE80] hover:bg-[#4ADE80]/90 text-black font-medium shadow-lg shadow-[#4ADE80]/30">
                <Link href="/signup">Sign Up Now</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/6 bg-black/10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 py-10 px-4 md:h-24 md:flex-row md:py-0">
          <div className="flex flex-col items-center gap-4 md:flex-row md:gap-2">
            <Logo className="text-[#4ADE80]" />
            <p className="text-center text-sm leading-loose text-cyan-100 md:text-left">
              © {new Date().getFullYear()} PocketMate. All rights reserved.
            </p>
          </div>
          <p className="text-center text-sm text-cyan-100/70">Built for a better financial you.</p>
        </div>
      </footer>
    </div>
  );
}
