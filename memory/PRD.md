# Relio CRM — Product Requirements Document

## Problem Statement
Rebuild Relio CRM frontend from scratch with production-level quality, Neo-Claymorphism design inspired by Clay.com, with warm orange/brown palette. Frontend-only with mock data — backend to be connected later.

## Architecture
- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: TailwindCSS v4 + custom Neo-Claymorphism CSS design system
- **Fonts**: Manrope (headings), Work Sans (body)
- **State**: React state + TanStack Query
- **DnD**: @dnd-kit/core (Pipeline Kanban)
- **Graph**: @xyflow/react + d3-force (Network)
- **Branch**: `frontend-redesign`

## What's Implemented (Jan 2, 2026)

### Dashboard (v3 — Command Center)
- [x] Bento grid layout with momentum arc (SVG gauge) + contextual greeting
- [x] Stat tiles: Active Threads, Going Silent, Hot Contacts, Overdue Touch
- [x] "Today's Focus" — priority action cards with avatars, warmth badges, CTAs
- [x] Network Health — donut ring chart with tier distribution
- [x] Recent Activity feed
- [x] **Pipeline Velocity** — horizontal bar chart per stage (Intro 6.2d, Meeting 8.5d, DD 12.3d, Term Sheet 4.1d), avg close time (28.4d), "Stuck in Stage" warning panel
- [x] **Activity Heatmap** — GitHub-style 12-week grid, hover interaction, legend
- [x] Weekly Grades — letter-grade badges (A, B+, A-, B)

### Network (3 View Modes)
- [x] Force Graph, Radial Map, Table View with toggle
- [x] Filters + Recompute + Contact detail panel

### Settings (Completely Redesigned v2)
- [x] Account — Profile hero card with avatar, camera button, member since date, editable fields
- [x] Integrations — Gradient icon cards (Gmail/Calendar/LinkedIn) with feature pills, connection status
- [x] Notifications — Morning digest toggles, delivery time, timezone, real-time alert toggles (hot alerts, ghost warnings)
- [x] AI & Drafts — Auto-generate toggle, signature toggle, length select, **Writing Tone picker** (2x2 grid: Warm & Professional, Direct & Concise, Formal, Conversational) with **live preview**
- [x] Security — Password change, Active Sessions card, Delete Account danger zone
- [x] Plan card — $0/mo Free Plan with Upgrade to Pro CTA

### Other Pages
- [x] Contacts List + Detail, Pipeline Kanban, Drafts, Auth (Login/Signup)
- [x] Sidebar, Topbar, full design system

## Prioritized Backlog
### P0 — Connect real NestJS backend
### P1 — Add Contact modal, Contact drawer, Pipeline toasts, Mobile responsive
### P2 — Draft rich text, Dark mode, Email notifications
### P3 — Keyboard shortcuts, Relationship health trend chart over time
