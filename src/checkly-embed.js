const playwright = require("playwright");
const expect = require("expect");

const browser = await playwright.chromium.launch();
const page = await browser.newPage();

await page.goto("https://{{websiteUrl}}");
const name = await page.innerText(".checkName");
expect(name).toEqual("Pulumi");

await browser.close();
