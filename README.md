# EVA

AI-powered social media content generator and scheduler built for the AGIREADY.io Hiring Drive 2026 technical assessment.

Live product: https://eva-project.vercel.app

Repository: https://github.com/Arpit-oo/eva

## What I Built

EVA is a SaaS product for solopreneurs and small brands who need a full week of platform-specific social content without manually writing every post. A user sets up their brand profile, generates a weekly content plan, reviews and edits posts, schedules them in a visual calendar, stores reusable templates, and captures ideas on the go through Telegram.

The product was built to satisfy the original MVP brief and then extended with several higher-leverage features that improved product quality, usability, and differentiation.

## Task Coverage

### Core MVP requested in the task

- User auth with email/password
- Brand profile setup with niche, tone, audience, and keywords
- AI generation of a 7-day post plan
- Multi-platform post generation
- Captions, hashtags, image prompt, and best-posting-time generation
- Content calendar with month and week views
- Edit individual posts before publishing
- Content library and reusable templates

### Bonus and beyond-scope features built

- Telegram bot integration for `/start`, `/capture_idea`, and `/generate_week`
- Content quality analyzer with score, strengths, suggestions, and one-click caption replacement
- Manual image upload inside the editor
- AI image generation flow using Puter.js on the client side
- Server-side video generation pipeline using Replicate during development exploration
- Facebook and Instagram publishing backend flows implemented via Meta Graph APIs
- LinkedIn and X/Twitter OAuth connection flows
- Responsive premium dark UI with redesigned dashboard, calendar, settings, library, and templates
- Post scheduling metrics, agenda panel, better month/week calendar handling, and stronger modal editing UX

## What Shipped vs What Was Explored

This project was treated like a startup product, not just a checklist implementation. That meant building more than the assignment asked for, but also making pragmatic decisions about what should stay user-facing in the final MVP.

### Shipped as active MVP behavior

- Email/password authentication
- Brand onboarding and settings-based brand management
- 7-day AI strategy generation
- Post generation with caption, hashtags, image prompt, and posting time
- Calendar scheduling and editing flow
- Library and templates
- Telegram capture and weekly generation workflows
- AI caption analysis and improvement
- Client-side image generation and upload support
- LinkedIn and X/Twitter connection flow groundwork

### Built during development but intentionally gated or deprioritized

- Google auth UI remains visual-only in MVP
- Direct Twitter publishing is disabled in MVP because of cost constraints
- Video generation is disabled in MVP because of cost constraints
- Instagram and Facebook onboarding entry points were removed from the simplified current UX, even though Meta integration groundwork and publishing logic were implemented during development

This is deliberate product prioritization: build the hard parts, validate the architecture, but keep the public MVP lean and inexpensive to run.

## Product Process and Decisions

The project was built in stages, following the structure of the task while making product-driven adjustments whenever cost, reliability, or speed mattered more than checking a box.

### 1. Start with the narrowest usable loop

The first goal was not to build everything. The first goal was to make one complete user journey work:

1. Sign up or log in
2. Define brand context
3. Generate a strategy
4. Generate posts
5. Edit and schedule them
6. View them in a calendar and library

That loop gave a working product foundation early and made it easier to expand safely.

### 2. Build the core platform around structured AI outputs

The most important technical risk in this product is not frontend polish. It is AI reliability. So the generation pipeline was designed around structured JSON outputs instead of loose text generation.

That reduced failure cases in:

- strategy generation
- post generation
- content evaluation
- scheduling metadata extraction

This decision made the rest of the product easier to build because the UI could assume predictable shapes.

### 3. Prioritize free-tier leverage over expensive architecture

One of the strongest strategic decisions was to avoid building a cost-heavy MVP.

Examples:

- Used Vercel plus Supabase free-tier architecture for hosting, auth, database, storage, and serverless APIs
- Kept the app inside Next.js App Router instead of splitting frontend and backend unnecessarily
- Used lower-cost OpenAI model paths for content workflows instead of overpaying for larger models where unnecessary
- Shifted image generation to Puter.js client-side, so generation could happen without a heavy server-side media bill
- Preserved manual upload and fallbacks so the product still works even when AI generation is skipped
- Disabled high-cost MVP behaviors such as direct Twitter publish and video generation in the final surfaced UX

This is how an early-stage founder should think: ship user value, minimize burn, and only pay for what users prove they need.

### 4. Expand from the assignment into real product behavior

After the MVP loop worked, the next focus was making EVA feel like a real SaaS product:

- post editor
- templates
- calendar agenda experience
- better scheduling interactions
- Telegram support for idea capture
- direct-publishing groundwork
- media support for images and video
- stronger settings, auth, and social connection UX

This moved the project from assessment submission to something closer to a real product operating system for content creation.

### 5. Reduce friction with product simplification

As the app matured, several features were intentionally simplified in the surfaced UX:

- Google auth removed from active behavior but preserved visually
- Instagram and Facebook removed from the primary onboarding connect flow
- Expensive actions replaced with honest MVP messaging

That is not a step backward. It is a product maturity decision. The current UX is narrower but more coherent, less risky, and more believable for a free MVP.

## Tech Stack and Why

### Frontend

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui and Radix primitives

Why:

- Next.js App Router gives one codebase for frontend, backend APIs, auth middleware, and deployment on Vercel
- React provides fast UI iteration and flexible component composition
- TypeScript reduces integration mistakes across AI responses, database rows, route handlers, and scheduling logic
- Tailwind plus shadcn/ui made it possible to build a polished SaaS UI quickly without creating a custom component system from scratch

### Backend and platform

- Next.js Route Handlers
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase RLS
- Vercel deployment

Why:

- Supabase gave auth, relational storage, and file storage with minimal setup time
- PostgreSQL fits structured product entities well: users, brand profiles, strategies, posts, templates, ideas, and social connections
- RLS is critical for a multi-tenant SaaS product and gives production-grade isolation early
- Vercel is the fastest path to a deployed product for a Next.js app

### AI layer

- OpenAI Node SDK
- Structured JSON prompting
- Puter.js for client-side image generation
- Replicate SDK for video pipeline exploration

Why:

- OpenAI handled the text intelligence layer for strategy generation, post generation, and content analysis
- JSON-shaped prompting made the app dependable enough for product use, not just demos
- Puter.js was a strategic free-first decision for image generation because it avoided pushing more cost into the backend
- Replicate was used where server-side video experimentation made sense, but the feature was later gated in MVP because it was too expensive relative to likely early-stage value

### Scheduling and interaction layer

- FullCalendar

Why:

- Fastest route to robust calendar behavior
- Supports month and week views
- Good fit for scheduling-oriented SaaS products
- Allowed a high-polish calendar experience without building custom scheduling UI from scratch

### Bot and async extensions

- grammY
- Vercel serverless webhook route

Why:

- Telegram is a strong low-cost channel for quick capture workflows
- It extends EVA beyond the web app and creates a stronger product story than a standard CRUD SaaS

## Architecture Summary

EVA uses a serverless SaaS architecture:

- Client UI in Next.js and React
- API routes for business logic and integrations
- Supabase for auth, database, and storage
- OpenAI for text generation
- FullCalendar for scheduling UX
- Telegram webhook for external capture and generation triggers

This architecture was chosen because it is fast to build, cheap to operate, and easy to deploy on free tiers.

## Key Product Features

### Authentication and onboarding

- Email/password auth
- Protected app routes
- Brand profile onboarding and active-profile management

### AI strategy engine

- Generates a 7-day content strategy from brand profile inputs
- Produces per-day themes, content types, and target emotions

### AI post generation

- Generates platform-specific posts from the strategy
- Produces captions, hashtags, image prompts, and posting times

### Post editor

- Edit caption, hashtags, platform, date, time, and image prompt
- Save, delete, schedule, template-save, analyze, and improve actions

### Calendar and scheduling

- Month and week view
- Time-aware events in week view
- Agenda sidebar
- Unscheduled drafts panel

### Library and templates

- Central library for generated and saved posts
- Reusable template system

### Telegram bot

- Link account through token-based `/start`
- Capture ideas via `/capture_idea`
- Generate weekly content via `/generate_week`

### Social publishing groundwork

- LinkedIn OAuth flow
- X/Twitter OAuth flow
- Meta integration groundwork for Facebook and Instagram
- Publish path with user-facing gating where cost or operational risk is too high for MVP

## Free-Tier and Cost-Conscious Product Choices

This is one of the strongest parts of the project.

The original task explicitly encouraged free-tier deployment. EVA was built with that in mind.

### Decisions that reduced cost while preserving product value

- Vercel for hosting and serverless APIs
- Supabase for auth, database, and storage under one free-tier umbrella
- OpenAI used where it creates core value, not for every non-essential UI interaction
- Puter.js used client-side for image generation to avoid a backend media bill
- Expensive MVP behaviors such as video generation and direct Twitter publishing were built and tested but then gated from the final surfaced UX
- Manual upload and editing flows ensure the product still works even without paid media generation enabled

This is the right startup tradeoff: preserve the main user promise without letting infrastructure costs balloon before usage validates them.

## Original Task vs Final Product

### Requested in the task

- AI-powered content generator and scheduler for small brands
- At least two platforms
- Captions, hashtags, image suggestions, and posting time
- Week and month calendar
- Edit and regenerate posts
- Content library and templates

### Final product delivered

- All of the above, plus:
- Telegram bot integration
- Content quality analyzer
- Client-side AI image generation
- Media upload workflow
- Social connection architecture
- Facebook and Instagram publishing groundwork
- Premium responsive product UI
- Production deployment on Vercel

### Founder-level interpretation of the assignment

Instead of building the smallest literal submission, the product was pushed toward a believable startup MVP:

- real onboarding
- real data model
- real scheduling UX
- real content operations workflow
- real deployment
- real multi-surface interaction through Telegram

That is what makes the project stronger than a typical assessment submission.

## Local Setup

### Prerequisites

- Node.js 18+
- npm
- Supabase project
- OpenAI API key

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

### Production build

```bash
npm run build
```

## Environment Variables

Create a `.env.local` file with the required keys. The project includes `.env.local.example` for reference.

Typical keys used in the project include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `REPLICATE_API_TOKEN`
- `REPLICATE_VIDEO_MODEL`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_CONFIG_ID`
- `TELEGRAM_BOT_TOKEN`
- `NEXT_PUBLIC_APP_URL`

## Deployment

Deployed on Vercel:

- https://eva-project.vercel.app

The app is production-tested through Vercel deploy and build cycles and wired to Supabase-backed storage, auth, and database flows.

## Approach and Why It Matters

The project was not approached as just finishing a checklist.

It was approached like an early-stage startup product:

- build the narrowest usable loop first
- make the AI pipeline reliable
- add real product differentiation
- keep costs under control
- ship a live product
- simplify aggressively where the MVP would otherwise become expensive or fragile

That combination of shipping speed, product judgment, and cost discipline is the biggest strength of EVA.

## Submission Answers

### Q1. What was the process for building this product?

I built the product in a staged, startup-style way rather than trying to brute-force every feature at once. I started by making the core loop work end to end: authentication, brand profile setup, strategy generation, post generation, editing, and scheduling. Once that loop was stable, I layered in higher-value extensions such as the content calendar, template library, Telegram idea capture, and content quality analysis.

The process was guided by two principles: reliability and leverage. Reliability meant using structured AI outputs so the app could safely consume generated strategies, posts, and evaluations without brittle parsing. Leverage meant prioritizing the features that created the biggest jump in user value, such as generating a full week of content in one shot and letting the user immediately edit, schedule, and reuse those posts.

After the core experience worked, I treated the project like a real SaaS product rather than a one-off assessment. I improved the product shell, built settings and onboarding flows, added templates, added Telegram integration, explored direct publishing and media generation, and then simplified some high-cost features for the final MVP. For example, I implemented image and video generation flows and Meta publishing groundwork, but kept the public MVP lean where infrastructure or API costs were not justified yet.

So the actual process was: ship the main user loop first, harden the architecture, extend into differentiating features, then trim the surfaced MVP to keep it fast, coherent, and low-cost.

### Q2. Tech stack used in the project and why so?

I used Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui, Supabase, OpenAI, FullCalendar, and Vercel.

Next.js App Router was the best choice because it let me build the frontend, backend API routes, middleware, and deployment pipeline in one codebase. That reduced complexity and made it easy to iterate quickly. React and TypeScript gave me a maintainable frontend with strong typing across forms, API responses, and AI-generated data.

Supabase was chosen because it gave me authentication, PostgreSQL, storage, and row-level security in a single platform, which is ideal for a multi-tenant SaaS MVP. OpenAI powered the strategy generation, post generation, and content analysis flows. FullCalendar was the fastest reliable way to build a proper scheduling experience with month and week views.

For media, I made cost-conscious decisions. I used Puter.js client-side for image generation so the app could support AI image creation without immediately increasing backend costs. I also explored Replicate for video generation, but because that is more expensive operationally, I gated it in the final MVP rather than forcing it into the core user flow. Deployment was done on Vercel because it is the most natural fit for a Next.js app and works well on free tiers.

Overall, the stack was chosen for one reason: maximize speed of execution and product quality while staying deployable and affordable for a real MVP.
