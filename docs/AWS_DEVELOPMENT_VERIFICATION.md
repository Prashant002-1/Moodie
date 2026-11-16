# AWS development verification

Verified October 1, 2026. **Infrastructure and the database schema are deployed. The application image has not been uploaded or started in AWS.** Automatic approval review blocked the upload and the transfer of the existing TMDB key pending direct confirmation. This is an incomplete deployment record, not a production-readiness claim.

## Scope and decisions

One developer, with an expected recurring cost around $45–50/month. Use account `YOUR_AWS_ACCOUNT_ID`, region `us-east-1`, and the existing short-lived `atlas-sso-admin` SSO profile. Public hostname, public HTTPS, physical-device access, signing and TestFlight were explicitly deferred. The planned local URL is `http://127.0.0.1:3301`, carried over an encrypted Systems Manager tunnel; it is not serving the app yet. The Vercel deployment was not changed.

The first AWS application dataset contains no local or fictional social records. Local Moodie accounts and databases were not imported or reset. Catalog access awaits approval to place the existing Moodie TMDB key in the new runtime secret.

## Current AWS evidence

| Component | Verified state |
| --- | --- |
| CloudFormation | `moodie-dev`, `CREATE_COMPLETE` |
| API host | `YOUR_INSTANCE_ID`, ARM64 `t4g.small`, 2 vCPUs / 2 GiB, SSM online, Docker installed |
| API exposure | No inbound security-group rules; planned container binds only host loopback |
| Database | `moodie-dev-db`, PostgreSQL 18.6, `db.t4g.small`, available, private, encrypted, Single-AZ |
| Database recovery configuration | Seven-day automatic retention, deletion protection, snapshot-on-stack-removal policy; latest restorable time observed `2026-10-01T05:27:24Z` |
| Database runtime permissions | TLS active, zero users, no schema CREATE or migration-table UPDATE permission |
| Migration | `202610010001-initial.sql` applied, checksum recorded |
| Runtime identity | Reads only the Moodie runtime secret; cannot read master or migration credentials |
| ECR | `moodie-dev/api` exists; zero uploaded images on final read |
| Monitoring | CloudWatch resources and alarms exist; app metrics and application logs await runtime deployment |
| Cost controls | Existing account-wide $70 gross-cost budget retained; it is an alert, not a cap |

The API host and RDS are already billable while image approval is pending. No unrelated AWS account resources were changed.

## RDS restore drill

At `2026-10-01T05:51:30Z`, restored the encrypted snapshot `moodie-dev-restore-check-20261001` into a separate private RDS instance of the same name. The restore explicitly used Moodie's private subnet group, database security group and TLS parameter group. Waited for the instance to become available and the parameter group to be in sync.

All 25 public tables matched the source by row count and digest; column metadata also matched. The dataset held 19 genre records, two migration records and zero accounts. The runtime connection verified the RDS certificate, TLS was required by the applied parameter group, and the runtime role could neither create schema objects nor update migration records. This establishes snapshot recovery of the complete initial dataset. It is not an account-data recovery or application cutover claim. See [machine-readable result](aws-restore-verification.json).

Cleanup verified at `2026-10-01T05:54:55Z`: the temporary instance, manual snapshot and temporary automated backups are absent. Both database tunnels are closed. Primary `moodie-dev-db` remains available with seven-day backups and deletion protection.

## Local implementation and evidence

- Explicit PostgreSQL adapter with a five-connection pool, TLS verification, query timeouts, idle-connection recovery, transactions and numeric ID compatibility. Embedded PGlite remains the default for existing local development.
- Versioned, checksum-checked migrations use a transaction and advisory lock. The API verifies the schema on startup and does not run privileged migrations.
- ARM64 runtime image builds on pinned Node 24.21.0, contains production backend dependencies and web assets, and excludes local env files, databases and signing files. It runs as an unprivileged user with a read-only filesystem.
- Production build and lint passed. Frontend: 68 tests / 17 suites. Embedded API: 83 passed and three PostgreSQL-only tests skipped. Actual PostgreSQL 18.6 API: all 86 tests / 17 suites passed.
- Embedded production smoke passed: durable accounts, sessions, diary and saved films; duplicate-process rejection; backup restoration; persistent deletion and session revocation. This is embedded recovery proof, not an RDS restore drill.
- Real web services → Swift native transport → recreated native client → web services passed against the packaged local PostgreSQL runtime. Checks cover private diary visibility, retry identity, suggestion replies/retraction, messages, comments, paging and blocking.
- A local-only rehearsal of the capacity probe completed 360 measured requests with zero errors. At concurrency 1 / 5 / 10, p95 was 3 / 6 / 86 ms. These are Docker-on-Mac measurements using a small fixture, not AWS latency or capacity. The probe's environment label was subsequently made generic to avoid mislabeling local runs.
- Runtime npm dependency audit reported zero vulnerabilities. AWS ECR scan is pending because no image is uploaded.
- Xcode Debug build settings resolve `MOODIE_API_URL` to `http://127.0.0.1:3301/api`. This verifies simulator configuration, not physical-device or App Store readiness.
- Disposable local PostgreSQL/API containers and their network were removed. The initial database tunnel was closed after local checks; separate read-only tunnels were used for the RDS restore drill. No cloud application-test database was created.
- Operational Python scripts compile; `git diff --check` passed. No commit, Git push or public deployment was made.

## Remaining deployment gates

1. Approve image upload to the new Moodie ECR repository and, separately or together, the existing TMDB key transfer to the runtime secret.
2. Deploy by immutable digest, record source hash/release metadata, and verify the main API through the SSM tunnel. Confirm the application database still contains zero test accounts.
3. Run the web/native continuity and capacity probes against the disposable cloud database, then verify process restart persistence and recovery.
4. Check ECR scan, CloudWatch logs/metrics, container resource headroom, release rollback, and local browser access. Remove the disposable verification database, container and tunnel.

See [operations and repeatable commands](../infra/aws/README.md). The environment has one API host and a Single-AZ database; interruptions during maintenance or replacement remain possible. The goal stays incomplete until the cloud gates pass.
