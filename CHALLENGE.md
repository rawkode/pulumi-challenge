# Challenge

## Step 1. Your First Pulumi Program

You will learn how to create a new Pulumi program using our Pulumi templates, specifically for AWS with TypeScript.

```shell
pulumi new aws-typescript
```

This template requires a little bit of configuration, as AWS needs to know your default region:

```shell
pulumi config set aws:region eu-west-2
```

## Step 2. Creating Your First Resource

Now that we have a base AWS project configured, we need to create our first resource. In this instance, we'll create a new S3 bucket which will allow us to store our static website. We'll also ensure that this bucket is private, as we want to expose it only via our CDN - which we'll configure next.

```typescript
const bucket = new aws.s3.BucketV2(
  "bucketV2",
  {
    tags: {
      Name: "My bucket",
    },
  }
);

const bucketAcl = new aws.s3.BucketAclV2("bAcl", {
  bucket: bucket.id,
  acl: "private",
});
```

## Step 3. Working with Local Files

Pulumi let's you use your favourite programming language to define your infrastructure. Today, we're using TypeScript; which means we have access to the Node API. This includes discovering directories and files.

Using these APIs, we can sync our local files, with the Pulumi resource model, to the S3 bucket.

```typescript
import * as fs from "fs";
const staticWebsiteDirectory = "website";

fs.readdirSync(staticWebsiteDirectory).forEach((file) => {
  const filePath = `${staticWebsiteDirectory}/${file}`;
  const fileContent = fs.readFileSync(filePath).toString();

  new aws.s3.BucketObject(file, {
    bucket: bucket.id,
    source: new pulumi.asset.FileAsset(filePath),
    contentType: mime.getType(filePath) || undefined,
  });
});
```


## Step 4. Creating a CDN

Next, we want to front our S3 bucket with Cloudfront. This is a pretty big object, but most of it can be copy and pasted without further thought.

```typescript
const s3OriginId = "myS3Origin";

cloudfrontDistribution = new aws.cloudfront.Distribution(
  "s3Distribution",
  {
    origins: [
      {
        domainName: bucket.bucketRegionalDomainName,
        originId: s3OriginId,
      },
    ],
    enabled: true,
    isIpv6Enabled: true,
    comment: "Some comment",
    defaultRootObject: "index.html",
    defaultCacheBehavior: {
      allowedMethods: [
        "DELETE",
        "GET",
        "HEAD",
        "OPTIONS",
        "PATCH",
        "POST",
        "PUT",
      ],
      cachedMethods: ["GET", "HEAD"],
      targetOriginId: s3OriginId,
      forwardedValues: {
        queryString: false,
        cookies: {
          forward: "none",
        },
      },
      viewerProtocolPolicy: "allow-all",
      minTtl: 0,
      defaultTtl: 3600,
      maxTtl: 86400,
    },
    priceClass: "PriceClass_200",
    restrictions: {
      geoRestriction: {
        restrictionType: "whitelist",
        locations: ["US", "CA", "GB", "DE"],
      },
    },
    viewerCertificate: {
      cloudfrontDefaultCertificate: true,
    },
  }
);
```

## Step 5. Introducing ComponentResources

Now ... we can continue to add resource after resource; but Pulumi is more than that. We can build our own reusable components. Let's refactor what we have above into a CdnWebsite component.

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export class CdnWebsite extends pulumi.ComponentResource {
  private bucket: aws.s3.BucketV2;
  private bucketAcl: aws.s3.BucketAclV2;
  private cloudfrontDistribution: aws.cloudfront.Distribution;
  private s3OriginId: string = "myS3Origin";

  constructor(name: string, args: any, opts?: pulumi.ComponentResourceOptions) {
    super("pulumi:challenge:CdnWebsite", name, args, opts);

    this.bucket = new aws.s3.BucketV2(
      "bucketV2",
      {
        tags: {
          Name: "My bucket",
        },
      },
      {
        parent: this,
      }
    );

    this.bucketAcl = new aws.s3.BucketAclV2("bAcl", {
      bucket: this.bucket.id,
      acl: "private",
    });

    this.cloudfrontDistribution = new aws.cloudfront.Distribution(
      "s3Distribution",
      {
        origins: [
          {
            domainName: this.bucket.bucketRegionalDomainName,
            originId: this.s3OriginId,
          },
        ],
        enabled: true,
        isIpv6Enabled: true,
        comment: "Some comment",
        defaultRootObject: "index.html",
        defaultCacheBehavior: {
          allowedMethods: [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT",
          ],
          cachedMethods: ["GET", "HEAD"],
          targetOriginId: this.s3OriginId,
          forwardedValues: {
            queryString: false,
            cookies: {
              forward: "none",
            },
          },
          viewerProtocolPolicy: "allow-all",
          minTtl: 0,
          defaultTtl: 3600,
          maxTtl: 86400,
        },
        priceClass: "PriceClass_200",
        restrictions: {
          geoRestriction: {
            restrictionType: "whitelist",
            locations: ["US", "CA", "GB", "DE"],
          },
        },
        viewerCertificate: {
          cloudfrontDefaultCertificate: true,
        },
      }
    );

    // We also need to register all the expected outputs for this
    // component resource that will get returned by default.
    this.registerOutputs({
      bucketName: this.bucket.id,
    });
  }
}
```

Now we can consume this! Awesome

```typescript
// Deploy Website to S3 with CloudFront
// Also shows the challenger how to build a ComponentResource
import { CdnWebsite } from "./cdn-website";

const website = new CdnWebsite("not-rawkode", {});
```

## Step 6. Adding Another Provider

Now that we have our website being delivered as fast as can we via our CdnWebsite component and S3 with Cloudfront, how do we know that what we've deployed actually works? We could leverage a fantastic service, such as Checkly, to ensure our website passes some sanity checks.

First, we need to add a new provider:

```shell
npm install @checkly/pulumi

# API KEY: https://app.checklyhq.com/settings/account/api-keys
pulumi config set checkly:apiKey --secret

# AccountID: https://app.checklyhq.com/settings/account/general
pulumi config set checklly:accountId
```

Next, we can use this in our code.

```typescript
import * as checkly from "@checkly/pulumi";
import * as fs from "fs";

new checkly.Check("index-page", {
  activated: true,
  frequency: 10,
  type: "BROWSER",
  script: fs.readFileSync("checkly-embed.js").toString("utf8"),
});
```

You'll notice we use `fs.readFileSync` from `fs` again. That's because we're keeping our Checkly code, which is also Node based, inside its own file where it can get good auto-completion and syntax highlightying, rather than storing as a string object within our existing code. Neat, huh?

##### TODO: We actually need to template in with website URL with `apply`. Needs done

```javascript
const playwright = require("playwright");
const expect = require("expect");

const browser = await playwright.chromium.launch();
const page = await browser.newPage();

await page.goto("${website.url}");
const name = await page.$eval(".tag", (el) => el.textContent.trim());
expect(name).toEqual("PULUMI");

await browser.close();
```

## Step 7. Introducing the Dynamic Swag Provider

Everyone likes SWAG and we want to give you some for completing this challenge. To do so, we're going to handle this via Pulumi with a Dynamic Provider.

```typescript
import * as pulumi from "@pulumi/pulumi";

const submittionUrl: string =
  "https://hooks.airtable.com/workflows/v1/genericWebhook/apptZjyaJx5J2BVri/wflmg3riOP6fPjCII/wtr3RoDcz3mTizw3C";

interface SwagInputs {
  name: string;
  email: string;
  address: string;
  size: "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";
}

interface SwagCreateResponse {
  success: boolean;
}

interface SwagOutputs extends SwagInputs {
  id: string;
}

class SwagProvider implements pulumi.dynamic.ResourceProvider {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  async create(props: SwagInputs): Promise<pulumi.dynamic.CreateResult> {
    const got = (await import("got")).default;

    let data = await got
      .post(submittionUrl, {
        headers: {
          "Content-Type": "application/json",
        },
        json: {
          ...props,
        },
      })
      .json<SwagCreateResponse>();

    return { id: props.email, outs: props };
  }
}

export class Swag extends pulumi.dynamic.Resource {
  constructor(
    name: string,
    props: SwagInputs,
    opts?: pulumi.CustomResourceOptions
  ) {
    super(new SwagProvider(name), name, props, opts);
  }
}
```

Now, add this final block and run `pulumi up`. Enjoy your SWAG.

```typescript
import { Swag } from "./swag-provider";

const swag = new Swag("not-rawkode", {
  name: "YOUR NAME",
  email: "YOUR EMAIL",
  address: "YOUR ADDRESS",
  size: SIZE,
});
```
