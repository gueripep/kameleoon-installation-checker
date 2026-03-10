# Kameleoon Installation Validator (v2 Next.js)

An aesthetic, powerful Next.js web application designed to automatically test and validate Kameleoon script deployments across web applications.

## Features
- **Engine Checker**: Bulk analyze multiple URLs to detect the presence of `engine.js` vs `kameleoon.js`.
- **Installation Validation**: Perform deep diagnostic checks on a single URL including CSP Header analysis, Anti-Flicker snippet validation, execution permissions, and loading performance.

## Getting Started

### Prerequisites
- Node.js (v18+)
- A local browser installation (Chromium/Puppeteer drops in automatically on `npm install`)

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App Locally

To start the development server, run:
```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

> **Note on deployment:** This application uses Puppeteer under the hood. If deploying to Vercel/Serverless Edge architectures, you must configure a remote Chromium instance (like Browserless.io) due to the strict lambda package size limits. Running it locally via `npm run dev` or a traditional Dockerized Node.js environment is recommended.
