s3-url-service
===
Redirect bearer token requests with presigned S3 urls.

## Overview
Would you like to serve private content from an AWS S3 Bucket
but aren't satisfied with any of the often complex and confusing
security/access/user/bucket policies? This service does *not* reverse
proxy data through your server. It dynamically generates a presigned
link and forwards the requester directly to S3 allowing the best of
both worlds:

1. Full control over authorization (e.g. custom claims in JWT Bearer tokens etc.)
2. No wasting bandwidth by streaming content through your server

## Build
```bash
docker build -t ubergarm/s3-url-service .
```

## Runtime Configuration
Environment Variable | Description | Default
--- | --- | ---
`JWT_SECRET` | *The plain text HMAC-SHA256 symmetric secret key* | `secret`
`JWT_CREDENTIALS_REQUIRED` | *'true' or 'false' to enforce valid JWT credentials in request* | `false`
`EXPIRES` | *Link expiration and redirect cache duration (in seconds)* | `2592000` (30 days in seconds)
`AWS_DEFAULT_REGION` | *AWS region* | `us-east-1`
`AWS_ACCESS_KEY_ID` | *AWS ID credentials* | n/a
`AWS_SECRET_ACCESS_KEY` | *AWS SECRET credentials* | n/a

## Run
Export your AWS credentials as environment variables then:
```bash
docker run --rm \
            -it \
            -p 8080:8080 \
            -e JWT_SECRET=secret \
            -e JWT_CREDENTIALS_REQUIRED=false \
            -e EXPIRES=86400 \
            -e AWS_DEFAULT_REGION \
            -e AWS_ACCESS_KEY_ID \
            -e AWS_SECRET_ACCESS_KEY \
            ubergarm/s3-url-service
```
*Optionally* you can add `-v $PWD:/app` to test without rebuilding etc...

## Test
Download content:
```bash
#apt-get install -y httpie || brew install httpie
http --follow --print HBhb localhost:8080/s3_bucket_name/s3_key_value Authorization:"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ"
```

Upload content:
```bash
#apt-get install -y curl || brew install curl
curl -v -L -T test.txt localhost:8080/s3_bucket_name/s3_key_value
```

## AWS S3 Bucket Policy
There are many ways to get a set of credentials with permissions to
access a given AWS S3 bucket. This is just one such possible example.

You can assign any existing AWS IAM user/role permissions to a 3rd party
bucket. Change the principal to match your credentials and the resource
to match the target bucket. The `ListBucket` action is optional. (Make
sure your user/role has access to S3 from its attached IAM policy as well.)
```
{
	"Version": "2012-10-17",
	"Id": "RedirectServiceBucketPolicy",
	"Statement": [
		{
			"Sid": "GetPutListObjects",
			"Effect": "Allow",
			"Principal": {
				"AWS": "arn:aws:iam::012345678901:user/redirect-service"
			},
			"Action": [
				"s3:GetObject",
				"s3:PutObject",
				"s3:ListBucket"
			],
			"Resource": [
				"arn:aws:s3:::target_bucket_name",
				"arn:aws:s3:::target_bucket_name/*"
			]
		}
	]
}
```
*NOTE* this policy will allow uploading, but if the IAM is from a 3rd
party account the permissions will be set at the object level, have a
different owner, and in general not work like you might expect.

## TODO
- [x] Implement `/:bucket/:key` endpoint regular expression
- [x] Implement `aws-sdk` presigned links
- [x] Plumb in scaffolding for JWT Bearer tokens
- [x] Test download
- [x] Test upload
- [x] Give example S3 Bucket Policy
- [x] Pass in caching parameters as environment variables
- [x] Cleanup how container starts
- [ ] Look more closely at `http` vs `https` support
- [ ] Find way to cleanup duplicated code
- [ ] Support multiple credentials/buckets secured with JWT claims (you can open a PR for this one! ;) )

## References
* [restify](http://restify.com/)
* [restify-jwt](https://github.com/amrav/restify-jwt)
* [jwt.io](https://jwt.io/)
* [aws-sdk](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-intro.html)
* [AWS Authentication](http://docs.aws.amazon.com/AmazonS3/latest/dev/RESTAuthentication.html)
* [AWS CLI presign](http://docs.aws.amazon.com/cli/latest/reference/s3/presign.html)
