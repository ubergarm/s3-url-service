require('dotenv').config({ path: 'env/.env' })
var AWS = require('aws-sdk')
var restify = require('restify')
var cookieParser = require('restify-cookies')
var jwt = require('restify-jwt')

// configure restify server instance
var server = restify.createServer({name: 's3-url-service'})
// configure JWT middleware
server.use(restify.queryParser())
server.use(cookieParser.parse)

server.use(jwt({
  // default secret is 'secret' --> YOU SHOULD SET A BETTER SECRET!
  secret: process.env.JWT_SECRET || 'secret',
  // default to provide a valid response even if no JWT credentails in request
  credentialsRequired: (process.env.JWT_CREDENTIALS_REQUIRED &&
                        process.env.JWT_CREDENTIALS_REQUIRED.toLowerCase() === true) || false,
  getToken: function fromHeaderOrQuerystringOrCookie (req) {
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
      return req.headers.authorization.split(' ')[1]
    } else if (req.query && req.query.token) {
      return req.query.token
    } else if (req.cookies && req.cookies['token']) {
      return req.cookies['token']
    }
    return null
  }
}))
// configure AWS credentials
AWS.config.update({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

// pull in a global config variable for link and cache expiration (in seconds)
// Presigning does not support expiry time greater than a week with SigV4 signing.
// Set signatureVersion below to 'v3' to use expiry times longer than 1 week
var EXPIRES = parseInt(process.env.EXPIRES) || (60 * 60 * 24 * 7) // 60480 seconds == 7 days == 1 week

function requestHandler (method) {
  return function (req, res, next) {
    // handle Bearer token claims here
    if (req.user) {
      console.log('Bearer token claims:\n', req.user)
    }

    // check for valid bucket and key parameters
    if (!req.params[0] || !req.params[1]) {
      return next(new Error('ERROR: Requires both valid bucket and key parameters'))
    }
    var bucket = decodeURIComponent(req.params[0])
    var key = decodeURIComponent(req.params[1])

    // generate presigned link
    var s3 = new AWS.S3({
      // SSE-KMS requires v4, but also restrict EXPIRES to one week
      signatureVersion: 'v4'
    })

    var params = {
      Bucket: bucket,
      Key: key,
      Expires: EXPIRES
    }

    if(method == "putObject" &&
       process.env.AWS_SSE_KMS_KEY_ID) {
      params.ServerSideEncryption = 'aws:kms';
      params.SSEKMSKeyId = process.env.AWS_SSE_KMS_KEY_ID;
    }

    s3.getSignedUrl(method, params, function (err, url) {
      if (err) {
        return next(err)
      }
      res.cache({maxAge: EXPIRES})
      res.redirect(307, url, next)
    })
  }
}

// S3 getObject redirect endpoint GET /:bucket/:key
server.get(/^\/([a-zA-Z0-9_\.-]+)\/(.*)/, requestHandler('getObject'))  // eslint-disable-line

// S3 putObject redirect endpoint PUT /:bucket/:key
server.put(/^\/([a-zA-Z0-9_\.-]+)\/(.*)/, requestHandler('putObject'))  // eslint-disable-line

// fire up the server
server.listen(8080, function () {
  console.log('%s listening at %s', server.name, server.url)
})
