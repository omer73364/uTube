const release = "https://github.com/omer73364/uTube/releases/download/v2.2.0/";
const arabic = {
  skip: "انتقل إلى المحتوى",
  navigation: "التنقل الرئيسي",
  navDesktop: "تطبيق سطح المكتب",
  navCli: "الطرفية",
  release: "الإصدار 2.2.0 متاح الآن",
  heroFirst: "مفضّلاتك،",
  heroSecond: "معك دون إنترنت.",
  heroDescription:
    "الدرس الذي تحتاجه غدًا، وقائمة الموسيقى لرحلتك القادمة. احتفظ بالفيديوهات والمقاطع التي تحب العودة إليها، في مجموعتك الخاصة.",
  heroDownload: "حمّل تطبيق uTube",
  heroCli: "تفضّل الطرفية؟",
  heroNote: "مجاني ومفتوح المصدر. لا حاجة إلى حساب.",
  previewLabel: "خطوات أقل. وقت أكثر للمشاهدة.",
  previewFooter: "تنزيلاتك. جهازك. على راحتك.",
  optionsLabel: "خيارات التنزيل",
  stripFirst: "احتفظ بما تحب.",
  video: "فيديو",
  audio: "صوت",
  playlists: "قوائم تشغيل كاملة",
  featuresEyebrow: "من رابط إلى مجموعتك الخاصة",
  featuresTitle: "تنظيم أبسط.<br>ومحتوى يبقى معك.",
  featuresIntro:
    "طريقة مباشرة لبناء مجموعتك، سواء بدأت بفيديو واحد أو بقائمة تشغيل كاملة.",
  featureOneTitle: "القائمة كاملة، أو المقاطع التي تختارها.",
  featureOneText:
    "استعرض القائمة، وحدّد الفيديوهات التي تريدها، واحتفظ بها معًا في مجلد خاص بها.",
  featureTwoTitle: "شاهد كما تحب. واستمع أينما ذهبت.",
  featureTwoText:
    "اختر فيديو MP4 بالدقة التي تفضّلها، أو احتفظ بالصوت فقط بصيغة MP3 بمعدل 192 كيلوبت/ثانية.",
  featureThreeTitle: "أغلق التطبيق. مجموعتك باقية.",
  featureThreeText:
    "يبقى سجلّك محفوظًا. ابحث عن فيديو أو قائمة، وافتح الملف، وأعد محاولة التنزيلات المتوقفة عندما يناسبك.",
  downloadEyebrow: "مساحة تناسبك",
  downloadTitle: "تنزيلك القادم<br>يبدأ من هنا.",
  downloadIntro:
    "فاتح أو داكن. بالعربية أو الإنجليزية. تطبيق بسيط يتذكّر اختياراتك.",
  versionLine: "الإصدار 2.2.0 · نسخة سطح المكتب التجريبية",
  releaseNotes: "اقرأ ملاحظات الإصدار",
  osLabel: "نظام التشغيل",
  unsigned:
    "هذه نسخة تجريبية غير موقّعة، ونسخة macOS غير موثّقة لدى Apple. قد يعرض النظام تنبيهًا أمنيًا.",
  installGuide: "دليل التثبيت والتحقّق من الملفات ↗",
  cliEyebrow: "لمن يفضّل الطرفية",
  cliTitle: "أمر واحد.<br>ومجموعتك التالية.",
  cliIntro:
    "اتبع القائمة التفاعلية أو ابدأ التنزيل مباشرة. المحرّك نفسه، مع مرونة سطر الأوامر.",
  cliRequirements:
    "يتطلّب Node.js 20 أو أحدث، وFFmpeg لتحويل MP3 ودمج الفيديو عالي الدقة.",
  cliDocs: "استكشف أوامر الطرفية",
  copyLabel: "انسخ أمر التثبيت",
  copy: "نسخ",
  terminalNote: "قوائم الطرفية متاحة حاليًا بالإنجليزية.",
  faqEyebrow: "تفاصيل تفيدك",
  faqTitle: "قبل أن تبدأ<br>التنزيل.",
  faqOneTitle: "ماذا يحدث إذا فشل تنزيل الدقة التي اخترتها؟",
  faqOneText:
    "يجرّب uTube ترميزات وعملاء بديلة بالدقة المطلوبة أولًا. إذا لم تنجح، يجرّب الدقات الأقل بالترتيب من الأعلى إلى الأدنى، ويعرض الدقة التي حُفظت فعليًا. تعتمد الدقات المتاحة على الفيديو.",
  faqTwoTitle: "هل أحتاج إلى تثبيت برامج أخرى؟",
  faqTwoText:
    "يتضمّن تطبيق سطح المكتب بيئة تشغيله، ولا يحتاج إلى Node.js أو npm. تثبّت حزمة Debian برنامج FFmpeg عبر apt. أما Windows وmacOS ونسخ Linux المحمولة فتحتاج إلى تثبيت FFmpeg بشكل منفصل لتحويل MP3 ودمج الفيديو عالي الدقة.",
  faqThreeTitle: "هل تبقى تنزيلاتي بعد إغلاق التطبيق؟",
  faqThreeText:
    "نعم. تبقى الملفات في المجلد الذي اخترته، ويُحفظ سجلّ سطح المكتب على جهازك. تنتظر التنزيلات المتوقفة إعادة المحاولة منك، وتبدأ المحاولة من البداية.",
  faqFourTitle: "كيف أحدّث uTube؟",
  faqFourText:
    "حمّل نسخة أحدث من تطبيق سطح المكتب من GitHub Releases عندما تريد التحديث. وللطرفية، نفّذ أمر التثبيت مجددًا. التحديثات التلقائية لسطح المكتب غير متاحة بعد.",
  footerText: "مساحة لما تحب العودة إليه.",
  reportIssue: "أبلغ عن مشكلة",
  windowsDescription: "Windows · أجهزة x64",
  linuxDescription: "Linux · أجهزة x64",
  macosDescription: "macOS · اختر معمارية جهازك",
  setup: "مثبّت Windows",
  portable: "نسخة محمولة",
  deb: "حزمة Debian / Ubuntu",
  appimage: "AppImage",
  apple: "Apple Silicon",
  intel: "Intel",
  windowsDependency:
    "ثبّت FFmpeg بشكل منفصل وأضفه إلى PATH لتحويل MP3 ودمج الفيديو عالي الدقة.",
  linuxDependency:
    "تثبّت حزمة DEB برنامج FFmpeg تلقائيًا عبر apt. تحتاج نسختا AppImage وZIP إلى تثبيته بشكل منفصل.",
  macosDependency:
    "اختر arm64 لمعالجات Apple Silicon، وx64 لأجهزة Intel. يتطلّب تحويل MP3 ودمج الفيديو عالي الدقة تثبيت FFmpeg بشكل منفصل.",
  copied: "نُسخ!",
  copyFailed: "تعذّر النسخ. حدّد الأمر وانسخه يدويًا.",
  copySuccess: "تم نسخ أمر التثبيت.",
  themeDark: "استخدم الوضع الداكن",
  themeLight: "استخدم الوضع الفاتح",
  downloadFor: "حمّل نسخة",
  screenshot:
    "تطبيق uTube بالعربية، مع الوضع الداكن واتجاه العرض من اليمين إلى اليسار",
};
const english = {
  windowsDescription: "Windows · x64 computers",
  linuxDescription: "Linux · x64 computers",
  macosDescription: "macOS · choose your chip",
  setup: "Windows installer",
  portable: "Portable archive",
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
      ? "uTube — Your favorites, ready offline."
      : "uTube — مفضّلاتك، معك دون إنترنت.";
  document.querySelector('meta[name="description"]').content =
    language === "en"
      ? "Build your offline collection with uTube. Download YouTube videos, playlists, and MP3s with a simple desktop app or a powerful CLI."
      : "ابنِ مجموعتك الخاصة مع uTube. نزّل فيديوهات يوتيوب وقوائم التشغيل وملفات MP3 عبر تطبيق سطح المكتب أو الطرفية.";
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
