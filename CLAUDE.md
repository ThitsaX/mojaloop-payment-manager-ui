# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `yarn start` - Run development server on port 3000
- `yarn build` - Build production bundle to `build/` folder
- `yarn test` - Run tests in watch mode
- `yarn test:nowatch` - Run tests once (CI mode)

### Code Quality
- `yarn lint` - Check ESLint rules for TypeScript/JavaScript files
- `yarn lint:fix` - Auto-fix ESLint issues
- `yarn prettier` - Format code using Prettier

### Proxy and Server
- `yarn proxy` - Start proxy server (in `proxy/` folder)
- `yarn serve` - Start production server on port 8080

### Pre-commit Requirements
Before any commit, the following must pass:
1. `yarn prettier` (auto-formatting)
2. `yarn lint` (no linting errors)
3. `yarn test:nowatch` (all tests pass)

## Architecture Overview

### Technology Stack
- **React 16.13** with TypeScript
- **Redux + Redux-Saga** for state management
- **Connected React Router** for routing
- **ModusBox UI Components** for UI library
- **ApexCharts** for data visualization
- **Axios** for HTTP requests

### Project Structure

#### Core Application (`src/App/`)
- **ConnectionWizard/** - Multi-step setup flow for DFSP configuration
  - Environment setup (Business/Technical)
  - Certificate management (CA, JWS, TLS)
  - Endpoint configuration (Hub, Ingress, Egress)
- **Dashboard/** - Main analytics dashboard with financial metrics
- **Transfers/** - Payment transfer monitoring and analytics
- **FxpConversions/** - Foreign exchange conversion tracking
- **TechnicalDashboard/** - System health and connection monitoring

#### State Management Pattern
Each major feature follows this Redux structure:
- `actions.ts` - Action creators
- `reducers.ts` - State reducers
- `sagas.ts` - Side effects (API calls, async logic)
- `selectors.ts` - State selectors with reselect
- `types.ts` - TypeScript interfaces

#### Component Organization
- **Shared components** in `src/components/`
- **Feature-specific components** in respective feature folders
- **Layout components** in `src/App/Layout/`

### Key Architectural Patterns

#### HOCs and Data Loading
- Features use Higher-Order Components (HOCs) for data loading
- Pattern: `hocs/loadFeatureName.tsx` wraps components with data fetching logic
- Example: `ConnectionWizard/Environment/hocs/loadEnvironment.tsx`

#### Certificate Management
Complex certificate handling across multiple areas:
- **DFSP CA** - Certificate Authority management
- **JWS Certificates** - JSON Web Signature certificates
- **TLS Client/Server** - Transport Layer Security certificates
- **CSR Exchange** - Certificate Signing Request workflow

#### API Integration
- **Base URL configuration** via `API_BASE_URL` environment variable
- **Proxy setup** for local development against remote APIs
- **Authentication** via external providers (CHECK_SESSION_URL, LOGIN_URL)

### Development Workflow

#### TypeScript Configuration
- `baseUrl: "src"` allows absolute imports from src/
- Strict TypeScript settings enabled
- React JSX compilation

#### Testing
- React Testing Library for component tests
- Jest for unit tests
- Redux-Saga testing utilities for async logic testing

#### Styling
- **BEM naming convention** for CSS classes
- **SCSS support** with sass-loader
- **Component-scoped CSS** files alongside components

#### Build Process
- **react-app-rewired** for custom webpack configuration
- **SVG sprite loader** for icon management
- **config-overrides.js** for build customizations

### Important Notes

#### Version Management
- Use `yarn version` for version bumps (patch for fixes, minor for features)
- Standard-version for automated changelog generation

#### Docker Deployment
- Build: `docker build --build-arg API_BASE_URL=http://backend-url:3000 -t mojaloop-payment-manager-ui .`
- Run: `docker run --rm -p 8080:8080 mojaloop-payment-manager-ui`
- Or use Makefile: `make build` and `make run`

#### External Authentication
Set environment variables for external auth:
- `CHECK_SESSION_URL` - Session validation endpoint
- `LOGIN_URL` - Authentication redirect URL
- `LOGIN_PROVIDER` - Provider name for login redirect