# gep-land-model-viewer-frontend

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gep-land-model-viewer-frontend&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_gep-land-model-viewer-frontend)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gep-land-model-viewer-frontend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_gep-land-model-viewer-frontend)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gep-land-model-viewer-frontend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_gep-land-model-viewer-frontend)

Core delivery platform Node.js Frontend Template.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Caching](#caching)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Linting and Formatting](#linting-and-formatting)
  - [Testing](#testing)
  - [CI/CD](#cicd)
- [Authentication](#authentication)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Branching Strategy](#branching-strategy)
- [Contributing](#contributing-to-this-project)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v24` and [npm](https://nodejs.org/) `>= v10`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd gep-land-model-viewer-frontend
nvm use
```

## Caching

Server-side session state is stored in Redis via [Catbox](https://hapi.dev/module/catbox/). Local development uses the Redis instance from Docker Compose so sessions survive server restarts. On CDP, Redis is namespaced per service (prefix: `gep-land-model-viewer-frontend:`).

Set `SESSION_CACHE_ENGINE=memory` to run without Redis. In-memory sessions are lost on every restart and not suitable for production.

## Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Local Development

### Setup

Start local services:

```bash
docker compose up -d
```

Install dependencies:

```bash
npm ci
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OS_API_KEY` | Yes | OS Maps API key with premium access. Used by the `/os/vts`, `/os/ngd` and `/os/raster` proxies to authenticate tile, sprite and glyph requests. |

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Linting and Formatting

Code style and formatting are enforced by [neostandard](https://github.com/neostandard/neostandard) via ESLint, per the [Defra JavaScript coding standards](https://defra.github.io/software-development-standards/). SCSS is linted by StyleLint with the GDS config.

```bash
npm run lint          # Check for issues (read-only)
npm run format        # Auto-fix issues
```

If you are having issues with line break formatting on Windows, update your global git config:

```bash
git config --global core.autocrlf false
```

### Testing

Run the test suite with coverage:

```bash
npm test
```

To run a single test file:

```bash
npx vitest run path/to/file.test.js
```

Test coverage must meet 90% for lines, functions, statements and branches. This is enforced by the [vitest configuration](vitest.config.js).

### CI/CD

Pull requests to `develop` and `main` trigger the [Check Pull Request](.github/workflows/check-pull-request.yml) workflow which ensures the frontend builds, linting passes, tests run with coverage thresholds met, a security audit passes, and the Docker image builds successfully.

A [Gitflow PR target check](.github/workflows/gitflow-pr-target-check.yml) runs on all pull requests to ensure branches are targeting the correct base branch.

#### Build and deploy

Merges to `develop` trigger [Publish Develop](.github/workflows/publish-develop.yml) which patch-bumps a git tag (e.g. `0.3.1`, `0.3.2`) and builds a Docker image with that version. CDP auto-deploys these to the dev environment.

Pushes to a `release/*` branch trigger [Publish Release](.github/workflows/publish-release.yml) which builds a versioned Docker image (e.g. `0.2.0`), creates a git tag, updates `package.json`, and opens a draft PR to `main` with auto-generated release notes. Release branches must be named `release/X.Y` (e.g. `release/0.2`). The branch represents the minor version line - the workflow starts at `X.Y.0` and auto-increments the patch on each push. Deploy the release artifact to staging and production via the CDP portal, then mark the PR ready for review and merge once tested.

When a PR is merged into `main`, the [Auto Back-merge](.github/workflows/auto-back-merge.yml) workflow opens a PR to merge `main` back into `develop`. Review and merge it to keep develop up to date.

Hotfixes are handled by the [Publish Hot Fix](.github/workflows/publish-hotfix.yml) workflow, triggered manually from a hotfix branch. Each trigger builds a new patch version (e.g. `0.2.1`, `0.2.2`) so fixes can be re-tested before merging. Deploy hotfix artifacts via the CDP portal.

## Authentication

The service uses OIDC (authorization code flow with PKCE) for user authentication, implemented as a custom Hapi auth scheme wrapping [openid-client](https://www.npmjs.com/package/openid-client).

Token refresh happens transparently during session validation, if the access token has expired the refresh token is used to obtain a new one before the request continues.

### Deployed environments (CDP)

AWS Cognito provides a short-lived federated token via `GetOpenIdTokenForDeveloperIdentity`. This token is sent as a `client_assertion` (JWT bearer) when communicating with the Azure AD OIDC endpoints. See the [CDP federated credentials guide](https://github.com/DEFRA/cdp-documentation/blob/main/how-to/federated-credentials.md) for background.

### Local development

Keycloak runs via Docker Compose as a local OIDC provider (port 8081). A mock credential provider signs JWTs locally instead of calling Cognito. The Keycloak realm is pre-configured with a test user:

| Username | Password |
|----------|----------|
| dev      | dev      |

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag gep-land-model-viewer-frontend`

Build:

```bash
docker build --target development --no-cache --tag gep-land-model-viewer-frontend:development .
```

Run:

```bash
docker run -p 3000:3000 gep-land-model-viewer-frontend:development
```

### Production image

Build:

```bash
docker build --no-cache --tag gep-land-model-viewer-frontend .
```

Run:

```bash
docker run -p 3000:3000 gep-land-model-viewer-frontend
```

### Docker Compose

A local environment with:

- Redis (session cache)
- Keycloak (OIDC provider, port 8081)

```bash
docker compose up --build -d
```

### Dependabot

Dependabot is configured in [.github/dependabot.yml](.github/dependabot.yml) to automatically create pull requests for dependency updates weekly.

### SonarCloud

SonarCloud runs static analysis on pull requests via the [Check Pull Request](.github/workflows/check-pull-request.yml) workflow. Configuration is in [sonar-project.properties](./sonar-project.properties). Results are available on the [SonarCloud dashboard](https://sonarcloud.io/summary/new_code?id=DEFRA_gep-land-model-viewer-frontend).

## Branching Strategy

This project follows [Gitflow](https://defra.github.io/software-development-standards/guides/developer_workflows/#gitflow) with `develop` as the integration branch and `main` for production releases. Releases and hotfixes merge into `main` only - the [Auto Back-merge](.github/workflows/auto-back-merge.yml) workflow handles syncing `main` back into `develop` automatically. See [Contributing](CONTRIBUTING.md#branching) for full details.

## Contributing to this project

Please read the [contribution guidelines](CONTRIBUTING.md) before submitting a pull request.

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
