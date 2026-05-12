# PocketMate – In-Depth Project Analysis 

This document is a **technical deep-dive** of the PocketMate project so you can explain how it was built, which technologies were used, and how the pieces fit together.

---

## 1. Project Overview

**PocketMate** is an **AI-powered personal finance and budget-tracking web application**. It helps users:

- Set up a financial profile (income, role, fixed expenses)
- Track daily expenses against a suggested daily limit
- Set and track savings goals with contributions
- Manage an emergency fund (deposits/withdrawals)
- Get AI-powered advice via a chatbot (Gemini)
- Get spending forecasts and alerts based on their data
- Export reports (e.g. PDF)

The app is **India-focused** (e.g. ₹ currency, categories like Rent/EMI) and uses **role-based** advice (Student, Professional, Housewife).

---

## 2. Technology Stack (What Languages & Tools Were Used)

### 2.1 Core Languages

| Purpose | Technology | Where It Appears |
|--------|------------|-------------------|
| **Application logic & UI** | **TypeScript** | All `.ts` and `.tsx` files in `src/` |
| **UI structure** | **JSX/TSX** (React) | Components and pages: `page.tsx`, `*.tsx` in `components/` |
| **Styling** | **CSS** (Tailwind + global) | `globals.css`, Tailwind classes in JSX, `tailwind.config.ts` |
| **Validation & schemas** | **Zod** (TypeScript-first) | Forms (login, signup, onboarding), AI flow inputs/outputs |
| **Config** | **JSON, TypeScript** | `package.json`, `tsconfig.json`, `next.config.ts` |

So in web programming terms: the site is built with **TypeScript and React (JSX)**, styled with **Tailwind CSS** and a small amount of **global CSS**.

### 2.2 Frameworks & Libraries

- **Next.js 15** – React framework with App Router, server components support, API routes, and Turbopack in dev.
- **React 18** – UI library; components are written as functions using hooks.
- **Firebase** – Authentication (email/password) and Firestore (cloud database for profiles, goals, transactions, fixed expenses).
- **Genkit + Google AI (Gemini)** – AI flows (chatbot, spending alerts, expense recommendations); prompts and schemas defined in TypeScript.
- **Tailwind CSS** – Utility-first CSS; theme extended with CSS variables in `globals.css` (e.g. `--primary`, `--background`).
- **Radix UI** – Headless UI primitives (Dialog, Select, Calendar, etc.) used by the `components/ui/` layer for accessibility.
- **Framer Motion** – Animations (e.g. landing page hero, cards).
- **React Hook Form + Zod** – Form state and validation on login, signup, onboarding, and other forms.
- **Recharts** – Charts (e.g. bar chart of recent spending on dashboard).
- **date-fns** – Date formatting and logic (e.g. “today”, “current month”).
- **Lucide React** – Icons across the app.
- **jsPDF / jspdf-autotable** – PDF export for reports.
- **Tesseract.js** – OCR (optional feature for scanning receipts/text from images).

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  Next.js App (React)                                            │
│  • App Router: /, /login, /signup, /dashboard, /goals, etc.     │
│  • Root layout: AppProvider, Toaster, global CSS                │
│  • Route groups: (auth) and (app)                               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ React Context │     │  Next.js API     │     │  Genkit AI      │
│ (AppContext)  │     │  Routes          │     │  (server-side)  │
│ • user,       │     │  /api/ocr,       │     │  • Chatbot      │
│   profile,    │     │  /api/speech-    │     │  • Spending     │
│   goals,      │     │  to-text, etc.   │     │    alerts       │
│   transactions│     └────────┬─────────┘     │  • Expense      │
│ • Actions     │              │               │  recommendations│
└───────┬───────┘              │               └────────┬────────┘
        │                      │                        │
        │    ┌─────────────────┼────────────────────────┘
        │    │                 │
        ▼    ▼                 ▼
┌───────────────┐     ┌──────────────────┐
│ localStorage  │     │  Firebase        │
│ (cache/       │     │  • Auth          │
│  offline)     │     │  • Firestore     │
└───────────────┘     └──────────────────┘
```

- **Frontend**: Next.js pages and React components; state is centralized in **AppContext**.
- **Persistence**: **Firestore** for user data; **localStorage** is used to mirror that data for quick load and offline-style behavior.
- **AI**: **Genkit** runs on the server (e.g. `'use server'` flows), called from the client (e.g. chatbot, spending forecast).
- **APIs**: Next.js API routes for OCR, speech-to-text, etc., when needed.

---

## 4. Step-by-Step: How the Project Was Built (Development Process)

### Step 1: Initialize the project

- Create a **Next.js** app with **TypeScript** and **App Router**.
- Configure **path alias** `@/*` → `./src/*` in `tsconfig.json` so imports like `@/components/ui/button` work.
- Add **Tailwind CSS** and **PostCSS**; define theme in `tailwind.config.ts` and design tokens in `globals.css` (e.g. `--primary`, `--background` for light/dark).

### Step 2: Set up Firebase

- Create a Firebase project; enable **Authentication** (Email/Password) and **Firestore**.
- Add Firebase config to **environment variables** (e.g. `.env.local`: `NEXT_PUBLIC_FIREBASE_*`).
- In `src/lib/firebase.ts`: call `initializeApp()`, `getAuth()`, `getFirestore()` and export `auth` and `db`.
- In `src/lib/firestore.ts`: implement a **FirestoreService** class with methods like `saveProfile`, `getProfile`, `saveGoal`, `getGoals`, `saveTransaction`, `getTransactions`, etc., using Firestore’s `collection`, `doc`, `setDoc`, `getDoc`, `getDocs`, `query`, `where`, `orderBy`, `deleteDoc`.

### Step 3: Define data models (TypeScript types)

- In `src/lib/types.ts`: define interfaces such as **UserProfile** (role, income, fixedExpenses, dailySpendingLimit, monthlyNeeds/Wants/Savings, emergencyFund), **Goal**, **Transaction**, **FixedExpense**, **Contribution**, **EmergencyFundEntry**, **LoggedPayments**, and constants like **expenseCategories**.
- These types are used everywhere: context, Firestore, forms, and AI flows.

### Step 4: Build the global state (React Context)

- In `src/context/app-context.tsx`:
  - Use **Firebase `onAuthStateChanged`** to set `user` and `authLoaded`.
  - When the user logs in, load profile, goals, transactions, and logged payments from **localStorage** (and optionally sync from Firestore later).
  - Implement **budget calculation**: from income and fixed expenses, compute `monthlyNeeds`, `monthlyWants`, `monthlySavings`, and `dailySpendingLimit` (e.g. 60% wants / 40% savings from disposable income).
  - Expose state: `user`, `profile`, `goals`, `transactions`, `authLoaded`, etc.
  - Expose actions: `updateProfile`, `addGoal`, `updateGoal`, `addTransaction`, `updateTransaction`, `deleteTransaction`, `contributeToGoal`, `getTodaysSpending`, `getCumulativeDailySavings`, `getTotalGoalContributions`, `toggleFixedExpenseLoggedStatus`, `updateEmergencyFund`, `setEmergencyFundTarget`, `logout`, `deleteAccount`.
  - On each mutation: update React state, **persist to localStorage**, and **sync to Firestore** (FirestoreService) so data is both fast locally and stored in the cloud.
- Create **useApp** hook in `src/hooks/use-app.ts` that uses `useContext(AppContext)` so any component can access this state and actions.

### Step 5: Root layout and routing structure

- **Root layout** (`src/app/layout.tsx`): wrap the app with **AppProvider**, add **Toaster** for notifications, apply **Nunito** font and `globals.css`.
- **Landing page** (`src/app/page.tsx`): “use client” component with hero, feature cards, and CTAs; if user is logged in and has a profile, redirect to `/dashboard`.
- **Auth route group** `(auth)`: layout that centers the content; pages **login** and **signup**.
  - **Login**: form with email/password; **react-hook-form** + **Zod**; on submit call **Firebase `signInWithEmailAndPassword`**; on success redirect to `/dashboard`.
  - **Signup**: name, email, password; **createUserWithEmailAndPassword** and optionally **updateProfile** for display name; redirect to `/onboarding`.
- **App route group** `(app)`: layout that checks auth and onboarding:
  - If not authenticated → redirect to `/login`.
  - If authenticated but no `profile.role` → redirect to `/onboarding`.
  - If onboarding complete and user is on `/onboarding` → redirect to `/dashboard`.
  - Layout includes **sidebar** (navigation), **DashboardHeader**, and **Chatbot**; main content is `{children}`.

### Step 6: Onboarding flow

- **Onboarding page** (`src/app/(app)/onboarding/page.tsx`): form with **role** (Student/Professional/Housewife), **income**, and **fixed expenses** (dynamic list with name, category, amount, optional timeline and start date).
- Use **useFieldArray** for the list of fixed expenses; **Zod** schema for validation.
- Live preview of **Needs / Wants / Savings** and suggested **daily spending limit** using the same formula as in context (60/40 split).
- On submit: call **updateProfile** with the full profile (including `emergencyFund: { target: 0, current: 0, history: [] }`); then redirect to `/dashboard`.

### Step 7: Dashboard and feature pages

- **Dashboard** (`src/app/(app)/dashboard/page.tsx`): uses **useApp()** to read profile, goals, transactions; computes totals, today’s spending, cumulative daily savings, emergency fund progress; displays **StatCards**, financial breakdown (Needs/Wants/Savings), recent spending **BarChart** (Recharts), active goals with **Progress**, and **SpendingForecast** component.
- Other pages under `(app)`: **check-in**, **goals**, **expenses**, **fixed-expenses**, **emergency-fund**, **settings** – each uses **useApp()** and the shared UI components to display and mutate data via context actions.

### Step 8: Reusable UI component library

- Under `src/components/ui/`: many small components (Button, Card, Input, Form, Select, Dialog, Calendar, Sidebar, Toast, etc.) built with **Radix UI** primitives and **Tailwind**.
- **Form** component wires **react-hook-form** to **FormField**, **FormItem**, **FormLabel**, **FormControl**, **FormMessage** for consistent validation and error display.
- **cn()** utility (`src/lib/utils.ts`) combines **clsx** and **tailwind-merge** for conditional class names.

### Step 9: AI integration (Genkit + Gemini)

- In `src/ai/genkit.ts`: initialize **Genkit** with **Google AI** plugin and **GEMINI_API_KEY** (from env).
- **Flows** are defined with **definePrompt** and **defineFlow** (with `'use server'`):
  - **Conversational finance assistant** (`conversational-finance-assistant.ts`): input schema (query, role, income, fixedExpenses, dailySpendingLimit, savings); prompt instructs the model to act as PocketMate and give role-specific advice; output is `{ response: string }`.
  - **Spending alerts** (`spending-alerts.ts`): input (income, goals, expensesData); prompt asks for a concise suggestion for the next week; output `{ suggestion: string }`.
  - **Expense adjustment recommendations** (`expense-adjustment-recommendations.ts`): similar pattern for recommendations based on expenses.
- **Chatbot** (`src/components/chatbot.tsx`): floating button opens a card; user messages are appended; on send, build **ConversationalFinanceAssistantInput** from **profile** and **goals**, call **conversationalFinanceAssistant()**, then display the returned **response**.
- **SpendingForecast** (`src/components/spending-forecast.tsx`): button “Get AI forecast”; computes a simple local suggested limit from recent transactions, then calls **getSpendingAlerts()** and shows the AI **suggestion** in an Alert.

### Step 10: API routes (Next.js backend)

- **API routes** in `src/app/api/`: e.g. **OCR** (`/api/ocr`, `/api/ocr/save`), **speech-to-text** (`/api/speech-to-text`), **parse-fields** (`/api/parse-fields`). These are **server-side** route handlers (GET/POST) used for features like receipt upload or voice input; they are separate from the Genkit flows, which are invoked directly from server actions.

### Step 11: Toast notifications and polish

- **useToast** hook and **Toaster** component (from `components/ui/toast`) used for success/error feedback (e.g. “Goal added”, “Login failed”).
- **Framer Motion** on the landing page for subtle animations; **Next.js Image** for optimized images; **metadata** in root layout for title and description.

---

## 5. Key Files and Their Roles

| File / Folder | Role |
|---------------|------|
| `src/app/layout.tsx` | Root HTML, font, AppProvider, Toaster, global CSS. |
| `src/app/page.tsx` | Landing page (hero, features, CTAs); redirects logged-in users. |
| `src/app/(auth)/login/page.tsx` | Login form; Firebase sign-in; redirect to dashboard. |
| `src/app/(auth)/signup/page.tsx` | Signup form; Firebase create user + optional display name; redirect to onboarding. |
| `src/app/(app)/layout.tsx` | Auth/onboarding guards; sidebar; header; chatbot. |
| `src/app/(app)/onboarding/page.tsx` | First-time setup: role, income, fixed expenses; updateProfile. |
| `src/app/(app)/dashboard/page.tsx` | Main dashboard: stats, chart, goals, emergency fund, SpendingForecast. |
| `src/context/app-context.tsx` | Central state (user, profile, goals, transactions), budget math, localStorage + Firestore sync, all mutation actions. |
| `src/hooks/use-app.ts` | Exposes AppContext to components. |
| `src/lib/firebase.ts` | Firebase app, auth, Firestore initialization. |
| `src/lib/firestore.ts` | FirestoreService: CRUD for profiles, goals, transactions, fixed expenses. |
| `src/lib/types.ts` | TypeScript interfaces and constants for the domain. |
| `src/lib/utils.ts` | `cn()` for class names. |
| `src/components/chatbot.tsx` | Chat UI; calls conversational finance assistant AI flow. |
| `src/components/spending-forecast.tsx` | “Get AI forecast” button; calls getSpendingAlerts. |
| `src/ai/genkit.ts` | Genkit + Google AI config. |
| `src/ai/flows/*.ts` | AI prompts and flows (chatbot, spending alerts, expense recommendations). |
| `src/components/ui/*` | Reusable UI (Button, Card, Form, Input, etc.). |
| `src/app/globals.css` | Tailwind layers + CSS variables for theme. |
| `tailwind.config.ts` | Tailwind theme (colors from CSS vars, font, etc.). |
| `next.config.ts` | Next.js config (e.g. images, TypeScript/ESLint build options). |

---

## 6. Data Flow and User Journey

1. **Anonymous user** visits `/` → sees landing page; “Get Started” → `/signup`.
2. **Signup** → Firebase creates account → redirect to `/onboarding`.
3. **Onboarding** → user enters role, income, fixed expenses → **updateProfile** updates context, localStorage, and Firestore → redirect to `/dashboard`.
4. **Dashboard** → data comes from **useApp()** (profile, goals, transactions); displayed in cards and chart; “Get AI forecast” calls **getSpendingAlerts** with that data.
5. **Adding a goal** → **addGoal** in context → state update, localStorage, Firestore.saveGoal.
6. **Adding an expense** → **addTransaction** → same pattern.
7. **Chatbot** → user types message → **conversationalFinanceAssistant** is called with profile + goals → response shown in chat.
8. **Logout** → **signOut(auth)** → context clears; redirect to `/login`.

So: **UI → context actions → state + localStorage + Firestore**; **AI features** call server-side Genkit flows with data from context.

---

## 7. Design Patterns and Practices

- **Single source of truth**: All app state in **AppContext**; no duplicate profile/goals/transactions state in pages.
- **Dual persistence**: **localStorage** for fast load and offline-style behavior; **Firestore** for cloud backup and cross-device (when implemented).
- **Controlled forms**: **react-hook-form** with **Zod** resolvers; validation and errors shown via **FormMessage**.
- **Type safety**: TypeScript interfaces in `types.ts`; Zod schemas for runtime validation and inference.
- **Server vs client**: Pages that need state or event handlers use **"use client"**; AI flows use **'use server'** so they run on the server and can use API keys safely.
- **Composition**: Layouts wrap pages; shared layout provides sidebar and header; each page is a focused component that uses **useApp()** and UI primitives.
- **Accessibility**: Radix UI components handle focus, keyboard, and ARIA where applicable.

---

## 8. Security and Configuration

- **Firebase** config and **Gemini** API key come from **environment variables** (e.g. `.env.local`), not hardcoded.
- **Next.js** `NEXT_PUBLIC_*` vars are exposed to the client; secret keys (e.g. `GEMINI_API_KEY`) are server-only (used in Genkit flows and API routes).
- **Auth**: Protected routes are enforced in `(app)/layout.tsx` by redirecting unauthenticated users to `/login` and users without a profile to `/onboarding`.
- **Firestore**: Documents are keyed by `userId` or `userId_entityId` so users only access their own data when using the app with a logged-in user.

---

## 9. How to Run and Build

- **Install**: `npm install`
- **Development**: `npm run dev` (Next.js with Turbopack)
- **Build**: `npm run build`
- **Production**: `npm run start`
- **Env**: Copy `.env.example` to `.env.local` and set Firebase and (optionally) `GEMINI_API_KEY` for AI features.

---

- **What it is**: A full-stack web app for personal finance and budgeting with AI advice.
- **Frontend**: Next.js 15 + React 18 + TypeScript; Tailwind CSS and Radix UI; state in React Context.
- **Backend / data**: Firebase (Auth + Firestore); Next.js API routes for OCR/speech; Genkit (server) for AI.
- **How it was built**: Types and Firebase first; then global state (Context) with dual persistence (localStorage + Firestore); then auth and onboarding; then dashboard and feature pages; then UI library and AI flows; finally API routes and polish.
- **Languages**: TypeScript (and JSX) for logic and UI; CSS (Tailwind + globals) for styling; Zod for validation and AI schemas.

You can use this document as a script or reference when explaining the project step-by-step or when asked about any specific part (e.g. “How does the chatbot work?” or “Where is the data stored?”).
