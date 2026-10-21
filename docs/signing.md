# Trusted desktop releases

Current 2.2.0 downloads are unsigned. No signing account has been configured, and these changes do not turn existing downloads into signed apps.

Future public Windows and macOS releases must pass `node scripts/verify-desktop-signatures.mjs` before artifacts can be collected and published. Manual preview builds remain available without publication. The gate checks the actual payloads, including ZIP archives, rather than trusting a configuration flag. It will block public releases until a signing provider is integrated.

## Windows

Choose a trusted Authenticode signing provider and complete its publisher verification. The [SignPath Foundation](https://signpath.org/) offers a free program for eligible open-source projects; acceptance is required. [Microsoft's signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options) explain paid providers and Microsoft Store distribution.

Once approved, integrate the provider into CI so it signs the app before creating ZIP archives, and signs the Windows installer afterward. Store credentials in GitHub Actions secrets, never in source or chat. The release check validates Authenticode trust on the app, installer, and app extracted from each ZIP.

A valid signature establishes publisher identity and integrity. It does not guarantee an app is free of vulnerabilities or that Windows will never display a prompt. [SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation) can still affect new signed downloads. Self-signed certificates do not provide normal public trust.

## macOS

Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) and obtain a Developer ID Application identity for direct distribution. Configure [Forge signing and notarization](https://www.electronforge.io/guides/code-signing/code-signing-macos), with the certificate imported into the runner's temporary keychain and notarization credentials supplied through Actions secrets.

Sign and notarize the app, staple the ticket, and only then create the DMG and ZIP. The release check runs `codesign --verify`, a Gatekeeper assessment through `spctl`, and `xcrun stapler validate` on the packaged app and the app inside each archive. Developer enrollment, provider integration, and native verification still need to be completed; Linux-only tests cannot certify a macOS signature.

## Linux

Authenticode and Apple notarization do not apply to Linux packages. Release checksums remain available. Signing an apt repository or providing a separate signature with a published verification key is a separate distribution step; neither is configured here.

## Website and release notes

Keep the current signing notice while downloads remain unsigned. Update it only after signed/notarized replacements have passed the native checks and been published. Never describe signing as a guarantee of zero security prompts or general software safety.
