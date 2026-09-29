# Tech Stack

## Core Framework
- React 19 with TypeScript for component-based UI development
- TanStack Start framework for server-side rendering and file-based routing
- TanStack Router for client-side routing with file-based configuration
- TanStack Query for server state management and data fetching

## Styling & UI Components
- Tailwind CSS 4 for utility-first styling
- shadcn/ui library for pre-built, accessible component system
- Radix UI primitives as the foundation for shadcn/ui components
- Tailwind-merge for className optimization
- tw-animate-css for animations

## State Management & Forms
- React Hook Form for form handling with Zod validation integration
- Zod for schema validation and type safety
- React state management through React hooks and TanStack Query

## Backend & Database
- Supabase for authentication, real-time database, and edge functions
- Drizzle ORM for type-safe database interactions
- PostgreSQL as the underlying database

## Icons & Utilities
- lucide-react for icon components
- date-fns for date manipulation and formatting
- clsx for conditional className building

## Development Tools
- Vite for fast development and building
- ESLint and Prettier for code quality
- TypeScript for type safety
- React Router for navigation (integrated with TanStack)

## Additional Libraries
- recharts for data visualization
- sonner for toast notifications
- embla-carousel-react for carousel components
- react-day-picker for calendar components
- vaul for drawer components
- input-otp for OTP input components

## Project Structure
- Source code in `src/` folder
- Routes in `src/routes/` (file-based routing)
- Components in `src/components/`
- Global styles in `src/styles.css`
- Main landing page is `src/routes/index.tsx`
- Routes configured in `src/router.tsx` and `src/routeTree.gen.ts`

## Key Rules
1. Always use shadcn/ui components when building UI elements
2. Use Tailwind CSS classes extensively for layout and styling
3. Put source code in the `src` folder
4. Use TypeScript for all components and pages
5. Leverage TanStack Query for server state management
6. Use Zod for validation with React Hook Form
7. Follow file-based routing pattern
8. Use lucide-react for all icon needs
9. Keep routes in `src/routes/` directory
10. Always update the main landing page (`src/routes/index.tsx`) to include new components

## Design Guidelines
- Use a dark theme with purple accents as the primary color scheme
- Implement subtle animations and transitions using tw-animate-css
- Use radial gradients for background effects
- Apply consistent spacing and sizing using Tailwind's design system
- Ensure all components are accessible with proper ARIA attributes
- Use responsive design patterns that work on mobile and desktop
- Implement proper loading states and error handling
- Use consistent typography with Space Grotesk for headings and DM Sans for body text