# uTube for iOS — installation

**iOS 16+ · Source installation currently available.** There is no published
uTube App Store listing, TestFlight invitation, or signed IPA download yet.
To install the current source on an iPhone or iPad, use a **Mac with Xcode 26+**
and an Apple signing team that supports the app’s capabilities. A Windows or
Linux laptop alone cannot build this Xcode project.

### Install from source on your iPhone

1. On your Mac, install Xcode, Node.js 22.13+, and CocoaPods. Open Xcode once to
   finish installing its tools, then sign in under **Xcode → Settings → Accounts**
   (called **Apple Accounts** in some versions).
2. Clone the repository and install dependencies:

   ```sh
   git clone https://github.com/omer73364/uTube.git
   cd uTube
   npm ci
   (cd apps/mobile/ios && pod install)
   open apps/mobile/ios/uTube.xcworkspace
   ```

3. In Xcode, choose the **uTube** scheme. Configure **Signing & Capabilities** for
   both **uTube** and **uTubeShare** using the same team. Use bundle identifiers
   owned by your team and enable the same registered **App Group** for both
   targets. If you change identifiers, follow the
   [signing checklist](apps/mobile/ios/README.md#signing-and-distribution), including
   the background-task identifiers.
4. Connect and unlock your iPhone/iPad, trust the Mac, and enable
   [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)
   under **Settings → Privacy & Security** when prompted. Select the physical
   device as Xcode’s run destination.
5. Choose **Product → Scheme → Edit Scheme → Run → Info → Build Configuration →
   Release**, then **Product → Run**. Xcode signs, installs, and launches the app.

The **Release** build includes its JavaScript and media encoder. Once installed,
you can disconnect the Mac and use the app on your phone; Metro and the source
code do not need to keep running on your laptop. A **Debug** build is for
development and normally needs `npm run mobile:start` running on a reachable Mac.

Apple’s free Personal Team signing has capability and expiration limits. This
project includes an App Group and Share Extension, so do not assume that a free
Apple Account can sign the full project unchanged. Use a team that can provision
both targets and the App Group; see
[Apple’s account and membership guidance](https://developer.apple.com/help/account/basics/about-your-developer-account/).
The simulator build needs no signing, but its `.app` cannot be installed on a
physical iPhone. The Android APK cannot be installed on iOS either.

### Other installation options

These are distribution options for a maintainer to set up; **none is currently
published for uTube**.

| Method | What the user needs | What the maintainer must provide |
| --- | --- | --- |
| **TestFlight** | The free TestFlight app and an invitation/public beta link; no Mac or source build required. | Apple Developer Program membership and an uploaded beta build. Each build is usable for up to 90 days. |
| **Signed IPA for registered devices (Ad Hoc)** | An iPhone/iPad whose device ID is included in the provisioning profile; follow the maintainer’s installation instructions. | A signed IPA, registered test devices, and matching provisioning profiles for the app and extension. A downloaded IPA is not automatically installable on every iPhone. |
| **App Store** | Install directly from the App Store; no Mac or source build required. | A submitted and approved app release. Availability depends on Apple’s review. |

See [Apple’s TestFlight guide](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
and [registered-device distribution guide](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices).
A maintainer can also build/sign on a hosted Mac or macOS CI; users would still
receive the app through one of the signed distribution methods above.

Files are available in the Files app. Share → uTube saves an incoming link;
open uTube to choose quality and start the download. Background execution follows
iOS limits. See the [full iOS guide](apps/mobile/ios/README.md) for file locations,
background behavior, verification results, and remaining device checks.


[← Back to the project README](README.md) · [iOS development guide](apps/mobile/ios/README.md)
