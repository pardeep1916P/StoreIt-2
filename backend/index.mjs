import crypto from 'crypto';
import { 
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ResendConfirmationCodeCommand,
  AdminGetUserCommand,
  ListUsersCommand,
  AdminSetUserPasswordCommand
} from '@aws-sdk/client-cognito-identity-provider';

import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, DeleteCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { getUserIdFromToken } from './utils/getUserIdFromToken.js';
import { GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

import { v4 as uuidv4 } from 'uuid';

  // AWS Configuration
const AWS_REGION = process.env.AWS_REGION;
const USER_POOL_ID = process.env.USER_POOL_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const TABLE_NAME = process.env.TABLE_NAME || 'storeit-files';
const BUCKET_NAME = process.env.BUCKET_NAME || 'storeit-files-bucket';



// Initialize AWS clients
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });
const s3Client = new S3Client({ region: AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });

// Debug AWS credentials
console.log('🔍 Debug: AWS Clients initialized with region:', AWS_REGION);
console.log('🔍 Debug: AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT_SET');
console.log('🔍 Debug: AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT_SET');
console.log('🔍 Debug: AWS_SESSION_TOKEN:', process.env.AWS_SESSION_TOKEN ? 'SET' : 'NOT_SET');
const docClient = DynamoDBDocumentClient.from(dynamoClient);

console.log('🔍 Debug: AWS Clients initialized with region:', AWS_REGION);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Origin,Accept',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
};


const createResponse = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body)
});

// Helper function to convert stream to buffer
const streamToBuffer = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};

function generateSecretHash(username) {
  return crypto
    .createHmac('SHA256', CLIENT_SECRET)
    .update(username + CLIENT_ID)
    .digest('base64');
}

// Helper function to determine token type
function getTokenType(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return 'invalid';
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log('🔍 Debug: Token payload:', payload);
    
    if (payload.token_use === 'access') {
      return 'access';
    } else if (payload.token_use === 'id') {
      return 'id';
    } else {
      return 'unknown';
    }
  } catch (error) {
    console.error('🔍 Debug: Error parsing token:', error);
    return 'invalid';
  }
}

// === Authentication Functions ===

const signUp = async (email, password, username) => {
  try {
    console.log('🔍 Debug: Starting signup for email:', email);
    
    const secretHash = generateSecretHash(email);
    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      SecretHash: secretHash,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: username }
      ]
    });

    console.log('🔍 Debug: SignUpCommand created, sending to Cognito...');
    const result = await cognitoClient.send(command);
    
    console.log('🔍 Debug: SignUp successful, result:', JSON.stringify(result, null, 2));
    
    return {
      message: 'Account created successfully. Please check your email for verification code.',
      email,
      userSub: result.UserSub
    };
  } catch (error) {
    console.error('🔍 Debug: SignUp error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    
    // Provide more specific error messages
    let errorMessage = error.message;
    
    if (error.name === 'UsernameExistsException') {
      errorMessage = 'User already exists';
    } else if (error.name === 'InvalidPasswordException') {
      errorMessage = 'Password too weak';
    } else if (error.name === 'InvalidParameterException') {
      errorMessage = 'Invalid email format';
    } else if (error.name === 'CodeDeliveryFailureException') {
      errorMessage = 'Email delivery failed - please check your email configuration';
    }
    
    throw new Error(errorMessage);
  }
};

const confirmSignUp = async (email, code, password = null) => {
  try {
    console.log('🔍 Debug: Starting confirmSignUp for email:', email, 'code:', code);
    
    const secretHash = generateSecretHash(email);
    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      SecretHash: secretHash
    });

    console.log('🔍 Debug: ConfirmSignUpCommand created, sending to Cognito...');
    await cognitoClient.send(command);
    
    console.log('🔍 Debug: ConfirmSignUp successful');
    
    // If password is provided, automatically sign in the user
    if (password) {
      try {
        console.log('🔍 Debug: Attempting auto-sign-in after verification');
        const signInResult = await signIn(email, password);
        return {
          message: 'Email verified successfully',
          ...signInResult
        };
      } catch (signInError) {
        console.log('🔍 Debug: Auto-sign-in failed, returning verification success only');
        console.error('🔍 Debug: Sign-in error:', signInError);
        return { 
          message: 'Email verified successfully'
        };
      }
    }
    
    // If no password provided, return success message only
    return { 
      message: 'Email verified successfully'
    };
  } catch (error) {
    console.error('🔍 Debug: ConfirmSignUp error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    
    // Provide more specific error messages
    let errorMessage = error.message;
    
    if (error.name === 'CodeMismatchException') {
      errorMessage = 'Invalid verification code';
    } else if (error.name === 'ExpiredCodeException') {
      errorMessage = 'Code expired';
    } else if (error.name === 'UserNotFoundException') {
      errorMessage = 'User not found';
    } else if (error.name === 'NotAuthorizedException') {
      errorMessage = 'User is already confirmed';
    }
    
    throw new Error(errorMessage);
  }
};

const signIn = async (email, password) => {
  try {
    const secretHash = generateSecretHash(email);
    const command = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: secretHash
      }
    });

    const result = await cognitoClient.send(command);
    
    // Get user data from Cognito to include in response
    let userData = null;
    try {
      const adminCommand = new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email
      });
      
      const adminResult = await cognitoClient.send(adminCommand);
      const userAttributes = {};
      adminResult.UserAttributes.forEach(attr => {
        userAttributes[attr.Name] = attr.Value;
      });
      
      userData = {
        userId: adminResult.Username,
        email: userAttributes.email,
        username: userAttributes.name,
        emailVerified: userAttributes.email_verified === 'true'
      };
    } catch (userDataError) {
      console.error('🔍 Debug: Error getting user data during signin:', userDataError);
      // Continue without user data if there's an error
    }
    
    return {
      message: 'Sign in successful',
      token: result.AuthenticationResult.AccessToken,
      idToken: result.AuthenticationResult.IdToken,
      refreshToken: result.AuthenticationResult.RefreshToken,
      user: userData
    };
  } catch (error) {
    console.error('SignIn error:', error);
    
    // Provide more specific error messages based on Cognito exceptions
    let errorMessage = 'Failed to sign in';
    
    if (error.name === 'NotAuthorizedException') {
      errorMessage = 'Invalid email or password';
    } else if (error.name === 'UserNotFoundException') {
      errorMessage = 'User not found';
    } else if (error.name === 'UserNotConfirmedException') {
      errorMessage = 'Please verify your email before signing in';
    } else if (error.name === 'TooManyRequestsException') {
      errorMessage = 'Too many failed attempts. Please wait before trying again';
    } else if (error.name === 'PasswordResetRequiredException') {
      errorMessage = 'Password reset required';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};

const forgotPassword = async (email) => {
  try {
    // Check if user exists first
    try {
      const listCommand = new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Filter: `email = "${email}"`
      });
      const result = await cognitoClient.send(listCommand);
      
      if (!result.Users || result.Users.length === 0) {
        throw new Error('UserNotFoundException');
      }
      
      console.log('🔍 Debug: User found for password reset:', email);
    } catch (error) {
      console.error('🔍 Debug: Error checking user existence:', error);
      if (error.name === 'UserNotFoundException' || error.message.includes('User not found')) {
        throw new Error('UserNotFoundException');
      }
      throw error;
    }

    // Use Cognito's built-in forgot password to send real email
    const secretHash = generateSecretHash(email);
    const command = new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
      SecretHash: secretHash
    });

    await cognitoClient.send(command);
    console.log('🔍 Debug: Real Cognito reset code sent to email:', email);
    
    return { message: 'Password reset code sent to your email' };
  } catch (error) {
    console.error('ForgotPassword error:', error);
    if (error.message === 'UserNotFoundException') {
      throw new Error('UserNotFoundException');
    }
    throw new Error(error.message);
  }
};

const confirmForgotPassword = async (email, code, newPassword) => {
  try {
    // Use Cognito's built-in confirm forgot password
    const secretHash = generateSecretHash(email);
    const command = new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
      SecretHash: secretHash
    });

    await cognitoClient.send(command);
    console.log('🔍 Debug: Password reset successful for email:', email);
    
    return { message: 'Password reset successfully' };
  } catch (error) {
    console.error('ConfirmForgotPassword error:', error);
    throw new Error(error.message);
  }
};

const resendOTP = async (email) => {
  try {
    // Check if user exists first
    try {
      const listCommand = new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Filter: `email = "${email}"`
      });
      const result = await cognitoClient.send(listCommand);
      
      if (!result.Users || result.Users.length === 0) {
        throw new Error('UserNotFoundException');
      }
      
      const user = result.Users[0];
      console.log('🔍 Debug: User found for resend OTP:', email);
      
      // Check if user is confirmed
      const isConfirmed = user.UserStatus === 'CONFIRMED';
      
      if (isConfirmed) {
        // User is confirmed, this is likely for password reset
        // Use Cognito's built-in forgot password to send real email
        const secretHash = generateSecretHash(email);
        const command = new ForgotPasswordCommand({
          ClientId: CLIENT_ID,
          Username: email,
          SecretHash: secretHash
        });

        await cognitoClient.send(command);
        console.log('🔍 Debug: Real Cognito reset code resent to email:', email);
        
        return { message: 'Password reset code sent to your email' };
      } else {
        // User is not confirmed, this is for signup verification
        const secretHash = generateSecretHash(email);
        const command = new ResendConfirmationCodeCommand({
          ClientId: CLIENT_ID,
          Username: email,
          SecretHash: secretHash
        });

        await cognitoClient.send(command);
        return { message: 'Verification code resent to your email' };
      }
    } catch (error) {
      console.error('🔍 Debug: Error checking user existence:', error);
      if (error.message === 'UserNotFoundException') {
        throw new Error('UserNotFoundException');
      }
      throw error;
    }
  } catch (error) {
    console.error('ResendOTP error:', error);
    if (error.message === 'UserNotFoundException') {
      throw new Error('UserNotFoundException');
    }
    throw new Error(error.message);
  }
};

const verifyResetOTP = async (email, code) => {
  try {
    // Validate code format (6 digits)
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new Error('Invalid reset code format');
    }

    // Check if user exists by searching with email
    let user;
    try {
      const listCommand = new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Filter: `email = "${email}"`
      });
      const result = await cognitoClient.send(listCommand);
      
      if (!result.Users || result.Users.length === 0) {
        throw new Error('User not found');
      }
      
      user = result.Users[0];
      console.log('🔍 Debug: User found for email:', email);
    } catch (error) {
      console.error('🔍 Debug: Error checking user existence:', error);
      if (error.message === 'User not found') {
        throw new Error('User not found');
      }
      throw new Error('Failed to verify user');
    }

    // Get the stored reset code from DynamoDB
    try {
      const getCommand = new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          userId: 'RESET_CODES',
          fileId: email
        }
      });
      
      const storedCodeResult = await docClient.send(getCommand);
      
      console.log('🔍 Debug: Stored code result:', JSON.stringify(storedCodeResult, null, 2));
      
      if (!storedCodeResult.Item || !storedCodeResult.Item.resetCode) {
        throw new Error('Reset code not found or expired');
      }
      
      const storedCode = storedCodeResult.Item.resetCode;
      const codeExpiry = storedCodeResult.Item.expiry;
      
      console.log('🔍 Debug: Provided code:', code);
      console.log('🔍 Debug: Stored code:', storedCode);
      console.log('🔍 Debug: Code expiry:', new Date(codeExpiry));
      console.log('🔍 Debug: Current time:', new Date());
      console.log('🔍 Debug: Codes match?', code === storedCode);
      
      // Check if code has expired (5 minutes)
      if (Date.now() > codeExpiry) {
        // Clean up expired code
        await docClient.send(new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            userId: 'RESET_CODES',
            fileId: email
          }
        }));
        throw new Error('Reset code expired');
      }
      
      // Compare the provided code with stored code
      if (code !== storedCode) {
        throw new Error('Invalid reset code');
      }
      
      console.log('🔍 Debug: Reset code verified successfully for:', email);
      return { message: 'Reset code verified successfully' };
      
    } catch (error) {
      console.error('🔍 Debug: Error verifying reset code:', error);
      if (error.message.includes('Reset code not found') || 
          error.message.includes('Reset code expired') ||
          error.message.includes('Invalid reset code')) {
        throw error;
      }
      throw new Error('Failed to verify reset code');
    }
  } catch (error) {
    console.error('VerifyResetOTP error:', error);
    throw error;
  }
};

// Get user data from Cognito
const getUserData = async (token) => {
  try {
    console.log('🔍 Debug: Getting user data with token length:', token?.length);
    
    // First try to decode the token to see what type it is
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log('🔍 Debug: Token payload:', payload);
    console.log('🔍 Debug: Token use:', payload.token_use);
    console.log('🔍 Debug: Available fields in payload:', Object.keys(payload));
    
    // Always try to extract from token payload first (most reliable)
    console.log('🔍 Debug: Extracting user data from token payload...');
    
    // Log all available fields for debugging
    console.log('🔍 Debug: All payload fields:', Object.keys(payload));
    console.log('🔍 Debug: Sample field values:', {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      username: payload.username,
      'cognito:username': payload['cognito:username'],
      'cognito:email': payload['cognito:email'],
      'cognito:name': payload['cognito:name'],
      user_id: payload.user_id,
      userId: payload.userId,
      userEmail: payload.userEmail,
      user_email: payload.user_email,
      fullName: payload.fullName,
      full_name: payload.full_name,
      userName: payload.userName
    });
    
    // For access tokens, we can still extract basic info
    const tokenUserData = {
      userId: payload.sub || payload.username || payload['cognito:username'] || payload.user_id || payload.userId,
      email: payload.email || payload['cognito:email'] || payload.userEmail || payload.user_email || 'user@example.com',
      username: payload.name || payload['cognito:name'] || payload.fullName || payload.full_name || payload.userName || payload.username || 'User',
      emailVerified: payload.email_verified === 'true' || payload.emailVerified === true || true
    };
    
    console.log('🔍 Debug: User data from token payload:', tokenUserData);
    
    // For access tokens, we'll use the username field as a fallback
    if (payload.token_use === 'access' && payload.username) {
      console.log('🔍 Debug: Access token detected, using username field');
      tokenUserData.username = payload.username;
    }
    
    // If we have complete data from token, return it
    if (tokenUserData.userId && tokenUserData.email && tokenUserData.username && 
        tokenUserData.email !== 'user@example.com' && tokenUserData.username !== 'User') {
      console.log('🔍 Debug: Complete user data found in token, returning...');
      return tokenUserData;
    }
    
    // For access tokens, try to get additional info from Cognito if we have permissions
    if (payload.token_use === 'access' && tokenUserData.userId) {
      console.log('🔍 Debug: Access token with userId, trying Cognito...');
      try {
        const adminCommand = new AdminGetUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: tokenUserData.userId
        });
        
        const adminResult = await cognitoClient.send(adminCommand);
        console.log('🔍 Debug: AdminGetUser result:', JSON.stringify(adminResult, null, 2));
        
        const adminUserAttributes = {};
        adminResult.UserAttributes.forEach(attr => {
          adminUserAttributes[attr.Name] = attr.Value;
        });
        
        const cognitoUserData = {
          userId: adminResult.Username,
          email: adminUserAttributes.email || 'user@example.com',
          username: adminUserAttributes.name || adminUserAttributes['custom:name'] || adminUserAttributes.preferred_username || 'User',
          emailVerified: adminUserAttributes.email_verified === 'true' || true
        };
        
        console.log('🔍 Debug: User data from Cognito:', cognitoUserData);
        return cognitoUserData;
      } catch (cognitoError) {
        console.error('🔍 Debug: Cognito AdminGetUser error:', cognitoError);
        console.log('🔍 Debug: Returning fallback user data from token');
        return tokenUserData;
      }
    }
    
    // If it's an ID token, extract user data directly from payload
    if (payload.token_use === 'id') {
      console.log('🔍 Debug: Processing ID token...');
      console.log('🔍 Debug: ID token payload fields:', Object.keys(payload));
      console.log('🔍 Debug: ID token payload values:', {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        email_verified: payload.email_verified,
        'cognito:username': payload['cognito:username']
      });
      
      const userData = {
        userId: payload.sub,
        email: payload.email,
        username: payload.name,
        emailVerified: payload.email_verified === 'true'
      };
      console.log('🔍 Debug: Extracted from ID token:', userData);
      
      // Always try to get complete data from Cognito for ID tokens
      if (userData.userId && userData.email) {
        console.log('🔍 Debug: Fetching complete user data from Cognito for ID token...');
        try {
          const adminCommand = new AdminGetUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: userData.userId
          });
          
          const adminResult = await cognitoClient.send(adminCommand);
          const userAttributes = {};
          adminResult.UserAttributes.forEach(attr => {
            userAttributes[attr.Name] = attr.Value;
          });
          
          console.log('🔍 Debug: Cognito user attributes:', userAttributes);
          
          // Update user data with complete information from Cognito
          userData.username = userAttributes.name || userData.username;
          userData.emailVerified = userAttributes.email_verified === 'true';
          
          console.log('🔍 Debug: Final user data from Cognito:', userData);
          return userData;
        } catch (cognitoError) {
          console.error('🔍 Debug: Error fetching user data from Cognito:', cognitoError);
          // Return what we have from the token
          return userData;
        }
      }
      
      return userData;
    }
    
    // If it's an access token, try GetUserCommand
    if (payload.token_use === 'access') {
      console.log('🔍 Debug: Processing Access token with GetUserCommand...');
      const command = new GetUserCommand({
        AccessToken: token
      });

      const result = await cognitoClient.send(command);
      console.log('🔍 Debug: Cognito GetUser result:', JSON.stringify(result, null, 2));
      
      // Extract user attributes
      const userAttributes = {};
      result.UserAttributes.forEach(attr => {
        userAttributes[attr.Name] = attr.Value;
      });

      console.log('🔍 Debug: Extracted user attributes:', userAttributes);

      const userData = {
        userId: result.Username,
        email: userAttributes.email,
        username: userAttributes.name,
        emailVerified: userAttributes.email_verified === 'true'
      };

      console.log('🔍 Debug: Returning user data:', userData);
      return userData;
    }
    
    // If token type is unknown, try AdminGetUser as fallback
    console.log('🔍 Debug: Unknown token type, trying AdminGetUser...');
    const adminCommand = new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: payload.sub || payload.username || payload['cognito:username']
    });
    
    const adminResult = await cognitoClient.send(adminCommand);
    console.log('🔍 Debug: AdminGetUser result:', JSON.stringify(adminResult, null, 2));
    
    const adminUserAttributes = {};
    adminResult.UserAttributes.forEach(attr => {
      adminUserAttributes[attr.Name] = attr.Value;
    });
    
    const userData = {
      userId: adminResult.Username,
      email: adminUserAttributes.email,
      username: adminUserAttributes.name,
      emailVerified: adminUserAttributes.email_verified === 'true'
    };
    
    console.log('🔍 Debug: Returning admin user data:', userData);
    return userData;
    
  } catch (error) {
    console.error('🔍 Debug: GetUserData error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    
    // Final fallback - try to extract whatever we can from the token
    try {
      console.log('🔍 Debug: Final fallback - extracting from token payload...');
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      console.log('🔍 Debug: All available payload fields:', Object.keys(payload));
      console.log('🔍 Debug: Sample payload values:', {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        username: payload.username,
        'cognito:username': payload['cognito:username'],
        'cognito:email': payload['cognito:email'],
        'cognito:name': payload['cognito:name']
      });
      
      // Try multiple possible field names for user data
      const userData = {
        userId: payload.sub || payload.username || payload['cognito:username'] || payload.user_id || payload.userId,
        email: payload.email || payload['cognito:email'] || payload.userEmail || payload.user_email,
        username: payload.name || payload['cognito:name'] || payload.fullName || payload.full_name || payload.userName,
        emailVerified: payload.email_verified === 'true' || payload.emailVerified === true || true
      };
      
      console.log('🔍 Debug: Final fallback user data:', userData);
      
      // If we have at least userId and email, try to get missing data from Cognito
      if (userData.userId && userData.email && !userData.username) {
        console.log('🔍 Debug: Missing username in fallback, fetching from Cognito...');
        try {
          const adminCommand = new AdminGetUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: userData.userId
          });
          
          const adminResult = await cognitoClient.send(adminCommand);
          const userAttributes = {};
          adminResult.UserAttributes.forEach(attr => {
            userAttributes[attr.Name] = attr.Value;
          });
          
          userData.username = userAttributes.name;
          console.log('🔍 Debug: Updated fallback user data with Cognito info:', userData);
        } catch (cognitoError) {
          console.error('🔍 Debug: Error fetching username from Cognito in fallback:', cognitoError);
        }
      }
      
      // Only return if we have valid data (not example data)
      if (userData.userId && userData.email && userData.email !== 'user@example.com') {
        return userData;
      }
      
      // If we still don't have valid data, throw an error
      throw new Error('Unable to extract valid user data from token');
    } catch (decodeError) {
      console.error('🔍 Debug: Final fallback error:', decodeError);
      throw new Error('Failed to get user data: ' + error.message);
    }
  }
};


// Function to validate if users exist in Cognito
const validateUsers = async (userEmails) => {
  const validUsers = [];
  const invalidUsers = [];
  
  console.log('🔍 Debug: validateUsers called with emails:', userEmails);
  console.log('🔍 Debug: USER_POOL_ID:', USER_POOL_ID);
  
  for (const email of userEmails) {
    try {
      console.log(`🔍 Debug: Checking user: ${email}`);
      
      // Search for users by email attribute - try different filter syntax
      const listCommand = new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Filter: `email = "${email}"`
      });
      
      console.log('🔍 Debug: ListUsersCommand params:', {
        UserPoolId: USER_POOL_ID,
        Filter: `email = "${email}"`
      });
      
      const result = await cognitoClient.send(listCommand);
      console.log('🔍 Debug: ListUsersCommand result:', JSON.stringify(result, null, 2));
      
      if (result.Users && result.Users.length > 0) {
        console.log(`🔍 Debug: User ${email} found, count:`, result.Users.length);
        validUsers.push(email);
      } else {
        console.log(`🔍 Debug: User ${email} not found`);
        invalidUsers.push(email);
      }
    } catch (error) {
      console.error(`🔍 Debug: Error checking user ${email}:`, error);
      console.error(`🔍 Debug: Error name:`, error.name);
      console.error(`🔍 Debug: Error message:`, error.message);
      invalidUsers.push(email);
    }
  }
  
  console.log('🔍 Debug: Final result:', { validUsers, invalidUsers });
  return { validUsers, invalidUsers };
};

const uploadFile = async (userId, fileData, fileName, fileType, fileSize) => {
  try {
    if (!userId || !fileData || !fileName || !fileType || !fileSize) {
      throw new Error("Missing one or more required parameters for file upload.");
    }

    const fileId = uuidv4();
    const key = `${userId}/${fileId}/${fileName}`;

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: Buffer.from(fileData, 'base64'),
      ContentType: fileType,
      Metadata: {
        userId,
        fileName,
        fileSize: fileSize.toString()
      }
    });

    await s3Client.send(uploadCommand); // ✅ use s3Client here
    console.log(`File uploaded to S3 at key: ${key}`);

    // Store metadata in DynamoDB
    const item = {
      fileId: fileId,
      userId: userId,
      fileName: fileName,
      fileType: fileType,
      fileSize: fileSize,
      s3Key: key,
      uploadedAt: new Date().toISOString(),
      sharedWith: []
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    }));

    return {
      fileId: fileId,
      fileName: fileName,
      message: 'File uploaded successfully'
    };

  } catch (error) {
    console.error("uploadFile error:", error);
    throw new Error(error.message);
  }
};



const getFiles = async (userId) => {
  try {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await docClient.send(command);
    const files = (result.Items || []).filter(item => item.type !== 'upload_session');
    
    // Add URL field and owner information to each file
    const filesWithUrls = await Promise.all(files.map(async (file) => {
      // Get user information for the file owner
      let ownerInfo = { fullName: 'Unknown' };
      try {
        console.log('🔍 Debug: Looking up user info for userId:', file.userId);
        
        const adminCommand = new AdminGetUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: file.userId
        });
        const userResult = await cognitoClient.send(adminCommand);
        console.log('🔍 Debug: User lookup result:', userResult);
        
        if (userResult.User) {
          const emailAttr = userResult.User.Attributes?.find(attr => attr.Name === 'email');
          const nameAttr = userResult.User.Attributes?.find(attr => attr.Name === 'name');
          console.log('🔍 Debug: Found attributes - email:', emailAttr?.Value, 'name:', nameAttr?.Value);
          
          ownerInfo = {
            fullName: nameAttr?.Value || emailAttr?.Value || 'Unknown'
          };
        }
      } catch (error) {
        console.error('Error getting user info for file owner:', error);
        // Try alternative approach - use email as username
        try {
          const listCommand = new ListUsersCommand({
            UserPoolId: USER_POOL_ID,
            Filter: `email = "${file.userId}"`
          });
          const listResult = await cognitoClient.send(listCommand);
          if (listResult.Users && listResult.Users.length > 0) {
            const user = listResult.Users[0];
            const emailAttr = user.Attributes?.find(attr => attr.Name === 'email');
            const nameAttr = user.Attributes?.find(attr => attr.Name === 'name');
            ownerInfo = {
              fullName: nameAttr?.Value || emailAttr?.Value || 'Unknown'
            };
          }
        } catch (listError) {
          console.error('Error with alternative user lookup:', listError);
        }
      }

      let fileUrl;
      if (file.fileType === 'video' || file.fileType === 'audio') {
        try {
          console.log('🔍 Generating presigned URL for media file:', {
            fileId: file.fileId,
            userId: file.userId,
            fileType: file.fileType,
            fileName: file.fileName
          });
          
          const presignedResult = await generatePresignedUrl(file.fileId, file.userId);
          fileUrl = presignedResult.downloadUrl;
          
          console.log('🔍 Presigned URL generated successfully:', {
            fileId: file.fileId,
            urlLength: fileUrl.length,
            urlPreview: fileUrl.substring(0, 100) + '...'
          });
        } catch (error) {
          console.error('🔍 Failed to generate presigned URL for media file:', {
            fileId: file.fileId,
            userId: file.userId,
            error: error.message,
            stack: error.stack
          });
          fileUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${file.s3Key}`;
        }
      } else {
        fileUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${file.s3Key}`;
      }

      return {
        ...file,
        url: fileUrl,
        name: file.fileName,
        type: file.fileType,
        size: file.fileSize,
        extension: file.fileName.split('.').pop()?.toLowerCase() || '',
        $id: file.fileId,
        $createdAt: file.uploadedAt,
        owner: ownerInfo
      };
    }));
    
    return filesWithUrls;
  } catch (error) {
    console.error('GetFiles error:', error);
    throw new Error(error.message);
  }
};

const generatePresignedUrl = async (fileId, userId) => {
  try {
    // Get file metadata from DynamoDB
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :userId AND fileId = :fileId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':fileId': fileId
      }
    });

    const result = await docClient.send(command);
    if (!result.Items || result.Items.length === 0) {
      throw new Error('File not found');
    }

    const file = result.Items[0];
    const getObjectCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: file.s3Key,
      ResponseContentDisposition: `attachment; filename="${file.fileName}"`,
      ResponseContentType: getMimeType(file.fileName)
    });

    const presignedUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });
    return {
      downloadUrl: presignedUrl,
      fileName: file.fileName
    };
  } catch (error) {
    console.error('GeneratePresignedUrl error:', error);
    throw new Error(error.message);
  }
};

// Helper function to get MIME type based on file extension
const getMimeType = (fileName) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Videos
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    // Other
    'json': 'application/json',
    'xml': 'application/xml',
    'csv': 'text/csv',
  };
  return mimeTypes[extension] || 'application/octet-stream';
};

const deleteFile = async (fileId, userId) => {
  try {
    // Get file metadata from DynamoDB
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :userId AND fileId = :fileId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':fileId': fileId
      }
    });
    
    const result = await docClient.send(command);
    if (!result.Items || result.Items.length === 0) {
      throw new Error('File not found');
    }

    const file = result.Items[0];

    // Delete from S3
    const deleteS3Command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: file.s3Key
    });
    await s3Client.send(deleteS3Command);

    // Delete from DynamoDB
    const deleteDynamoCommand = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        userId: userId,
        fileId: fileId
      }
    });
    await docClient.send(deleteDynamoCommand);

    return { message: 'File deleted successfully' };
  } catch (error) {
    console.error('DeleteFile error:', error);
    throw new Error(error.message);
  }
};

// Main Lambda handler
export const handler = async (event) => {
  console.log('Lambda Event:', JSON.stringify(event, null, 2));

  // Validate environment variables
  if (!AWS_REGION || !USER_POOL_ID || !CLIENT_ID || !CLIENT_SECRET || !TABLE_NAME || !BUCKET_NAME) {
    console.error('Missing required environment variables:', {
      AWS_REGION: !!AWS_REGION,
      USER_POOL_ID: !!USER_POOL_ID,
      CLIENT_ID: !!CLIENT_ID,
      CLIENT_SECRET: !!CLIENT_SECRET,
      TABLE_NAME: !!TABLE_NAME,
      BUCKET_NAME: !!BUCKET_NAME
    });
    return createResponse(500, { error: 'Server configuration error' });
  }

  // Log AWS configuration for debugging
  console.log('🔍 Debug: AWS Configuration:', {
    AWS_REGION,
    USER_POOL_ID,
    CLIENT_ID: CLIENT_ID ? 'SET' : 'NOT_SET',
    CLIENT_SECRET: CLIENT_SECRET ? 'SET' : 'NOT_SET',
    TABLE_NAME,
    BUCKET_NAME
  });

  // Set default values for missing environment variables (for local testing)
  const finalAWS_REGION = AWS_REGION || 'ap-south-1';
  const finalUSER_POOL_ID = USER_POOL_ID || 'ap-south-1_YTxTD2kMu';
  const finalCLIENT_ID = CLIENT_ID || '7p4a6mdh0srv6ou2i7fu78g8o8';

  console.log('🔍 Debug: Using configuration:', {
    AWS_REGION: finalAWS_REGION,
    USER_POOL_ID: finalUSER_POOL_ID,
    CLIENT_ID: finalCLIENT_ID,
    TABLE_NAME: TABLE_NAME,
    BUCKET_NAME: BUCKET_NAME
  });

  try {
    console.log('🔍 Debug: Full event:', JSON.stringify(event, null, 2));
    const { rawPath, body, headers, requestContext } = event;
    console.log('🔍 Debug: Event structure:', { rawPath, hasRequestContext: !!requestContext, hasHttp: !!requestContext?.http });
    
    // Try different path extraction methods
    let path = rawPath;
    if (!path && requestContext?.http?.path) {
      path = requestContext.http.path;
    }
    if (!path && event.path) {
      path = event.path;
    }
    
    const httpMethod = event.httpMethod || requestContext?.http?.method || 'GET'; // API Gateway v2 method location
    console.log('🔍 Debug: Parsed path and method:', { path, httpMethod });
    let data = {};
    console.log('🔍 Debug: Raw body received:', body);
    console.log('🔍 Debug: Body type:', typeof body);
    console.log('🔍 Debug: Body length:', body ? body.length : 0);
    
    if (body) {
      try {
        data = JSON.parse(body);
        console.log('🔍 Debug: Parsed data successfully:', JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.error('🔍 Debug: JSON parse error:', parseError);
        console.error('🔍 Debug: Raw body:', body);
        return createResponse(400, { error: 'Invalid JSON in request body' });
      }
    } else {
      console.log('🔍 Debug: No body received');
    }

    // Handle CORS preflight
    if (httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'CORS preflight successful' });
    }

    // Route handling
    if (!path) {
      console.error('🔍 Debug: Path is undefined');
      return createResponse(400, { error: 'Invalid request path' });
    }
    const pathSegments = path.split('/');
    
    // Health check - handle this first
    if (path === '/health' && httpMethod === 'GET') {
      return createResponse(200, {
        status: 'OK',
        timestamp: new Date().toISOString(),
        services: 'AWS (Cognito, S3, DynamoDB)'
      });
    }
    
    // Handle file routes with dynamic parameters
    if (pathSegments[1] === 'files' && pathSegments.length >= 3) {
      const fileId = pathSegments[2];
      
      // Handle /files/{fileId} (DELETE)
      if (pathSegments.length === 3 && httpMethod === 'DELETE') {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          return createResponse(401, { error: 'Missing or invalid Authorization header' });
        }
    
        const token = authHeader.split(' ')[1];
    
        let userId;
        try {
          userId = await getUserIdFromToken(token);
        } catch (err) {
          console.error('Token verification error:', err);
          return createResponse(401, { error: 'Unauthorized' });
        }
    
        if (!fileId) {
          return createResponse(400, { error: 'Missing file ID' });
        }
    
        try {
          // Get file info first using QueryCommand since we need both userId and fileId
          const queryCommand = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'userId = :userId AND fileId = :fileId',
            ExpressionAttributeValues: {
              ':userId': userId,
              ':fileId': fileId
            }
          });
          
          const fileResult = await docClient.send(queryCommand);
          if (!fileResult.Items || fileResult.Items.length === 0) {
            return createResponse(404, { error: 'File not found' });
          }
          
          const file = fileResult.Items[0];
          
          // Delete from S3
          await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: file.s3Key
          }));
          
          // Delete from DynamoDB
          await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              userId: userId,
              fileId: fileId
            }
          }));
          
          return createResponse(200, { message: 'File deleted successfully' });
        } catch (err) {
          console.error('Delete file error:', err);
          return createResponse(500, { error: 'Failed to delete file' });
        }
      }
      
      // Handle /files/{fileId}/rename
      if (pathSegments.length === 4 && pathSegments[3] === 'rename' && httpMethod === 'PUT') {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          return createResponse(401, { error: 'Missing or invalid Authorization header' });
        }
    
        const token = authHeader.split(' ')[1];
    
        let userId;
        try {
          userId = await getUserIdFromToken(token);
        } catch (err) {
          console.error('Token verification error:', err);
          return createResponse(401, { error: 'Unauthorized' });
        }
    
        if (!fileId) {
          return createResponse(400, { error: 'Missing file ID' });
        }
    
        if (!data?.name) {
          return createResponse(400, { error: 'Missing new file name' });
        }
    
        try {
          // Get file info first using QueryCommand since we need both userId and fileId
          const queryCommand = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'userId = :userId AND fileId = :fileId',
            ExpressionAttributeValues: {
              ':userId': userId,
              ':fileId': fileId
            }
          });
          
          const fileResult = await docClient.send(queryCommand);
          if (!fileResult.Items || fileResult.Items.length === 0) {
            return createResponse(404, { error: 'File not found' });
          }
          
          const file = fileResult.Items[0];
          if (file.userId !== userId) {
            return createResponse(403, { error: 'Unauthorized access to file' });
          }
          
          // Generate new S3 key with the new filename
          const fileExtension = file.fileName.split('.').pop();
          const newS3Key = `${userId}/${fileId}/${data.name}`;
          
          // Copy the S3 object with the new name
          await s3Client.send(new CopyObjectCommand({
            Bucket: BUCKET_NAME,
            CopySource: `${BUCKET_NAME}/${file.s3Key}`,
            Key: newS3Key
          }));
          
          // Delete the old S3 object
          await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: file.s3Key
          }));
          
          // Update both fileName and s3Key in DynamoDB
          await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { userId: userId, fileId: fileId },
            UpdateExpression: 'SET fileName = :fileName, s3Key = :s3Key',
            ExpressionAttributeValues: {
              ':fileName': data.name,
              ':s3Key': newS3Key
            }
          }));
          
          return createResponse(200, { message: 'File renamed successfully' });
        } catch (err) {
          console.error('Rename file error:', err);
          return createResponse(500, { error: 'Failed to rename file' });
        }
      }
      
      // Handle /files/{fileId}/share
      if (pathSegments.length === 4 && pathSegments[3] === 'share' && httpMethod === 'PUT') {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          return createResponse(401, { error: 'Missing or invalid Authorization header' });
        }
    
        const token = authHeader.split(' ')[1];
    
        let userId;
        try {
          userId = await getUserIdFromToken(token);
        } catch (err) {
          console.error('Token verification error:', err);
          return createResponse(401, { error: 'Unauthorized' });
        }
    
        if (!fileId) {
          return createResponse(400, { error: 'Missing file ID' });
        }
    
        // Parse request body to get emails
        let requestData;
        try {
          requestData = JSON.parse(event.body || '{}');
        } catch (parseError) {
          console.error('Failed to parse request body:', parseError);
          return createResponse(400, { error: 'Invalid JSON in request body' });
        }
    
        if (!requestData?.emails || !Array.isArray(requestData.emails)) {
          return createResponse(400, { error: 'Missing or invalid emails array' });
        }
    
        try {
          // Get file info first
          const getCommand = new GetCommand({
            TableName: TABLE_NAME,
            Key: { userId: userId, fileId: fileId }
          });
          
          const fileResult = await docClient.send(getCommand);
          if (!fileResult.Item) {
            return createResponse(404, { error: 'File not found' });
          }
          
          if (fileResult.Item.userId !== userId) {
            return createResponse(403, { error: 'Unauthorized access to file' });
          }
          
          // Validate users exist in Cognito
          const { validUsers, invalidUsers } = await validateUsers(requestData.emails);
          
          if (invalidUsers.length > 0) {
            const errorMessage = invalidUsers.length === 1 
              ? 'User not exist'
              : 'These users not exist';
            
            return createResponse(400, { 
              error: errorMessage,
              invalidUsers,
              validUsers
            });
          }
          
          // Update file sharing in DynamoDB
          const updateCommand = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              userId: userId,
              fileId: fileId
            },
            UpdateExpression: 'SET sharedWith = :users',
            ExpressionAttributeValues: {
              ':users': validUsers
            }
          });
          
          await docClient.send(updateCommand);
          
          return createResponse(200, { 
            message: `File shared successfully with ${validUsers.length} user${validUsers.length !== 1 ? 's' : ''}`,
            sharedWith: validUsers,
            fileId: fileId,
            fileName: fileResult.Item.fileName
          });
        } catch (err) {
          console.error('Share file error:', err);
          return createResponse(500, { error: 'Failed to update file sharing' });
        }
      }
      
      // Handle /files/shared-with-me to list files shared with current user
      if (pathSegments.length === 3 && pathSegments[2] === 'shared-with-me' && httpMethod === 'GET') {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          return createResponse(401, { error: 'Missing or invalid Authorization header' });
        }
    
        const token = authHeader.split(' ')[1];
    
        try {
          // Get user's email from Cognito
          const userData = await getUserData(token);
          const userEmail = userData.email;
          
          console.log('🔍 Debug: User data extracted:', userData);
          console.log('🔍 Debug: Looking for files shared with email:', userEmail);
          
          // Use ScanCommand with proper filter for shared files
          const scanCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'contains(sharedWith, :userEmail)',
            ExpressionAttributeValues: {
              ':userEmail': userEmail
            }
          });
          
          console.log('🔍 Debug: DynamoDB scan command:', JSON.stringify(scanCommand, null, 2));
          
          const result = await docClient.send(scanCommand);
          const sharedFiles = result.Items || [];
          
          console.log('🔍 Debug: DynamoDB scan result:', {
            totalItems: result.Items?.length || 0,
            scannedCount: result.ScannedCount,
            items: result.Items?.map(item => ({
              fileId: item.fileId,
              fileName: item.fileName,
              sharedWith: item.sharedWith,
              userId: item.userId
            }))
          });
          
          // Transform files for response
          const transformedFiles = await Promise.all(sharedFiles.map(async (file) => {
            console.log('🔍 Processing shared file:', file.fileId, 'with userId:', file.userId);
            
            // Get sender's username from Cognito
            let senderDetails;
            try {
              console.log('🔍 Fetching user details for userId:', file.userId);
              senderDetails = await getUserDetailsByUserId(file.userId);
              console.log('🔍 Sender details received:', senderDetails);
            } catch (error) {
              console.error('Failed to get sender details for file:', file.fileId, error);
              senderDetails = { username: file.userId, email: file.userId };
            }
            
            // Generate presigned URL for media files
            let fileUrl;
            if (file.fileType === 'video' || file.fileType === 'audio') {
              try {
                // For shared files, we need to generate presigned URLs
                const presignedResult = await generatePresignedUrl(file.fileId, file.userId);
                fileUrl = presignedResult.downloadUrl;
              } catch (error) {
                console.error('Failed to generate presigned URL for shared media file:', error);
                fileUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${file.s3Key}`;
              }
            } else {
              fileUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${file.s3Key}`;
            }
            
            return {
              fileId: file.fileId,
              fileName: file.fileName,
              fileType: file.fileType,
              fileSize: file.fileSize,
              uploadedAt: file.uploadedAt,
              sharedBy: file.userId,
              owner: senderDetails.username, // Set the actual sender's username
              downloadUrl: fileUrl,
              extension: file.fileName?.split('.').pop() || '',
              $id: file.fileId,
              $createdAt: file.uploadedAt,
              name: file.fileName,
              size: file.fileSize,
              type: file.fileType,
              url: fileUrl,
              bucketFileId: file.s3Key
            };
          }));
          
          return createResponse(200, {
            documents: transformedFiles,
            total: transformedFiles.length
          });
        } catch (err) {
          console.error('Get shared files error:', err);
          return createResponse(500, { error: 'Failed to get shared files' });
        }
      }
      
      // Handle /files/{fileId}/access for shared file access
      if (pathSegments.length === 4 && pathSegments[3] === 'access' && httpMethod === 'GET') {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          return createResponse(401, { error: 'Missing or invalid Authorization header' });
        }
    
        const token = authHeader.split(' ')[1];
    
        let userId;
        try {
          userId = await getUserIdFromToken(token);
        } catch (err) {
          console.error('Token verification error:', err);
          return createResponse(401, { error: 'Unauthorized' });
        }
    
        if (!fileId) {
          return createResponse(400, { error: 'Missing file ID' });
        }
    
        try {
          // Get user's email from Cognito
          const userData = await getUserData(token);
          const userEmail = userData.email;
          
          // Scan for files shared with this user
          const scanCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'contains(sharedWith, :userEmail)',
            ExpressionAttributeValues: {
              ':userEmail': userEmail
            }
          });
          
          const result = await docClient.send(scanCommand);
          const sharedFiles = result.Items || [];
          
          // Find the specific file being requested
          const requestedFile = sharedFiles.find(file => file.fileId === fileId);
          
          if (!requestedFile) {
            return createResponse(403, { error: 'Access denied to this file' });
          }
          
          // Return file information (without sensitive data)
          return createResponse(200, {
            fileId: requestedFile.fileId,
            fileName: requestedFile.fileName,
            fileType: requestedFile.fileType,
            fileSize: requestedFile.fileSize,
            uploadedAt: requestedFile.uploadedAt,
            sharedBy: requestedFile.userId,
            downloadUrl: `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${requestedFile.s3Key}`
          });
        } catch (err) {
          console.error('Access shared file error:', err);
          return createResponse(500, { error: 'Failed to access shared file' });
        }
      }
      
      // Handle /files/{fileId}/download-shared for downloading shared files
      if (pathSegments.length === 4 && pathSegments[3] === 'download-shared' && httpMethod === 'POST') {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          return createResponse(401, { error: 'Missing or invalid Authorization header' });
        }
    
        const token = authHeader.split(' ')[1];
    
        try {
          // Get user's email from Cognito
          const userData = await getUserData(token);
          const userEmail = userData.email;
          
          if (!fileId) {
            return createResponse(400, { error: 'Missing file ID' });
          }
          
          // Scan for files shared with this user
          const scanCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'contains(sharedWith, :userEmail)',
            ExpressionAttributeValues: {
              ':userEmail': userEmail
            }
          });
          
          const result = await docClient.send(scanCommand);
          const sharedFiles = result.Items || [];
          
          // Find the specific file being requested
          const requestedFile = sharedFiles.find(file => file.fileId === fileId);
          
          if (!requestedFile) {
            return createResponse(403, { error: 'Access denied to this file' });
          }
          
          // Generate presigned URL for download
          const getObjectCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: requestedFile.s3Key,
            fileType: requestedFile.fileType
          });
          
          const presignedUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });
          
          return createResponse(200, {
            downloadUrl: presignedUrl,
            fileName: requestedFile.fileName,
            fileSize: requestedFile.fileSize,
            fileType: requestedFile.fileType
          });
        } catch (err) {
          console.error('Download shared file error:', err);
          return createResponse(500, { error: 'Failed to download shared file' });
        }
      }
    }
    
    // Handle other static routes
    switch (path) {
      // Authentication routes
      case '/auth/signup':
        if (httpMethod === 'POST') {
          const result = await signUp(data.email, data.password, data.username);
          return createResponse(200, result);
        }
        break;

      case '/auth/confirm':
        if (httpMethod === 'POST') {
          // Handle both signup confirmation and password reset confirmation
          if (data.type === 'signup') {
            const result = await confirmSignUp(data.email, data.otp, data.password);
            return createResponse(200, result);
          } else if (data.type === 'password-reset') {
            const result = await verifyResetOTP(data.email, data.otp);
            return createResponse(200, result);
          } else {
            return createResponse(400, { error: 'Invalid confirmation type. Must be "signup" or "password-reset"' });
          }
        }
        break;

      case '/auth/verify':
        if (httpMethod === 'POST') {
          const result = await confirmSignUp(data.email, data.otp);
          return createResponse(200, result);
        }
        break;

      case '/auth/verify-reset-otp':
        if (httpMethod === 'POST') {
          const result = await verifyResetOTP(data.email, data.resetCode);
          return createResponse(200, result);
        }
        break;

      case '/debug/reset-codes':
        if (httpMethod === 'GET') {
          try {
            const scanCommand = new ScanCommand({
              TableName: TABLE_NAME,
              FilterExpression: 'userId = :userId',
              ExpressionAttributeValues: {
                ':userId': 'RESET_CODES'
              }
            });
            
            const result = await docClient.send(scanCommand);
            return createResponse(200, {
              resetCodes: result.Items || [],
              count: result.Items?.length || 0
            });
          } catch (error) {
            console.error('Debug reset codes error:', error);
            return createResponse(500, { error: 'Failed to get reset codes' });
          }
        }
        break;

      case '/debug/trigger-forgot-password':
        if (httpMethod === 'POST') {
          try {
            const result = await forgotPassword(data.email);
            return createResponse(200, result);
          } catch (error) {
            console.error('Debug trigger forgot password error:', error);
            return createResponse(500, { error: error.message });
          }
        }
        break;

      case '/auth/signin':
        if (httpMethod === 'POST') {
          const result = await signIn(data.email, data.password, data.username);
          return createResponse(200, result);
        }
        break;

      case '/auth/refresh':
        if (httpMethod === 'POST') {
          try {
            if (!data?.refreshToken) {
              return createResponse(400, { error: 'Refresh token is required' });
            }

            // Verify the refresh token with Cognito
            const command = new InitiateAuthCommand({
              AuthFlow: 'REFRESH_TOKEN_AUTH',
              ClientId: finalCLIENT_ID,
              AuthParameters: {
                REFRESH_TOKEN: data.refreshToken,
              },
            });

            const result = await cognitoClient.send(command);
            
            if (result.AuthenticationResult?.AccessToken) {
              return createResponse(200, {
                token: result.AuthenticationResult.AccessToken,
                message: 'Token refreshed successfully'
              });
            } else {
              return createResponse(400, { error: 'Failed to refresh token' });
            }
          } catch (error) {
            console.error('Token refresh error:', error);
            return createResponse(400, { error: 'Invalid refresh token' });
          }
        }
        break;

      case '/auth/forgot-password':
        if (httpMethod === 'POST') {
          const result = await forgotPassword(data.email);
          return createResponse(200, result);
        }
        break;

      case '/auth/reset-password':
        if (httpMethod === 'POST') {
          const result = await confirmForgotPassword(data.email, data.resetCode, data.newPassword);
          return createResponse(200, result);
        }
        break;

      case '/auth/resend-otp':
        if (httpMethod === 'POST') {
          const result = await resendOTP(data.email);
          return createResponse(200, result);
        }
        break;

      case '/auth/me':
        if (httpMethod === 'GET') {
          const authHeader = event.headers?.Authorization || event.headers?.authorization;
          if (!authHeader?.startsWith('Bearer ')) {
            return createResponse(401, { error: 'Missing or invalid Authorization header' });
          }
      
          const token = authHeader.split(' ')[1];
          console.log('🔍 Debug: Received token (first 50 chars):', token.substring(0, 50) + '...');
          console.log('🔍 Debug: Token type:', getTokenType(token));
      
          try {
            const userData = await getUserData(token);
            // Transform user data to match frontend expectations
            const transformedUserData = {
              id: userData.userId,
              $id: userData.userId,
              accountId: userData.userId,
              email: userData.email,
              username: userData.username,
              emailVerified: userData.emailVerified,
              backendVersion: 'Newfolder-v2.0',
              timestamp: new Date().toISOString()
            };
            return createResponse(200, transformedUserData);
          } catch (err) {
            console.error('Get user data error:', err);
            return createResponse(401, { error: 'Unauthorized' });
          }
        }
        break;

      // File operations routes
      case '/upload':
        if (httpMethod === 'POST') {
          const authHeader = event.headers?.Authorization || event.headers?.authorization;
          if (!authHeader?.startsWith('Bearer ')) {
            return createResponse(401, { error: 'Missing or invalid Authorization header' });
          }
      
          const token = authHeader.split(' ')[1];
      
          let userId;
          try {
            userId = await getUserIdFromToken(token);
          } catch (err) {
            console.error('Token verification error:', err);
            return createResponse(401, { error: 'Unauthorized' });
          }
      
          if (!data?.fileData || !data?.fileName || !data?.fileType) {
            return createResponse(400, { error: 'Missing required fields' });
          }
      
          const buffer = Buffer.from(data.fileData, 'base64');
      
          try {
            const result = await uploadFile(
              userId,
              data.fileData,
              data.fileName,
              data.fileType,
              data.fileSize || buffer.length
            );
            return createResponse(200, result);
          } catch (err) {
            console.error('Upload error:', err);
            return createResponse(500, { error: 'File upload failed' });
          }
        }
        break;

      case '/upload/init':
        if (httpMethod === 'POST') {
          const authHeader = event.headers?.Authorization || event.headers?.authorization;
          if (!authHeader?.startsWith('Bearer ')) {
            return createResponse(401, { error: 'Missing or invalid Authorization header' });
          }
      
          const token = authHeader.split(' ')[1];
      
          let userId;
          try {
            userId = await getUserIdFromToken(token);
          } catch (err) {
            console.error('Token verification error:', err);
            return createResponse(401, { error: 'Unauthorized' });
          }
      
          if (!data?.fileName || !data?.fileType || !data?.fileSize || !data?.totalChunks) {
            return createResponse(400, { error: 'Missing required fields for upload initialization' });
          }
      
          try {
            const uploadId = uuidv4();
            const fileId = uuidv4();
            
            // Store upload session in DynamoDB
            const uploadSessionItem = {
              userId,
              fileId: uploadId, // Use uploadId as fileId for the composite key
              uploadId,
              actualFileId: fileId, // Store the actual fileId separately
              fileName: data.fileName,
              fileType: data.fileType,
              fileSize: data.fileSize,
              totalChunks: data.totalChunks,
              uploadedChunks: 0,
              chunks: {},
              createdAt: new Date().toISOString(),
              status: 'initiated',
              type: 'upload_session' // To distinguish from regular files
            };
            
            console.log('🔍 Storing upload session:', JSON.stringify(uploadSessionItem, null, 2));
            
            await docClient.send(new PutCommand({
              TableName: TABLE_NAME,
              Item: uploadSessionItem
            }));
            
            console.log('🔍 Upload session stored successfully');
            return createResponse(200, { uploadId, fileId });
          } catch (err) {
            console.error('Upload init error:', err);
            return createResponse(500, { error: 'Failed to initialize upload' });
          }
        }
        break;

      case '/upload/chunk':
        if (httpMethod === 'POST') {
          const authHeader = event.headers?.Authorization || event.headers?.authorization;
          if (!authHeader?.startsWith('Bearer ')) {
            return createResponse(401, { error: 'Missing or invalid Authorization header' });
          }
      
          const token = authHeader.split(' ')[1];
      
          let userId;
          try {
            userId = await getUserIdFromToken(token);
          } catch (err) {
            console.error('Token verification error:', err);
            return createResponse(401, { error: 'Unauthorized' });
          }
      
                console.log('🔍 Chunk upload data received:', JSON.stringify(data, null, 2));
      console.log('🔍 Checking required fields:', {
        hasUploadId: !!data?.uploadId,
        hasFileId: !!data?.fileId,
        hasChunkIndex: data?.chunkIndex !== undefined && data?.chunkIndex !== null,
        hasChunkData: !!data?.chunkData,
        uploadId: data?.uploadId,
        fileId: data?.fileId,
        chunkIndex: data?.chunkIndex,
        chunkDataLength: data?.chunkData ? data.chunkData.length : 0
      });
      
      if (!data?.uploadId || !data?.fileId || data?.chunkIndex === undefined || data?.chunkIndex === null || !data?.chunkData) {
        return createResponse(400, { error: 'Missing required fields for chunk upload' });
      }
      
          try {
            // Get upload session
            const getCommand = new GetCommand({
              TableName: TABLE_NAME,
              Key: { 
                userId: userId,
                fileId: data.uploadId 
              }
            });
            
            console.log('🔍 Looking up upload session with key:', { userId, fileId: data.uploadId });
            
            const uploadSession = await docClient.send(getCommand);
            if (!uploadSession.Item) {
              console.error('🔍 Upload session not found for key:', { userId, fileId: data.uploadId });
              return createResponse(404, { error: 'Upload session not found' });
            }
            
            console.log('🔍 Found upload session:', JSON.stringify(uploadSession.Item, null, 2));
            
            if (uploadSession.Item.userId !== userId) {
              return createResponse(403, { error: 'Unauthorized access to upload session' });
            }
            
            // Store chunk in S3
            const chunkKey = `${userId}/${data.uploadId}/chunk_${data.chunkIndex}`;
            const chunkBuffer = Buffer.from(data.chunkData, 'base64');
            
            console.log('🔍 Storing chunk in S3:', { chunkKey, chunkSize: chunkBuffer.length });
            
            await s3Client.send(new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: chunkKey,
              Body: chunkBuffer,
              ContentType: 'application/octet-stream'
            }));
            
            console.log('🔍 Chunk stored in S3 successfully');
            
            // Update upload session
            const newChunks = { ...uploadSession.Item.chunks };
            newChunks[data.chunkIndex] = chunkKey;
            
            await docClient.send(new UpdateCommand({
              TableName: TABLE_NAME,
              Key: { 
                userId: userId,
                fileId: data.uploadId 
              },
              UpdateExpression: 'SET chunks = :chunks, uploadedChunks = :uploadedChunks',
              ExpressionAttributeValues: {
                ':chunks': newChunks,
                ':uploadedChunks': uploadSession.Item.uploadedChunks + 1
              }
            }));
            
            console.log('🔍 Upload session updated successfully');
            
            return createResponse(200, { 
              message: 'Chunk uploaded successfully',
              uploadedChunks: uploadSession.Item.uploadedChunks + 1,
              totalChunks: uploadSession.Item.totalChunks
            });
          } catch (err) {
            console.error('Chunk upload error:', err);
            return createResponse(500, { error: 'Failed to upload chunk' });
          }
        }
        break;

      case '/upload/complete':
        if (httpMethod === 'POST') {
          const authHeader = event.headers?.Authorization || event.headers?.authorization;
          if (!authHeader?.startsWith('Bearer ')) {
            return createResponse(401, { error: 'Missing or invalid Authorization header' });
          }
      
          const token = authHeader.split(' ')[1];
      
          let userId;
          try {
            userId = await getUserIdFromToken(token);
          } catch (err) {
            console.error('Token verification error:', err);
            return createResponse(401, { error: 'Unauthorized' });
          }
      
          if (!data?.uploadId || !data?.fileId) {
            return createResponse(400, { error: 'Missing required fields for upload completion' });
          }
      
          try {
            // Get upload session
            const getCommand = new GetCommand({
              TableName: TABLE_NAME,
              Key: { 
                userId: userId,
                fileId: data.uploadId 
              }
            });
            
            const uploadSession = await docClient.send(getCommand);
            if (!uploadSession.Item) {
              return createResponse(404, { error: 'Upload session not found' });
            }
            
            if (uploadSession.Item.userId !== userId) {
              return createResponse(403, { error: 'Unauthorized access to upload session' });
            }
            
            // Combine all chunks into final file
            const finalKey = `${userId}/${uploadSession.Item.actualFileId}/${uploadSession.Item.fileName}`;
            const chunks = Object.keys(uploadSession.Item.chunks).sort((a, b) => parseInt(a) - parseInt(b));
            
            // Download and combine chunks
            const chunkBuffers = [];
            for (const chunkIndex of chunks) {
              const chunkKey = uploadSession.Item.chunks[chunkIndex];
              const chunkResponse = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: chunkKey
              }));
              
              const chunkBuffer = await streamToBuffer(chunkResponse.Body);
              chunkBuffers.push(chunkBuffer);
            }
            
            const finalBuffer = Buffer.concat(chunkBuffers);
            
            // Upload final file
            await s3Client.send(new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: finalKey,
              Body: finalBuffer,
              ContentType: uploadSession.Item.fileType,
              Metadata: {
                userId,
                fileName: uploadSession.Item.fileName,
                fileSize: uploadSession.Item.fileSize.toString()
              }
            }));
            
            // Store metadata in DynamoDB
            const item = {
              fileId: uploadSession.Item.actualFileId,
              userId: userId,
              fileName: uploadSession.Item.fileName,
              fileType: uploadSession.Item.fileType,
              fileSize: uploadSession.Item.fileSize,
              s3Key: finalKey,
              uploadedAt: new Date().toISOString(),
              sharedWith: []
            };

            await docClient.send(new PutCommand({
              TableName: TABLE_NAME,
              Item: item
            }));
            
            // Clean up chunks
            for (const chunkKey of Object.values(uploadSession.Item.chunks)) {
              try {
                await s3Client.send(new DeleteObjectCommand({
                  Bucket: BUCKET_NAME,
                  Key: chunkKey
                }));
              } catch (err) {
                console.error('Failed to delete chunk:', chunkKey, err);
              }
            }
            
            // Delete upload session
            await docClient.send(new DeleteCommand({
              TableName: TABLE_NAME,
              Key: { 
                userId: userId,
                fileId: data.uploadId 
              }
            }));
            
            return createResponse(200, {
              fileId: data.fileId,
              fileName: uploadSession.Item.fileName,
              message: 'File uploaded successfully'
            });
          } catch (err) {
            console.error('Upload completion error:', err);
            return createResponse(500, { error: 'Failed to complete upload' });
          }
        }
        break;

      case '/files':
        if (httpMethod === 'GET') {
          const authHeader = event.headers?.Authorization || event.headers?.authorization;
          if (!authHeader?.startsWith('Bearer ')) {
            return createResponse(401, { error: 'Missing or invalid Authorization header' });
          }
      
          const token = authHeader.split(' ')[1];
      
          try {
            const userData = await getUserData(token);
            const files = await getFiles(userData.userId);
            
            // Get query parameters for filtering
            const queryParams = event.queryStringParameters || {};
            const searchText = queryParams.search || '';
            const types = queryParams.types ? queryParams.types.split(',') : [];
            const sort = queryParams.sort || '$createdAt-desc';
            const limit = queryParams.limit ? parseInt(queryParams.limit) : null;
            
            // Transform files to match frontend expectations
            let transformedFiles = files.map(file => {
              // Determine category based on file type
              let category = 'other';
              const mimeType = file.fileType?.toLowerCase() || '';
              const extension = file.fileName?.split('.').pop()?.toLowerCase() || '';
              
              if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension)) {
                category = 'image';
              } else if (mimeType.startsWith('text/') || mimeType.includes('document') || mimeType.includes('pdf') || 
                        ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages'].includes(extension)) {
                category = 'document';
              } else if (mimeType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
                category = 'video';
              } else if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(extension)) {
                category = 'audio';
              }
              
              return {
                $id: file.fileId,
                $createdAt: file.uploadedAt,
                name: file.fileName,
                size: file.fileSize,
                type: category, // Use the determined category as type
                url: file.url,
                extension: file.fileName?.split('.').pop() || '',
                bucketFileId: file.s3Key,
                users: file.sharedWith || [],
                owner: userData.username,
                category: category // Add category field for additional classification
              };
            });
            
            // Apply search filter
            if (searchText) {
              transformedFiles = transformedFiles.filter(file => 
                file.name.toLowerCase().includes(searchText.toLowerCase())
              );
            }
            
            // Apply type filter
            if (types.length > 0) {
              transformedFiles = transformedFiles.filter(file => 
                types.includes(file.type)
              );
            }
            
            // Apply sorting
            if (sort === '$createdAt-desc') {
              transformedFiles.sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime());
            } else if (sort === '$createdAt-asc') {
              transformedFiles.sort((a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime());
            } else if (sort === 'name-asc') {
              transformedFiles.sort((a, b) => a.name.localeCompare(b.name));
            } else if (sort === 'name-desc') {
              transformedFiles.sort((a, b) => b.name.localeCompare(a.name));
            } else if (sort === 'size-desc') {
              transformedFiles.sort((a, b) => b.size - a.size);
            } else if (sort === 'size-asc') {
              transformedFiles.sort((a, b) => a.size - b.size);
            }
            
            // Apply limit
            if (limit) {
              transformedFiles = transformedFiles.slice(0, limit);
            }
            
            return createResponse(200, { 
              documents: transformedFiles,
              total: transformedFiles.length
            });
          } catch (err) {
            console.error('Get files error:', err);
            return createResponse(401, { error: 'Unauthorized' });
          }
        }
        break;

      case '/files/stats':
        if (httpMethod === 'GET') {
          const authHeader = event.headers?.Authorization || event.headers?.authorization;
          if (!authHeader?.startsWith('Bearer ')) {
            return createResponse(401, { error: 'Missing or invalid Authorization header' });
          }
      
          const token = authHeader.split(' ')[1];
      
          try {
            const userData = await getUserData(token);
            const files = await getFiles(userData.userId);
            
            // Calculate storage stats
            const stats = {
              used: 0,
              all: 2 * 1024 * 1024 * 1024, // 2GB
              image: { size: 0, latestDate: null },
              document: { size: 0, latestDate: null },
              video: { size: 0, latestDate: null },
              audio: { size: 0, latestDate: null },
              other: { size: 0, latestDate: null }
            };
            
            files.forEach(file => {
              // Map file types to categories
              let category = 'other';
              const mimeType = file.fileType?.toLowerCase() || '';
              const extension = file.fileName?.split('.').pop()?.toLowerCase() || '';
              
              if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension)) {
                category = 'image';
              } else if (mimeType.startsWith('text/') || mimeType.includes('document') || mimeType.includes('pdf') || 
                        ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages'].includes(extension)) {
                category = 'document';
              } else if (mimeType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
                category = 'video';
              } else if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(extension)) {
                category = 'audio';
              }
              
              if (stats[category]) {
                stats[category].size += file.fileSize || 0;
                if (!stats[category].latestDate || file.uploadedAt > stats[category].latestDate) {
                  stats[category].latestDate = file.uploadedAt;
                }
              }
              stats.used += file.fileSize || 0;
            });
            
            return createResponse(200, stats);
          } catch (err) {
            console.error('Get stats error:', err);
            return createResponse(401, { error: 'Unauthorized' });
          }
        }
        break;

      case '/files/signed-url':
        if (httpMethod === 'POST') {
          const authHeader = event.headers?.Authorization || event.headers?.authorization;
          if (!authHeader?.startsWith('Bearer ')) {
            return createResponse(401, { error: 'Missing or invalid Authorization header' });
          }
      
          const token = authHeader.split(' ')[1];
      
          try {
            const userData = await getUserData(token);
            const result = await generatePresignedUrl(data.key, userData.userId);
            return createResponse(200, result);
          } catch (err) {
            console.error('Generate signed URL error:', err);
            return createResponse(401, { error: 'Unauthorized' });
          }
        }
        break;
        

      case '/download':
        if (httpMethod === 'POST') {
          const authHeader = event.headers?.Authorization || event.headers?.authorization;
          if (!authHeader?.startsWith('Bearer ')) {
            return createResponse(401, { error: 'Missing or invalid Authorization header' });
          }
      
          const token = authHeader.split(' ')[1];
      
          try {
            const userData = await getUserData(token);
            const result = await generatePresignedUrl(data.fileId, userData.userId);
            return createResponse(200, result);
          } catch (err) {
            console.error('Download error:', err);
            return createResponse(401, { error: 'Unauthorized' });
          }
        }
        break;

      case '/files/delete':
        if (httpMethod === 'DELETE') {
          const authHeader = event.headers?.Authorization || event.headers?.authorization;
          if (!authHeader?.startsWith('Bearer ')) {
            return createResponse(401, { error: 'Missing or invalid Authorization header' });
          }
      
          const token = authHeader.split(' ')[1];
      
          try {
            const userData = await getUserData(token);
            const result = await deleteFile(data.fileId, userData.userId);
            return createResponse(200, result);
          } catch (err) {
            console.error('Delete file error:', err);
            return createResponse(401, { error: 'Unauthorized' });
          }
        }
        break;

      // Dynamic routes for file operations
      default:
        // Handle file download routes (4 segments)
        if (pathSegments.length === 4 && pathSegments[1] === 'files' && pathSegments[3] === 'download') {
          const fileId = pathSegments[2];
          
          if (httpMethod === 'GET') {
            const authHeader = event.headers?.Authorization || event.headers?.Authorization;
            if (!authHeader?.startsWith('Bearer ')) {
              return createResponse(401, { error: 'Missing or invalid Authorization header' });
            }
        
            const token = authHeader.split(' ')[1];
        
            try {
              const userData = await getUserData(token);
              const result = await generatePresignedUrl(fileId, userData.userId);
              return createResponse(200, result);
            } catch (err) {
              console.error('Download file error:', err);
              return createResponse(401, { error: 'Unauthorized' });
            }
          }
        }
        
        // Handle video streaming routes (4 segments)
        if (pathSegments.length === 4 && pathSegments[1] === 'files' && pathSegments[3] === 'stream') {
          const fileId = pathSegments[2];
          
          if (httpMethod === 'GET') {
            const authHeader = event.headers?.Authorization || event.headers?.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
              return createResponse(401, { error: 'Missing or invalid Authorization header' });
            }
        
            const token = authHeader.split(' ')[1];
        
            try {
              const userData = await getUserData(token);
              
              // Get file metadata from DynamoDB
              const command = new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'userId = :userId AND fileId = :fileId',
                ExpressionAttributeValues: {
                  ':userId': userData.userId,
                  ':fileId': fileId
                }
              });
              
              const result = await docClient.send(command);
              if (!result.Items || result.Items.length === 0) {
                return createResponse(404, { error: 'File not found' });
              }
              
              const file = result.Items[0];
              
              // Check if it's a video file
              if (file.fileType !== 'video') {
                return createResponse(400, { error: 'File is not a video' });
              }
              
              // Generate presigned URL for streaming (longer expiration for videos)
              const getObjectCommand = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: file.s3Key,
                ResponseContentType: getMimeType(file.fileName)
              });
              
              const presignedUrl = await getSignedUrl(s3Client, getObjectCommand, { 
                expiresIn: 7200 // 2 hours for video streaming
              });
              
              return createResponse(200, {
                streamUrl: presignedUrl,
                fileName: file.fileName,
                fileType: file.fileType,
                fileSize: file.fileSize
              });
            } catch (err) {
              console.error('Video streaming error:', err);
              return createResponse(500, { error: 'Failed to generate streaming URL' });
            }
          }
        }
        

        
        // Handle dynamic file routes (3 segments)
        if (pathSegments.length === 3 && pathSegments[1] === 'files' && pathSegments[2] !== 'stats' && pathSegments[2] !== 'signed-url') {
          const fileId = pathSegments[2];
          
          if (httpMethod === 'PUT') {
            const authHeader = event.headers?.Authorization || event.headers?.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
              return createResponse(401, { error: 'Missing or invalid Authorization header' });
            }
        
            const token = authHeader.split(' ')[1];
        
            try {
              const userData = await getUserData(token);
              
              // First, get the current file record from DynamoDB
              const getCommand = new GetCommand({
                TableName: TABLE_NAME,
                Key: {
                  userId: userData.userId,
                  fileId: fileId
                }
              });
              
              const fileRecord = await docClient.send(getCommand);
              if (!fileRecord.Item) {
                return createResponse(404, { error: 'File not found' });
              }
              
              const oldS3Key = fileRecord.Item.s3Key;
              const fileExtension = fileRecord.Item.fileExtension || '';
              const newFileName = data.name.endsWith(fileExtension) ? data.name : `${data.name}${fileExtension}`;
              const newS3Key = `${userData.userId}/${fileId}/${newFileName}`;
              
              // Copy S3 object to new key
              const copyCommand = new CopyObjectCommand({
                Bucket: BUCKET_NAME,
                CopySource: `${BUCKET_NAME}/${oldS3Key}`,
                Key: newS3Key
              });
              
              await s3Client.send(copyCommand);
              
              // Delete old S3 object
              const deleteCommand = new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: oldS3Key
              });
              
              await s3Client.send(deleteCommand);
              
              // Update file metadata in DynamoDB
              const updateCommand = new UpdateCommand({
                TableName: TABLE_NAME,
                Key: {
                  userId: userData.userId,
                  fileId: fileId
                },
                UpdateExpression: 'SET fileName = :fileName, s3Key = :s3Key',
                ExpressionAttributeValues: {
                  ':fileName': data.name,
                  ':s3Key': newS3Key
                }
              });
              
              await docClient.send(updateCommand);
              return createResponse(200, { message: 'File renamed successfully' });
            } catch (err) {
              console.error('Rename file error:', err);
              return createResponse(500, { error: 'Failed to rename file' });
            }
          }
          
          if (httpMethod === 'DELETE') {
            const authHeader = event.headers?.Authorization || event.headers?.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
              return createResponse(401, { error: 'Missing or invalid Authorization header' });
            }
        
            const token = authHeader.split(' ')[1];
        
            try {
              const userData = await getUserData(token);
              const result = await deleteFile(fileId, userData.userId);
              return createResponse(200, result);
            } catch (err) {
              console.error('Delete file error:', err);
              return createResponse(401, { error: 'Unauthorized' });
            }
          }
        }
        
        return createResponse(404, { error: 'Route not found' });
    }



    // Debug endpoint for testing user data
    if (path === '/debug/user' && httpMethod === 'GET') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return createResponse(401, { error: 'Missing or invalid Authorization header' });
      }
  
      const token = authHeader.split(' ')[1];
      console.log('🔍 Debug: Testing user data extraction...');
      
      try {
        const userData = await getUserData(token);
        return createResponse(200, {
          message: 'User data extracted successfully',
          userData,
          tokenLength: token.length,
          tokenPreview: token.substring(0, 50) + '...'
        });
      } catch (err) {
        console.error('Debug user data error:', err);
        return createResponse(500, { 
          error: 'Failed to extract user data',
          details: err.message
        });
      }
    }
    
    return createResponse(405, { error: 'Method not allowed' });

  } catch (error) {
    console.error('Lambda handler error:', error);
    return createResponse(500, { error: error.message });
  }
};

// Helper function to get user details from Cognito
async function getUserDetailsByUserId(userId) {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId
    });
    
    const result = await cognitoClient.send(command);
    
    // Extract username from attributes - try multiple possible attribute names
    const usernameAttr = result.UserAttributes?.find(attr => 
      attr.Name === 'name' || 
      attr.Name === 'nickname' || 
      attr.Name === 'preferred_username' ||
      attr.Name === 'given_name'
    );
    const emailAttr = result.UserAttributes?.find(attr => attr.Name === 'email');
    
    console.log('🔍 Cognito user attributes for', userId, ':', result.UserAttributes?.map(attr => `${attr.Name}: ${attr.Value}`));
    
    return {
      username: usernameAttr?.Value || emailAttr?.Value || userId,
      email: emailAttr?.Value || userId
    };
  } catch (error) {
    console.error('Failed to get user details for userId:', userId, error);
    return {
      username: userId,
      email: userId
    };
  }
}

