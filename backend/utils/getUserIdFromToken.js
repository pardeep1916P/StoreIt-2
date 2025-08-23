import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const REGION = process.env.AWS_REGION;
const USER_POOL_ID = process.env.USER_POOL_ID;
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;

const client = jwksClient({
  jwksUri: `${ISSUER}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      callback(err);
    } else {
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    }
  });
}

export function getUserIdFromToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, { issuer: ISSUER }, (err, decoded) => {
      if (err) {
        reject('Token verification failed: ' + err.message);
      } else {
        resolve(decoded.sub); // Cognito user ID
      }
    });
  });
}
