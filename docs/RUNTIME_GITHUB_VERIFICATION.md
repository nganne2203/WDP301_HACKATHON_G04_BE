# Runtime and GitHub Verification Sprint

This sprint is intentionally focused on proving the runtime end-to-end before moving deeper into later code phases.

## Goal

Done means one real GitHub push travels through:

1. GitHub repository webhook
2. `POST /api/github/webhooks`
3. MongoDB delivery persistence
4. Redis queue
5. worker processing
6. commit and diff evidence persistence

No mocked webhook flow is required for this verification.

## Runtime topology

- `api`: Express HTTP server, receives UI traffic and GitHub webhooks
- `worker`: BullMQ consumer for webhook and evidence jobs
- `mongo`: application database
- `redis`: queue backend

## Files added for this sprint

- [docker-compose.yml](/e:/Code_Ky8/WDP301/Project/WDP301_HACKATHON_G04_BE/docker-compose.yml)
- [.env.example](/e:/Code_Ky8/WDP301/Project/WDP301_HACKATHON_G04_BE/.env.example)

## 1. Prepare local environment

Copy `.env.example` into `.env` and set at least:

```env
JWT_SECRET=replace_me
REFRESH_TOKEN_SECRET=replace_me_refresh
TOKEN_ENCRYPTION_SECRET=replace_me_token_encryption_secret
GITHUB_WEBHOOK_SECRET=replace_me_github_webhook_secret
APP_BASE_URL=http://localhost:3000
```

For real GitHub local webhook verification, `localhost` is not publicly reachable. Use a tunnel and set:

```env
GITHUB_WEBHOOK_CALLBACK_URL=https://your-public-tunnel-url/api/github/webhooks
```

You can use either:

- `ngrok http 3000`
- `cloudflared tunnel --url http://localhost:3000`

Keep `STATIC_ANALYSIS_ESLINT_COMMAND` and `STATIC_ANALYSIS_TSC_COMMAND` empty during this sprint unless the worker container also has the target repository checkout and analysis toolchain.

## 2. Start runtime

Build and run services:

```powershell
npm run docker:up
```

Seed the database:

```powershell
docker compose run --rm db-init
```

Follow logs:

```powershell
npm run docker:logs
```

Health checks:

- API: `http://localhost:3000/health`
- API readiness: `http://localhost:3000/ready`
- Swagger: `http://localhost:3000/api-docs`

## 3. Login with seeded admin account

Seed script currently creates:

- email: `admin@seal-hackathon.example.com`
- password: `Password123!`

Login:

```powershell
curl.exe -X POST "http://localhost:3000/api/auth/login" `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"admin@seal-hackathon.example.com\",\"password\":\"Password123!\"}"
```

Save the returned `accessToken`.

## 4. Find an event ID

List events:

```powershell
curl.exe "http://localhost:3000/api/events" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Pick one `eventId` from the response.

## 5. Save GitHub organization configuration

The current backend expects an org owner, a GitHub username, and a PAT with permission to create repos and manage webhooks in that org.

```powershell
curl.exe -X POST "http://localhost:3000/api/github/config" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"eventId\":\"YOUR_EVENT_ID\",\"organizationName\":\"YOUR_GITHUB_ORG\",\"ownerUsername\":\"YOUR_GITHUB_USERNAME\",\"githubToken\":\"YOUR_GITHUB_PAT\",\"enabled\":true}"
```

Optional connection test:

```powershell
curl.exe -X POST "http://localhost:3000/api/github/config/test" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"eventId\":\"YOUR_EVENT_ID\"}"
```

## 6. Create a real test repository through the API

```powershell
curl.exe -X POST "http://localhost:3000/api/github/repositories" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"eventId\":\"YOUR_EVENT_ID\",\"repoName\":\"seal-runtime-verification\",\"description\":\"Runtime verification repo\",\"private\":true}"
```

Expected result:

- GitHub repo is created in the configured org
- internal repository record is created
- backend attempts webhook registration automatically

## 7. Verify webhook registration

Confirm either:

- response payload contains `webhookRegistration`
- GitHub repository settings show an active webhook

If you need to retry manually:

```powershell
curl.exe -X POST "http://localhost:3000/api/github/repositories/seal-runtime-verification/webhooks/register" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"eventId\":\"YOUR_EVENT_ID\"}"
```

## 8. Push a real commit

Clone the test repo, create one small commit, and push:

```powershell
git clone https://github.com/YOUR_GITHUB_ORG/seal-runtime-verification.git
cd seal-runtime-verification
"runtime verification" | Out-File README.md -Append
git add README.md
git commit -m "test: runtime webhook verification"
git push origin main
```

## 9. Verify delivery persistence in MongoDB

Open Mongo shell inside the container:

```powershell
docker compose exec mongo mongosh seal_db
```

Check webhook deliveries:

```javascript
db.githubwebhookevents.find({}, {
  deliveryId: 1,
  eventType: 1,
  repositoryFullName: 1,
  status: 1,
  signatureValid: 1,
  beforeCommitSha: 1,
  afterCommitSha: 1,
  receivedAt: 1,
  processedAt: 1,
  errorMessage: 1
}).sort({ receivedAt: -1 }).limit(5)
```

Expected lifecycle for a successful push:

- `RECEIVED`
- `QUEUED`
- `PROCESSING`
- `PROCESSED`

## 10. Verify queue and worker handling

Watch runtime logs:

```powershell
docker compose logs -f api worker
```

Expected worker log sequence includes:

- webhook accepted by API
- `Queued GitHub push event received by worker`
- `Queue job completed`

If a job fails, the worker log should show `Queue job failed` with the job name.

## 11. Verify commit and diff evidence

Inside Mongo shell, inspect evidence collections:

```javascript
db.commits.find({}, {
  commitSha: 1,
  repositoryFullName: 1,
  branch: 1,
  message: 1,
  timestamp: 1
}).sort({ createdAt: -1 }).limit(5)
```

```javascript
db.commitdiffs.find({}, {
  headCommitSha: 1,
  baseCommitSha: 1,
  status: 1,
  totalFiles: 1,
  includedFiles: 1,
  excludedFiles: 1,
  totalCleanPatchSize: 1,
  fetchedAt: 1
}).sort({ fetchedAt: -1 }).limit(5)
```

Also verify repository sync state:

```javascript
db.repositories.find({}, {
  repositoryFullName: 1,
  latestCommitSha: 1,
  lastProcessedCommitSha: 1,
  webhookStatus: 1,
  lastSyncAt: 1
}).sort({ updatedAt: -1 }).limit(5)
```

## Pass criteria

This sprint is complete when all of the following are true:

- `api`, `worker`, `mongo`, and `redis` run together from Docker Compose
- GitHub configuration is stored successfully
- a real repository is created by API
- webhook is registered on the real repository
- a real push creates a webhook delivery record in MongoDB
- the webhook event is enqueued
- the worker processes the job successfully
- commit and diff evidence are persisted

## Known limitation for this sprint

Command-hook static analysis is intentionally disabled by default in container runtime for external repositories. The current worker analyzes webhook diff evidence stored in MongoDB, but it does not clone the pushed repository into the container workspace. That is acceptable for this sprint because the primary goal is proving webhook -> queue -> worker -> evidence runtime correctness.
