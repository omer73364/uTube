// Keep action tests independent of whether the interface uses English or Arabic.
module.exports = async function jobAction(page, label) {
  const arabic = (await page.locator("html").getAttribute("lang")) === "ar";
  const title = label
    .replace(
      /^(Open |Retry |Cancel |Show |فتح |إظهار |إلغاء |إعادة محاولة )/,
      "",
    )
    .replace(/(?: في المجلد| in folder)$/, "");
  const trigger = page.getByRole("button", {
    name: arabic ? `خيارات ${title}` : `Options for ${title}`,
    exact: true,
  });
  // The app closes action menus on scroll. Finish bringing an offscreen card
  // into view before opening its menu, just as a user scrolling to it would.
  await trigger.scrollIntoViewIfNeeded();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await trigger.click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
};
