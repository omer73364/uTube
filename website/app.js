const release = "https://github.com/omer73364/uTube/releases/download/v2.2.0/";
const arabic = {
  skip: "انتقل إلى المحتوى",
  home: "uTube — الصفحة الرئيسية",
  navigation: "التنقل الرئيسي",
  navDesktop: "التطبيق",
  navCli: "سطر الأوامر",
  release: "الإصدار 2.2.0 · نسخة تجريبية",
  heroFirst: "uTube",
  heroSecond: "لتنزيل الفيديو والصوت",
  heroDescription:
    "نزّل فيديوهات يوتيوب وقوائم التشغيل، أو احفظ الصوت بصيغة MP3. اختر دقة الفيديو ومجلد الحفظ.",
  heroDownload: "تنزيل التطبيق",
  heroCli: "نسخة سطر الأوامر",
  heroNote: "مجاني ومفتوح المصدر · Windows وmacOS وLinux",
  previewLabel: "تطبيق سطح المكتب",
  featuresTitle: "ميزات التطبيق",
  featureOneTitle: "تنزيل الفيديوهات وقوائم التشغيل",
  featureOneText:
    "نزّل فيديو واحدًا، أو قائمة تشغيل كاملة، أو مقاطع تختارها منها. تُحفظ ملفات كل قائمة في مجلد خاص بها.",
  featureTwoTitle: "فيديو MP4 أو صوت MP3",
  featureTwoText:
    "اختر دقة الفيديو، أو نزّل الصوت بصيغة MP3 بمعدل 192 كيلوبت في الثانية.",
  featureThreeTitle: "سجل تنزيلات محفوظ",
  featureThreeText:
    "ابحث في تنزيلاتك السابقة، وافتح الملفات المحفوظة، وأعد محاولة التنزيلات المتوقفة. يبقى السجل محفوظًا على جهازك.",
  downloadTitle: "تنزيل uTube",
  downloadIntro: "اختر نظام التشغيل وصيغة ملف التثبيت المناسبة لجهازك.",
  versionLine: "الإصدار 2.2.0 · نسخة تجريبية لسطح المكتب",
  releaseNotes: "ملاحظات الإصدار",
  osLabel: "نظام التشغيل",
  unsigned:
    "ملفات التطبيق غير موقّعة رقميًا، ونسخة macOS لم تحصل على توثيق Apple. قد يعرض النظام تنبيهًا عند فتحها.",
  installGuide: "دليل التثبيت والتحقق من سلامة الملفات ↗",
  cliTitle: "نسخة سطر الأوامر",
  cliIntro:
    "ثبّت النسخة باستخدام npm، ثم شغّل utube لفتح القائمة التفاعلية. يمكنك أيضًا إدخال رابط الفيديو والدقة المطلوبة مباشرة في الأمر.",
  cliRequirements:
    "تحتاج إلى Node.js 20 أو أحدث، وإلى FFmpeg لتحويل الصوت إلى MP3 ودمج الصوت مع الفيديو عالي الدقة.",
  cliDocs: "دليل الأوامر",
  copyLabel: "نسخ أمر التثبيت",
  copy: "نسخ",
  terminalNote: "قوائم سطر الأوامر متاحة حاليًا بالإنجليزية.",
  faqTitle: "المساعدة ومتطلبات التشغيل",
  faqOneTitle: "ماذا لو تعذّر تنزيل الفيديو بالدقة المطلوبة؟",
  faqOneText:
    "يحاول uTube التنزيل بالدقة التي اخترتها أولًا. إذا تعذّر ذلك، ينتقل إلى أفضل دقة متاحة أقل من المطلوبة، ويعرض دقة الملف المحفوظ.",
  faqTwoTitle: "هل أحتاج إلى تثبيت برامج إضافية؟",
  faqTwoText:
    "لا يحتاج تطبيق سطح المكتب إلى Node.js أو npm. تثبّت حزمة Debian برنامج FFmpeg تلقائيًا عبر apt. في Windows وmacOS ونسخ Linux المحمولة، تحتاج إلى تثبيت FFmpeg بنفسك لتحويل الصوت إلى MP3 ودمج الصوت مع الفيديو عالي الدقة.",
  faqThreeTitle: "هل تبقى الملفات والسجل بعد إغلاق التطبيق؟",
  faqThreeText:
    "تبقى الملفات في المجلد الذي اخترته، ويحتفظ تطبيق سطح المكتب بسجل التنزيلات على جهازك. يمكنك إعادة محاولة التنزيلات المتوقفة يدويًا؛ وتبدأ كل محاولة من البداية.",
  faqFourTitle: "كيف أحدّث التطبيق؟",
  faqFourText:
    "نزّل الإصدار الجديد من GitHub Releases وثبّته. لتحديث نسخة سطر الأوامر، نفّذ أمر التثبيت مجددًا. لا يدعم تطبيق سطح المكتب التحديث التلقائي حاليًا.",
  footerText: "مجاني ومفتوح المصدر · بترخيص MIT",
  reportIssue: "الإبلاغ عن مشكلة",
  windowsDescription: "Windows · معالجات x64",
  linuxDescription: "Linux · معالجات x64",
  macosDescription: "macOS · اختر نوع المعالج",
  setup: "ملف التثبيت",
  portable: "ملف ZIP مضغوط",
  deb: "حزمة Debian / Ubuntu",
  appimage: "ملف AppImage",
  apple: "معالجات Apple Silicon",
  intel: "معالجات Intel",
  windowsDependency:
    "تحتاج إلى تثبيت FFmpeg وإضافته إلى PATH لتحويل الصوت إلى MP3 ودمج الصوت مع الفيديو عالي الدقة.",
  linuxDependency:
    "تثبّت حزمة DEB برنامج FFmpeg تلقائيًا عبر apt. عند استخدام AppImage أو ZIP، تحتاج إلى تثبيته بنفسك.",
  macosDependency:
    "اختر arm64 لأجهزة Apple Silicon، أو x64 لأجهزة Intel. تحتاج إلى تثبيت FFmpeg لتحويل الصوت إلى MP3 ودمج الصوت مع الفيديو عالي الدقة.",
  copied: "تم النسخ",
  copyFailed: "تعذّر النسخ. حدّد الأمر وانسخه يدويًا.",
  copySuccess: "تم نسخ أمر التثبيت.",
  themeDark: "التبديل إلى الوضع الداكن",
  themeLight: "التبديل إلى الوضع الفاتح",
  downloadFor: "تنزيل لنظام",
  screenshot: "واجهة تطبيق uTube بالعربية في الوضع الداكن",
};
const english = {
  windowsDescription: "Windows · x64 computers",
  linuxDescription: "Linux · x64 computers",
  macosDescription: "macOS · processor type",
  setup: "Windows installer",
  portable: "ZIP archive",
  deb: "Debian / Ubuntu package",
  appimage: "AppImage",
  apple: "Apple Silicon",
  intel: "Intel",
  windowsDependency:
    "Install FFmpeg separately and add it to PATH for MP3 conversion and HD video merging.",
  linuxDependency:
    "The DEB installs FFmpeg automatically through apt. AppImage and ZIP downloads require a separate FFmpeg installation.",
  macosDependency:
    "Choose arm64 for Apple Silicon or x64 for Intel. Install FFmpeg separately for MP3 conversion and HD video merging.",
  copied: "Copied!",
  copyFailed: "Could not copy. Select the command and copy it manually.",
  copySuccess: "Installation command copied.",
  themeDark: "Switch to dark mode",
  themeLight: "Switch to light mode",
  downloadFor: "Download for",
  screenshot:
    "uTube Desktop showing the video link form, quality choices, and saved download queue",
};
// Preserve the HTML's readable English copy as the default catalog.
for (const node of document.querySelectorAll("[data-i18n]"))
  english[node.dataset.i18n] = node.innerHTML;
for (const node of document.querySelectorAll("[data-i18n-aria]"))
  english[node.dataset.i18nAria] = node.getAttribute("aria-label");
const catalog = { en: english, ar: arabic };
const readPreference = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const savePreference = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Browsing without storage remains supported. */
  }
};
let language = readPreference("utube-site-language") === "ar" ? "ar" : "en";
const systemDark = matchMedia("(prefers-color-scheme: dark)");
let selectedTheme = readPreference("utube-site-theme");
if (!["light", "dark"].includes(selectedTheme)) selectedTheme = null;
let theme = selectedTheme || (systemDark.matches ? "dark" : "light");
const agent = `${navigator.userAgentData?.platform || navigator.platform || ""} ${navigator.userAgent}`;
let platform = /Windows/i.test(agent)
  ? "windows"
  : /Mac/i.test(agent)
    ? "macos"
    : /Linux/i.test(agent) && !/Android/i.test(agent)
      ? "linux"
      : "unknown";
const knownPlatform = platform !== "unknown";
if (!knownPlatform) platform = "linux";
const t = (key) => catalog[language][key] || english[key] || key;
const filename = (system, architecture, extension) =>
  `uTube-Desktop-2.2.0-${system}-${architecture}${extension}`;
const formats = {
  linux: [
    ["deb", "x64", ".deb", "DEB"],
    ["appimage", "x64", ".AppImage", "AppImage"],
    ["portable", "x64", ".zip", "ZIP"],
  ],
  windows: [
    ["setup", "x64", "-Setup.exe", "EXE"],
    ["portable", "x64", ".zip", "ZIP"],
  ],
  macos: [
    ["apple", "arm64", ".dmg", "DMG · arm64"],
    ["intel", "x64", ".dmg", "DMG · x64"],
    ["apple", "arm64", ".zip", "ZIP · arm64"],
    ["intel", "x64", ".zip", "ZIP · x64"],
  ],
};
function renderDownloads() {
  const links = document.querySelector("#download-links");
  links.replaceChildren();
  for (const [label, architecture, extension, type] of formats[platform]) {
    const link = document.createElement("a");
    link.className = "download-link";
    link.href = release + filename(platform, architecture, extension);
    const title = document.createElement("strong");
    title.textContent = t(label);
    const format = document.createElement("small");
    format.textContent = type;
    format.dir = "ltr";
    const arrow = document.createElement("span");
    arrow.textContent = "↓";
    arrow.setAttribute("aria-hidden", "true");
    link.append(title, format, arrow);
    links.append(link);
  }
  document.querySelector("#platform-description").textContent = t(
    `${platform}Description`,
  );
  document.querySelector("#dependency-note").textContent = t(
    `${platform}Dependency`,
  );
  document
    .querySelector("#platform-panel")
    .setAttribute("aria-labelledby", `tab-${platform}`);
  for (const tab of document.querySelectorAll("[data-platform]")) {
    const selected = tab.dataset.platform === platform;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
}
function renderTheme() {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector("#theme")
    .setAttribute(
      "aria-label",
      t(theme === "dark" ? "themeLight" : "themeDark"),
    );
  document.querySelector('meta[name="theme-color"]').content =
    theme === "dark" ? "#10151d" : "#f5f6f8";
}
function renderLanguage() {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  for (const node of document.querySelectorAll("[data-i18n]"))
    node.innerHTML = t(node.dataset.i18n);
  for (const node of document.querySelectorAll("[data-i18n-aria]"))
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
  const button = document.querySelector("#language");
  button.textContent = language === "en" ? "العربية" : "English";
  button.lang = language === "en" ? "ar" : "en";
  button.setAttribute(
    "aria-label",
    language === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية",
  );
  const image = document.querySelector("#desktop-image");
  image.src =
    language === "en"
      ? "./assets/desktop-light.png"
      : "./assets/desktop-ar-dark.png";
  image.alt = t("screenshot");
  document.title =
    language === "en"
      ? "uTube — Video & audio downloader"
      : "uTube — تنزيل الفيديو والصوت";
  document.querySelector('meta[name="description"]').content =
    language === "en"
      ? "Download YouTube videos, playlists, and MP3 audio with uTube for Windows, macOS, and Linux."
      : "نزّل فيديوهات يوتيوب وقوائم التشغيل وملفات MP3 باستخدام تطبيق uTube لأنظمة Windows وmacOS وLinux.";
  if (knownPlatform)
    document.querySelector("#hero-download [data-i18n]").textContent =
      `${t("downloadFor")} ${platform === "windows" ? "Windows" : platform === "macos" ? "macOS" : "Linux"}`;
  document.querySelector("#copy-status").textContent = "";
  renderTheme();
  renderDownloads();
}
document.querySelector("#language").addEventListener("click", () => {
  language = language === "en" ? "ar" : "en";
  savePreference("utube-site-language", language);
  renderLanguage();
});
document.querySelector("#theme").addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  selectedTheme = theme;
  savePreference("utube-site-theme", theme);
  renderTheme();
});
systemDark.addEventListener("change", (event) => {
  if (!selectedTheme) {
    theme = event.matches ? "dark" : "light";
    renderTheme();
  }
});
const tabs = [...document.querySelectorAll("[data-platform]")];
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    platform = tab.dataset.platform;
    renderDownloads();
  });
  tab.addEventListener("keydown", (event) => {
    const direction = document.documentElement.dir === "rtl" ? -1 : 1;
    const index = tabs.indexOf(tab);
    let next;
    if (event.key === "ArrowRight")
      next = (index + direction + tabs.length) % tabs.length;
    if (event.key === "ArrowLeft")
      next = (index - direction + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      tabs[next].click();
      tabs[next].focus();
    }
  });
}
let copyTimer;
document.querySelector("#copy-command").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(
      document.querySelector("#install-command").textContent,
    );
    document.querySelector("#copy-command span").textContent = t("copied");
    document.querySelector("#copy-status").textContent = t("copySuccess");
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      document.querySelector("#copy-command span").textContent = t("copy");
    }, 2000);
  } catch {
    document.querySelector("#copy-status").textContent = t("copyFailed");
  }
});
renderLanguage();
