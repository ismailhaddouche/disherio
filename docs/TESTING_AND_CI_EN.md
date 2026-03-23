# Testing and CI/CD in Disher.io

This document describes the automated testing strategy and Continuous Integration/Deployment (CI/CD) flows configured for the project.

---

## 1. Automated Testing

The Disher.io backend features a suite of integration and unit tests based on **Jest** and **Supertest**.

Given that the application manages orders, billing, and inventory, ensuring code integrity is critical.

### 1.1 Testing Environment
- **Framework:** `Jest` (with explicit support for ECMAScript Modules `export/import`).
- **HTTP Requests:** `Supertest` to spin up the API in memory and attack different endpoints.
- **EPHEMERAL Database:** Uses `mongodb-memory-server`. This is a MongoDB binary that runs temporarily in RAM, ensuring that:
  1. Tests don't overwrite the local development database.
  2. All tests start from a 100% blank database.
  3. No need to have Docker or Mongo installed locally just for testing.

### 1.2 Running Tests Locally

To run the complete test suite:

```bash
cd backend
npm install
npm test
```

Underneath, the `test` script in `package.json` injects the necessary Node.js flags to support ES Modules:
`cross-env NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit --detectOpenHandles`

### 1.3 Test Structure

Tests are located in the `backend/src/__tests__/` directory. All protected routes first simulate a login (`/api/auth/login`) to obtain a valid JWT token (using the `disher_token` cookie) and inject it with Supertest in subsequent requests.

---

## 2. GitHub Actions (CI/CD)

Disher.io makes extensive use of **GitHub Actions** (`.github/workflows/`) to automate multi-platform builds and installer packaging.

### 2.1 Docker Image Building (`docker-build.yml`)

This pipeline runs automatically and handles packaging the source code into production Docker containers.

- **When it runs:** On `push` to `main` or `develop` branches, when pushing a tag (e.g., `v2.6`), or on Pull Requests targeting `main`.
- **What it does:**
  1. Clones the repository and prepares Buildx.
  2. Runs a `build-amd64` job (`frontend`/`backend` matrix) to build `linux/amd64` images.
  3. Runs a `build-arm64` job (`frontend`/`backend` matrix) to build `linux/arm64` images in isolation (with QEMU in this job).
  4. Publishes architecture-specific tags (`-amd64` and `-arm64`) and, on `push`, creates a final multi-arch manifest with `docker buildx imagetools`.
  5. Additionally runs `test`, `security-scan`, and `notify` jobs to validate quality and overall pipeline status.

> **Note for Pull Requests:** In PRs, images are built to validate the build, but no multi-arch manifest or final push to the registry is published.

> **Important:** GitHub's temporary alert about certain actions running on "Node 20 vs Node 24" is a warning from Docker's official third-party libraries, not a security issue in Disher.io's pure code.

### 2.2 Offline Installer Generation (`build-installer.yml`)

This pipeline is **Manual** (`workflow_dispatch`). It's designed to package the entire Disher ecosystem into a single compressed `.tar.gz` file, ready to be carried on a USB drive to a restaurant that doesn't have internet access at installation time.

- **How to run:** From the "Actions" tab in GitHub → Click "Build Offline Installer" → "Run workflow".
- **Options:** Allows choosing whether to generate the installer for `linux/amd64` or `linux/arm64`.
- **What it does:**
  1. Compiles frontend and backend locally on GitHub servers.
  2. Locally downloads `mongo:7` and `caddy:2` images.
  3. Runs `docker save` to dump the 4 required images into a giant `images.tar` file.
  4. Automatically generates the final production `docker-compose.yml` file.
  5. Copies `install.sh` and `configure.sh` scripts.
  6. Compresses everything into a file (e.g., `disher-setup-linux-amd64.tar.gz`) available for **Download** on the same execution page for 30 days.
