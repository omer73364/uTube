// Keep action tests independent of whether the interface uses English or Arabic.
module.exports = async function jobAction(page, label) {
  const arabic = (await page.locator("html").getAttribute("lang")) === "ar";
  const title = label
    .replace(
      /^(Open |Retry |Cancel |Show |فتح |إظهار |إلغاء |إعادة محاولة )/,
      "",
    )
    .replace(/(?: في المجلد| in folder)$/, "");
  await page
    .getByRole("button", {
      name: arabic ? `خيارات ${title}` : `Options for ${title}`,
      exact: true,
    })
    .click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
};
