# In-app updates and download-service availability

Desktop and Android share a signed, data-only feed at
`https://omer73364.github.io/uTube/updates/manifest.json`. The feed describes
installers and provider availability. CLI updates continue through npm.

**Delivery starts disabled:** `packages/core/update-config.json` intentionally
has no production trust roots. Configure the public key, GitHub secret, and feed
below before shipping the first updater-enabled release. Development and
unconfigured builds remain usable. Nothing in this change publishes a release,
changes the installed production app, or creates a production signing identity.
Existing users need one manual installation to acquire this updater.

## User experience

- Settings has Check for updates, release notes, download progress, cancellation,
  retry, and installation. A small banner announces updates and provider notices.
  English and Arabic are supported.
- Packaged desktop checks at launch and every six hours. Android checks while the
  app is active, at most every six hours; snapshots do not make network requests.
- Downloading an update does not interrupt media transfers. Install after current
  download stops starting queued work and waits for the current transfer. Stop
  download and install interrupts the current transfer instead. Cancellation
  releases the queue hold.
- Before installation, unfinished entries are persisted as interrupted. The
  installer can be cancelled without deleting the existing app, history, or
  saved media. Retry starts interrupted transfers from the beginning.
- Windows opens the verified EXE, macOS opens its verified DMG, and Linux DEB
  installations open the package installer. The desktop then closes; follow the
  system installer and reopen uTube. This is **installer-assisted updating**;
  it does not silently replace a running app or bypass system confirmation.
- AppImages use Show update file. Close uTube and replace the old portable file
  manually; displaying the file does not interrupt the download queue.
- Android verifies the APK package name, newer version code, version name and
  installed signing certificate before offering it to Android. Android may first
  request permission to install from uTube. Return and tap Open installer again
  after granting permission. Cancelling installation leaves queued entries
  available to retry. Signing-key rotation is not supported by the current APK
  precheck: retain the established app-signing key.
- This first version does not automatically roll back an unsuccessful OS
  installation. The existing app is retained until the platform installer replaces
  it. Staged updates are reverified before opening and must be redownloaded after
  restarting uTube. Installers still require platform/device validation before a
  public release, especially Windows/macOS and production APK upgrade prompts.

## Provider shutdown behavior

Edit `updates/services.json` and publish the manifest. An empty list means there
are no operator-issued notices. Example:

```json
[
  {
    "provider": "instagram",
    "state": "unavailable",
    "platforms": ["android", "darwin", "win32", "linux"],
    "maxVersion": "2.5.0",
    "fixedVersion": "2.6.0",
    "message": {
      "en": "Instagram downloads are temporarily unavailable. Version 2.6.0 restores support.",
      "ar": "تنزيلات إنستغرام غير متاحة مؤقتًا. يعيد الإصدار 2.6.0 دعم الخدمة."
    }
  }
]
```

Providers are `youtube`, `x`, `instagram`, and `facebook`. States are `available`,
`degraded` (warning only), `unavailable`, and `retired`. Only the last two block
new previews, new downloads and retries. Previously queued jobs remain queued,
with a service-hold label, and the scheduler skips them so other providers run.
Running jobs may finish. Completed files and history remain accessible.

Rules can target platforms and minimum/maximum app versions. A fixedVersion
stops applying the restriction once that version is installed. The first matching
rule per provider wins. Keep rules non-overlapping where possible. Queued jobs
continue when a fresh status clears the hold, or the cached notice expires.
After an app restart, existing interrupted-work behavior still requires Retry.

A failed or private video, or a local download failure, never changes the global
provider status. Existing bounded transfer retries and rate-limit messages remain
in place; this feature does not infer a global outage from individual failures.

A valid cached notice survives a failed status check until expiry. Missing,
expired, invalidly signed, or unreachable metadata cannot newly disable services.
Settings shows that status is unverified. Offline/update errors do not block
otherwise healthy downloads. Manifest expiry is an intentional fail-open policy,
including for retired notices: online publication must be renewed.

## Configure signing once

1. Generate a dedicated ECDSA P-256 metadata-signing identity outside tracked files:

   ```sh
   mkdir -p .private/updates
   node scripts/sign-update-manifest.mjs \
     --generate-key .private/updates/production-1.pem --key-id production-1
   ```

   The private file has mode 0600 and is never printed. Back it up securely.
   `.private/` is ignored by Git. This identity is separate from Windows/macOS
   code-signing certificates and the permanent Android signing key.

2. Merge the contents of `.private/updates/production-1.pem.public.json` into the
   `keys` object in `packages/core/update-config.json`. Commit only the public key.
   Both desktop and Android embed these trust roots; Android copies the config
   into generated assets during preBuild.

3. Put the PEM private key into the repository Actions secret
   `UTUBE_UPDATE_PRIVATE_KEY`. Set repository variable `UTUBE_UPDATE_KEY_ID` to
   `production-1` (the default). Configure Pages to deploy through GitHub Actions.
   The publish workflow needs permission to push its signed feed to main; adapt
   that persistence step to your protected-branch policy if direct pushes are
   prohibited. Do not weaken branch protection to run this workflow.

4. Set repository variable `UTUBE_UPDATES_ENABLED=true` to opt into daily feed
   renewal. The scheduled workflow is skipped unless enabled. Default validity
   is seven days, allowing brief publishing outages; checks still run every six
   hours. Monitor publishing failures so an outage notice does not expire.

5. Run **Publish app updates and service status** manually once. With an empty
   release tag it publishes only status and preserves prior verified release
   metadata. Check the served feed before shipping a build with this public key.

To rotate the metadata key, first ship an app trusting both old and new public
keys, then switch the publishing key. Never download new trust roots from an
unverified feed. Removing the old root requires a later app release.

## Publish releases and emergency notices

1. Build, test and publish the platform installers through the existing release
   process. This feature does not modify its signing gates.
2. Run **Publish app updates and service status**, supplying a stable tag such as
   `v2.6.0` and the Android version code if APKs are included. It downloads actual
   published installers, computes their sizes and SHA-256 digests, signs the feed,
   persists it in Git, and deploys it with the website.
3. Supported filenames match the existing collectors:
   `uTube-Desktop-VERSION-PLATFORM-ARCH[-Setup].EXT` and
   `uTube-android-VERSION[-arm64-v8a|-x86_64].apk`. ZIP/prototype/APK preview files
   are not advertised as installers. At most one artifact per platform/arch/kind
   is allowed. A release-tag publication replaces the advertised target set;
   publish all intended platform artifacts on that release before running it.
4. For an emergency service change, commit `updates/services.json`, then dispatch
   with an empty tag. No new app binary is necessary. Ordinary site deployments
   preserve the checked-in signed feed.

Local preparation is also available:

```sh
node scripts/create-update-manifest.mjs \
  --artifacts release-artifacts --version 2.6.0 --version-code 6 \
  --previous website/updates/manifest.json --output /tmp/utube-update-draft.json
node scripts/sign-update-manifest.mjs \
  --input /tmp/utube-update-draft.json --output website/updates/manifest.json \
  --key-file .private/updates/production-1.pem --key-id production-1
```

Use a clean artifact directory for the intended release. Review the draft before
signing. Its notes are bilingual generic text by default and can be edited before
signing for richer release notes. Do not commit an unsigned draft as the feed.

## Protocol and checks

An envelope has `keyId`, base64 `payload`, and base64 DER ECDSA `signature`.
The signature covers the exact UTF-8 JSON payload bytes, avoiding cross-platform
JSON canonicalization differences. Payload schema 1 has a monotonically
increasing revision, issuedAt/expiresAt milliseconds, services, and releases.
The app rejects invalid signatures, unsupported schemas, oversized bodies, future
issuance, duplicate release targets, and previously seen older revisions. An
expired cached envelope retains its revision high-water mark, but no restrictions.

Only HTTPS assets in `omer73364/uTube` GitHub Releases are accepted. Redirects are
bounded and pinned to GitHub's release CDN. Every artifact has a signed expected
size and SHA-256 digest; download and disk-space limits are enforced. Partial
files are discarded after failure/cancellation. APK verification also checks the
installed app identity. Neither manifest can contain executable repair code.

```sh
npm test
npm run desktop:check
npm run mobile:check
npm run mobile:test
# With the renderer server running as described in apps/desktop/README.md:
npm run desktop:test:updates
```

`UpdatePolicyTest` provides on-device Android signature/expiry/URL/version checks.
Run it through Android instrumentation on an emulator. Installer-assisted upgrade
acceptance and failure still need end-to-end testing with real signed higher
versions on each supported OS before enabling public delivery.
