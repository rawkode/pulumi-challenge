import * as pulumi from "@pulumi/pulumi";

// Swag Provider
//
// Challenge Notes:
// We should guide them through writing this Dynamic Provider themselves,
// as it show-cases how one can integrate with APIs with very little effort.
// import { Swag } from "./swag-provider";

// const swag = new Swag("rawkode", {
//   name: "David Flanagan",
//   email: "david@rawkode.dev",
//   address: "123 Main St",
//   size: "XL",
// });

// Deploy Website to S3 with CloudFront
// Also shows the challenger how to build a ComponentResource
import { CdnWebsite } from "./cdn-website";

const website = new CdnWebsite("rawkode", {});

export const websiteUrl = website.url;

// Monitoring with Checkly
// Demonstrates Standard Package usage
import * as checkly from "@checkly/pulumi";
import * as fs from "fs";

new checkly.Check("index-page", {
  activated: true,
  frequency: 10,
  type: "BROWSER",
  locations: ["eu-west-2"],
  script: websiteUrl.apply((url) =>
    fs
      .readFileSync("checkly-embed.js")
      .toString("utf8")
      .replace("{{websiteUrl}}", url)
  ),
});
