import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as fs from "fs";
import * as mime from "mime";

// This is a simpler verison of:
// https://github.com/pulumi/pulumi-aws-static-website
export class CdnWebsite extends pulumi.ComponentResource {
  private bucket: aws.s3.BucketV2;
  private bucketAcl: aws.s3.BucketAclV2;
  private cloudfrontDistribution: aws.cloudfront.Distribution;
  private s3OriginId: string = "myS3Origin";
  private staticWebsiteDirectory: string = "../website";

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

    this.bucketAcl = new aws.s3.BucketAclV2(
      "bAcl",
      {
        bucket: this.bucket.id,
        acl: aws.s3.PublicReadAcl,
      },
      {
        parent: this,
      }
    );

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
      },
      {
        parent: this,
      }
    );

    fs.readdirSync(this.staticWebsiteDirectory).forEach((file) => {
      const filePath = `${this.staticWebsiteDirectory}/${file}`;
      const fileContent = fs.readFileSync(filePath).toString();

      new aws.s3.BucketObject(
        file,
        {
          bucket: this.bucket.id,
          source: new pulumi.asset.FileAsset(filePath),
          contentType: mime.getType(filePath) || undefined,
          acl: aws.s3.PublicReadAcl,
        },
        {
          parent: this.bucket,
        }
      );
    });

    // We also need to register all the expected outputs for this
    // component resource that will get returned by default.
    this.registerOutputs({
      bucketName: this.bucket.id,
      cdnUrl: this.cloudfrontDistribution.domainName,
    });
  }

  get url(): pulumi.Output<string> {
    return this.cloudfrontDistribution.domainName;
  }
}
