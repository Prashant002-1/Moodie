# Moodie private AWS development backend

This environment is for one developer. The web app and API run together on one ARM64 EC2 server. PostgreSQL runs separately in private RDS subnets. Access is through an encrypted AWS Systems Manager tunnel. There is no public application listener, SSH port, public database, load balancer, or NAT gateway. Domain and public HTTPS setup are deferred.

Current deployment and verification status: [AWS development verification](../../docs/AWS_DEVELOPMENT_VERIFICATION.md). Infrastructure exists; application upload is awaiting approval.

## Account and data boundary

- Account: set `MOODIE_AWS_ACCOUNT_ID` in your shell to the 12-digit account that owns the stack (kept out of this public repository). Region `us-east-1`, stack `moodie-dev`.
- Use the existing `atlas-sso-admin` SSO profile. Its historical name does not restrict it to Atlas. Every deployment command checks the account before mutation.
- All application resources, secrets, roles, and images are Moodie-specific. No retired Atlas artifact or database is reused.
- The first application database starts empty. No local accounts, diary records, photos, or sample social content are imported. TMDB populates film metadata when requested.
- Local development still defaults to PGlite. PostgreSQL requires the explicit `DATABASE_DRIVER=postgres` setting; old unused database settings in local env files cannot silently switch storage.

## Use the AWS backend from this Mac

```sh
aws sso login --profile atlas-sso-admin
python3 infra/aws/moodie.py tunnel
```

Keep that process running and open `http://127.0.0.1:3301`. Web and API share the same origin. Use the iOS Debug override described in `ios/README.md` for simulator testing. The existing Vercel site is unchanged. A physical phone needs a reachable HTTPS address later.

The tunnel requires the official AWS Session Manager plugin. This checkout has a local copy in the ignored `.aws/tools/` directory. After a fresh clone, install the plugin using [AWS's macOS instructions](https://docs.aws.amazon.com/systems-manager/latest/userguide/install-plugin-macos-overview.html).

## Deploy and recover

```sh
python3 infra/aws/moodie.py status
python3 infra/aws/moodie.py deploy
python3 infra/aws/moodie.py rollback
```

Deploy builds the current source with Node 24, uploads a new immutable ECR tag, and runs the image by digest. The source hash and digest are recorded in ignored `.aws/deployment.json`. It does not commit or push Git changes. Run appropriate tests before deploying. The image admits only application source/build inputs, excludes local environments and databases, runs as an unprivileged user with a read-only root filesystem, and cannot obtain the host's AWS credentials through container IMDS access.

Systemd restarts a stopped/crashed application. A minute timer restarts a container after repeated health-check failures. Failed deployments restore the previous image if one exists. Rollback changes the application image only; it never reverses database writes or restores an old snapshot automatically. Migrations must preserve compatibility with the previous release.

## PostgreSQL

RDS uses encrypted storage and requires TLS. The app verifies the RDS certificate using the packaged AWS CA bundle. The runtime role has data permissions but cannot create tables or change migration records. The separate migration role owns the schema. The EC2 instance can read only the runtime secret; it cannot read migration or master credentials.

To apply migrations, start a separate terminal:

```sh
python3 infra/aws/moodie.py database-tunnel
```

Then run `python3 infra/aws/bootstrap_database.py --image <verified-local-image>`. This idempotently establishes roles, runs the packaged versioned migrations, and verifies runtime privileges/TLS. Add `--catalog` only when configuring or refreshing the existing Moodie TMDB credential from the local environment. Passwords never enter process arguments, repository files, or logs.

Migrations are immutable SQL files under `database/migrations/`, ordered by their numeric prefix. The runner uses a transaction and advisory lock, records checksums, and rejects changed historical migrations. The production API checks that its migrations are present instead of applying DDL on startup. Add a new migration for later changes. Keep `database/schema.sql` in sync for embedded local development and test both database drivers.

## Backups, monitoring and limits

RDS retains automated backups for seven days, has deletion protection, and takes a final snapshot on CloudFormation deletion after protection is deliberately disabled. An RDS snapshot restore passed on October 1 for the complete initial dataset: 25 tables, 19 genre records, two migration records and zero accounts. See the verification report for evidence and cleanup status. Application restart persistence and rollback still require cloud verification. Production data is not disposable. Database restoration is a separate operator decision because restoring an older point can lose newer writes.

Application logs are retained for 14 days and PostgreSQL logs for seven days. CloudWatch alarms cover API health, memory, disk, CPU, and EC2 system failure. EC2 system-failure recovery is enabled. Operational alarms currently appear in CloudWatch; no email subscription is created. The existing account-wide $70 gross-cost budget and its email thresholds remain unchanged. Budgets alert rather than cap spending.

The planned recurring total is roughly $45–50/month before taxes, excess traffic, burst CPU credits, and unusual log/storage growth. Base On-Demand compute is $12.26/month for `t4g.small` and $23.36/month for `db.t4g.small`, at 730 hours. Storage, the app host's outbound public IPv4, three secrets, logs, alarms, and image storage account for the rest. Actual billing must be checked after usage begins.

This is one API instance and a Single-AZ database. Automatic process restart and backups improve recovery, but maintenance and host/database replacement can still interrupt development. High availability and public distribution are not claimed. Resize from measured memory, latency, CPU credits, and database metrics.

## Disposable cloud verification

With the database tunnel running, `python3 infra/aws/verify_cloud.py prepare` creates only `moodie_test_cloud` and starts the deployed image on instance loopback port 3002. The main application database remains empty of test accounts. Forward local port 3302 to instance port 3002 with `AWS-StartPortForwardingSession`, then run:

```sh
MOODIE_PLATFORM_API=http://127.0.0.1:3302/api node scripts/verify-platform-continuity.mjs
MOODIE_PLATFORM_API=http://127.0.0.1:3302/api node scripts/measure-private-api.mjs
python3 infra/aws/verify_cloud.py fingerprint
```

These scripts refuse APIs without the explicit verification scope. The Swift check uses the real native transport. The capacity probe makes 120 requests at each of 1, 5 and 10 concurrent requests, plus 12 warmup requests, against a small fictional fixture. It does not establish large-community or live TMDB capacity. Clean up with `python3 infra/aws/verify_cloud.py cleanup` and close the verification tunnel. Cloud application verification is pending as recorded in the report; the initial-dataset RDS snapshot restore passed.

## Repeat the database restore comparison

Create an encrypted snapshot of `moodie-dev-db`, then restore it under a new `moodie-dev-restore-check-YYYYMMDD` identifier. Explicitly supply the Moodie private subnet group, database security group and database parameter group from `python3 infra/aws/moodie.py outputs`, and keep the copy non-public and Single-AZ. Restoring creates a separate database instance and incurs temporary charges. [AWS's restore instructions](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_RestoreFromSnapshot.html) explain the parameter and security-group defaults.

Wait for RDS status `available` and parameter apply status `in-sync`. Forward source port 5432 to local 15432 and the restore's port 5432 to local 15433. Then compare the `schema`, `tables`, and `permissions` sections of these outputs:

```sh
python3 infra/aws/restore_probe.py --instance moodie-dev-db --port 15432
python3 infra/aws/restore_probe.py --instance moodie-dev-restore-check-YYYYMMDD --port 15433
```

The probe reads through certificate-verified TLS and emits hashes and counts rather than records or credentials. Stop writes or compare against evidence captured at the chosen snapshot point; later source writes should differ from a restored earlier snapshot. The probe does not redirect the API to the restored database. Selecting a restore point and changing the application database endpoint are separate recovery operations. Delete only the tagged disposable restore instance and its test snapshot after verification, then close both tunnels. Preserve the primary database and its automated backups.
