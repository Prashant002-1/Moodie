# App Store release

The repository contains a native app and a shared Xcode scheme. Building a simulator binary is separate from distributing an App Store app. No App Store Connect record, signing identity, TestFlight upload, public policy page, production API deployment, or submission has been created by this task.

## Required before an archive

1. A real persistent HTTPS deployment of the current API, including safety routes and tables. The app is not configured against the old portfolio demo deployment. Test account creation, restart persistence, recovery, photos, recommendations, blocking, and deletion on that deployment.
2. Your Apple Developer team, a registered bundle identifier, and provisioning. Configure them in `Config/Local.xcconfig`. Xcode manages signing once the account is selected.
3. Public HTTPS privacy and support URLs. Supply `MOODIE_PRIVACY_URL` and `MOODIE_SUPPORT_URL`. In-app policy text describes the implemented behavior but does not replace a public policy or the operator's review of retention, hosting, and applicable obligations.
4. A staffed moderation process and a public contact route. Reports are stored privately in `moderation_reports`; blocks and removals affect authenticated discovery and interaction. Queue handling must be tested operationally before inviting public users.

The Release build preflight blocks empty or placeholder settings. Do not bypass it to make an upload appear ready.

## Moderation operations

Reports can target public responses, comments, and people. Submissions validate visibility, disallow reporting private content, deduplicate repeat reports, and limit one account to 30 reports per day. Reciprocal block checks apply to feeds, film responses, profiles, people lists, comments, activity, and recommendation source rows. Following relationships are removed when blocking; unblocking does not silently restore them.

The initial operator tool uses the existing database's exclusive lock. Stop the API, back up its persistent directory, inspect the queue, resolve reports, and restart. This is suitable for an initial controlled rollout, not a zero-downtime moderation console:

```sh
npx tsx server/src/scripts/moderateCommunity.ts list
npx tsx server/src/scripts/moderateCommunity.ts resolve REPORT_ID remove 'Reason recorded by the operator'
npx tsx server/src/scripts/moderateCommunity.ts resolve REPORT_ID dismiss 'Reason recorded by the operator'
```

Removal filters the reported item from public discovery. Restricting a person filters their public presence and stops non-account mutations while preserving their ability to manage or delete their account. A moderation removal is not physical deletion. Define a retention policy for reports/actions and backups, assign an operator, and establish timely handling before release. Image/content classification is not implemented; the current filtering method is human moderation plus server-enforced removals and blocks.

## App Store Connect preparation

- Name: Moodie (availability unverified). Suggested subtitle: Films through how they feel.
- Primary category: Entertainment; secondary category can be Social Networking after reviewing the final launch scope.
- Complete Apple's age-rating questionnaire accurately for user-generated text/photos and the film catalog. Do not infer an age rating from the code.
- Supply support contact, privacy URL, current screenshots from the actual release build, and an original app icon. The current icon reuses the repository's existing Moodie mark.
- Complete App Privacy disclosures against the actual deployment: account email/name/user ID, user-written content and selected feelings, photos, and social activity used for app functionality. The bundled privacy manifest covers declared first-party collection and no tracking. Reconcile host logging and retention before submission.
- Provide a working review account on the production service and steps to find recommendations, add a response, report/block, and delete an account. Never place production reviewer credentials in this repository.
- The app uses its own email/password system. No external social-login provider has been introduced.
- Verify TMDB usage and artwork rights for the intended release. The official TMDB mark and attribution are in Credits. Confirm the final usage against the applicable TMDB terms.

## Device release gate

Run the native journey tests, then test on a physical iPhone and supported iPad: password AutoFill, sign-up/recovery, private/public response visibility, interrupted saves, draft restore, optional photo handling, rewatch/edit/delete, blocking/reporting, deletion, network loss, and session expiry. Test VoiceOver reading order, all Dynamic Type sizes, landscape, Reduce Motion/Transparency, light/dark mode, keyboard dismissal, and small-screen scrolling. Native layout support is not a substitute for this acceptance pass.

Archive from the Release scheme configuration, validate in Xcode Organizer, then upload to TestFlight after the user authorizes distribution. TestFlight and App Review outcomes are separate from the local build.

## Apple sources checked during implementation

- [SDK minimum requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a): Xcode 26 or later and the matching iOS 26 or later SDK required since April 28, 2026. This implementation was built with Xcode 27.
- [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars): use native destination navigation.
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): user-generated content, privacy, completeness, and review access.
- [Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/): account deletion is available inside Account.
