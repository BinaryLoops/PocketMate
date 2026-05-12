# PocketMate - DBMS Project (Personal Finance Management)

PocketMate is a DBMS-oriented personal finance web application built with Next.js, Firebase Authentication, and Cloud Firestore.

This README explains the project from a **database design and data flow** perspective: schema, relationships, CRUD/query operations, integrity decisions, and how data-driven features (Gmail sync, statement import, analytics, AI insights) depend on the database.

## Team
- Ayush
---

## 1) Problem Statement

Users need one system to:

- manage profile/income/fixed expenses,
- track transactions and savings goals,
- monitor emergency fund progress,
- import external financial activity (Gmail + bank statements),
- and receive analytics/AI suggestions.

The database is the backbone for all these operations.

---

## 2) Tech Stack

- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS
- Auth: Firebase Authentication (Email/Password)
- Database: Cloud Firestore (NoSQL document database)
- Server routes: Next.js API routes
- AI: Genkit + Gemini
- Data ingestion: Gmail API + PDF/Excel/CSV statement parser

---

## 3) DBMS Architecture and Data Model

## 3.1 Identity Layer

- Firebase Authentication stores user identity and credentials.
- `uid` is the canonical user key used as foreign-key-like reference in Firestore.

## 3.2 Firestore Collections (Logical Tables)

### `profiles` (1:1 with user)

- Doc ID: `uid`
- Core fields:
  - `role`, `income`
  - `fixedExpenses[]`
  - computed budget fields: `monthlyNeeds`, `monthlyWants`, `monthlySavings`, `dailySpendingLimit`
  - `emergencyFund` (`target`, `current`, `history[]`)

### `goals` (1:N with user)

- Doc ID: `uid_goalId`
- Fields:
  - `id`, `userId`, `name`
  - `targetAmount`, `currentAmount`, `monthlyContribution`
  - `timelineMonths`, `startDate`, `contributions[]`

### `transactions` (1:N with user)

- Doc ID: `uid_transactionId`
- Fields:
  - `id`, `userId`, `amount`, `category`, `description`, `date`
  - optional import metadata: `importSource`, `importMessageId`, `importRef`

### `fixed-expenses` (1:N with user)

- Doc ID: `uid_expenseId`
- Fields:
  - `id`, `userId`, `name`, `amount`, `category`, `timelineMonths`, `startDate`

### `gmailIntegrations` (1:1 with user)

- Doc ID: `uid`
- Fields:
  - OAuth refresh token and scopes
  - `connectedEmail`
  - sync metadata (`lastSyncedAt`, `processedMessageIds[]`)

## 3.3 Relationship Mapping

In relational terms:

- `users(uid)` -> `profiles(uid)` [1:1]
- `users(uid)` -> `goals(userId)` [1:N]
- `users(uid)` -> `transactions(userId)` [1:N]
- `users(uid)` -> `fixed-expenses(userId)` [1:N]
- `users(uid)` -> `gmailIntegrations(userId)` [1:1]

Firestore is document-based, but key patterns and `userId` fields enforce relational discipline.

---

## 4) CRUD and Query Layer

All core DB operations are centralized in:

- `src/lib/firestore.ts` (`FirestoreService`)

### Create / Upsert

- `saveProfile`, `saveGoal`, `saveTransaction`, `saveFixedExpense`

### Read

- `getProfile`
- `getGoals` (`where userId == uid`, ordered by `startDate`)
- `getTransactions` (`where userId == uid`, ordered by `date`)
- `getFixedExpenses`

### Delete

- `deleteGoal`, `deleteTransaction`, `deleteFixedExpense`
- `deleteUserData` performs a cascade-style cleanup for all user-linked records

---

## 5) Data Integrity Decisions (DBMS Focus)

## 5.1 Key Design

- Composite-style document IDs (e.g., `uid_transactionId`) avoid cross-user collisions.
- `uid` from auth acts as the root ownership key.

## 5.2 Application-Level Constraints

- Schema shape is enforced via TypeScript interfaces and Zod validation in forms/flows.
- Undefined fields are stripped before writes (`stripUndefined`) to satisfy Firestore constraints.

## 5.3 Duplicate Prevention for Imports

For Gmail/statement imports, the app uses multi-level de-duplication:

- primary: exact transaction ID,
- secondary fingerprint: reference code (`UTR/RRN/UPI Ref`) + amount,
- fallback fingerprint: rounded timestamp + amount + normalized description.

This prevents duplicate insertion while allowing true new records.

---

## 6) How Database Drives Features

## 6.1 Dashboard and Analytics

Dashboard cards/charts are computed from persisted `transactions`, `goals`, and `profile` data.

## 6.2 Gmail Transaction Sync

- OAuth tokens are stored server-side.
- Emails are parsed into structured transactions.
- Parsed records are written to `transactions` and merged into app state.

## 6.3 Bank Statement Import (PDF/Excel/CSV)

- Upload -> parse route -> structured rows -> import into `transactions`.
- Debit rows contribute to spending analytics.
- Credit totals can update profile income.

## 6.4 Goals and Emergency Fund

Both are persisted entities, not temporary UI data, enabling historical continuity.

---

## 7) Security and Access Control

## 7.1 Authentication

- Only authenticated users can operate on user data.

## 7.2 Firestore Rules (baseline)

Use authenticated access rules and tighten to per-user ownership in production.

Example baseline:

```text
match /databases/{database}/documents {
  match /{document=**} {
    allow read, write: if request.auth != null;
  }
}
```

Recommended production enhancement: restrict documents by `request.auth.uid == resource.data.userId` where applicable.

## 7.3 Secret Handling

- Firebase client config in `NEXT_PUBLIC_*`.
- Server secrets (`GEMINI_API_KEY`, Google OAuth secrets, Firebase Admin key) stay server-side in env variables.

---

## 8) Project Structure (Relevant to DBMS)

- `src/lib/firebase.ts`: Firebase client initialization (Auth + Firestore)
- `src/lib/firestore.ts`: centralized database service (CRUD/query layer)
- `src/lib/types.ts`: domain schema contracts (Profile, Goal, Transaction, etc.)
- `src/context/app-context.tsx`: application state + persistence orchestration
- `src/app/api/gmail/*`: Gmail sync integration endpoints
- `src/app/api/bank-statement/parse/route.ts`: statement parsing and import preprocessing

---

## 9) Setup and Run

## 9.1 Install

```bash
npm install
```

## 9.2 Configure Environment

Create `.env.local` (see `.env.example`) and provide:

- Firebase client variables (`NEXT_PUBLIC_FIREBASE_*`)
- `GEMINI_API_KEY` (optional for AI features)
- Gmail OAuth + Firebase Admin vars (if using Gmail sync)

## 9.3 Run

```bash
npm run dev
```

Open:

- `http://localhost:3000`

---

## 10) DBMS Learning Outcomes Demonstrated

- Mapping real-world finance domain into a NoSQL schema with relational discipline
- Modeling 1:1 and 1:N relationships using document IDs and ownership keys
- Building centralized CRUD/query service layer
- Designing idempotent ingestion pipelines (Gmail, statement import) with de-duplication
- Applying auth-driven access control and secure secret separation
