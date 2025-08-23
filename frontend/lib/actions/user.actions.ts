"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Export functions for use in other modules
export { getAuthToken, refreshAccessToken, setTokens };

// Set to true for local development, false for production with AWS
const isDevelopmentMode = false;

const getAuthToken = async () => {
  const cookieStore = await cookies();
  const session = cookieStore.get('aws-session');
  return session?.value;
};

const getRefreshToken = async () => {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('aws-refresh-token');
  return refreshToken?.value;
};

const setTokens = async (accessToken: string, refreshToken?: string) => {
  const cookieStore = await cookies();
  
  // Set access token
  cookieStore.set('aws-session', accessToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  });
  
  // Set refresh token if provided
  if (refreshToken) {
    cookieStore.set('aws-refresh-token', refreshToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });
  }
};

const refreshAccessToken = async () => {
  try {
    if (isDevelopmentMode) {
      // Development mode - return mock token
      return 'mock-refreshed-jwt-token';
    }

    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const result = await response.json();
    
    // Update tokens in cookies
    await setTokens(result.token || result.accessToken, refreshToken);
    
    return result.token || result.accessToken;
  } catch (error) {
    throw error;
  }
};

const smartHttpClient = async (url: string, options: RequestInit, retryCount = 0): Promise<Response> => {
  try {
    // Add authorization header if token exists
    const token = await getAuthToken();
    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      };
    }

    const response = await fetch(url, options);
    
    // If unauthorized and we haven't retried yet, try to refresh token
    if (response.status === 401 && retryCount === 0) {
      try {
        const newToken = await refreshAccessToken();
        
        // Retry the request with new token
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
        };
        
        return await smartHttpClient(url, options, retryCount + 1);
      } catch (refreshError) {
        // Clear tokens and redirect to signin
        const cookieStore = await cookies();
        cookieStore.delete('aws-session');
        cookieStore.delete('aws-refresh-token');
        
        // For client-side usage, throw error to handle redirect
        throw new Error('Authentication expired');
      }
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};

const handleError = (error: unknown, message: string) => {
  // If it's already a custom error with title, preserve it
  if (error instanceof Error && (error as any).title) {
    throw error;
  }
  // Otherwise, create a new error with the fallback message
  const fallbackError = new Error(message);
  (fallbackError as any).title = "Error";
  throw fallbackError;
};

export const signUp = async ({
  email,
  password,
  username,
}: {
  email: string;
  password: string;
  username: string;
}) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - mock signup with OTP flow
      const mockUser = {
        id: `dev-user-${Date.now()}`,
        email,
        username,
        token: 'mock-jwt-token',
      };
      
      // In development mode, simulate OTP verification flow
      return {
        userId: mockUser.id,
        email: email,
        message: 'Account created successfully. Please check your email for verification code.'
      };
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, username }),
    });

    // Always try to parse the response, regardless of status code
    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      // If we can't parse the response, treat it as a generic error
      const genericError = new Error('Failed to sign up');
      (genericError as any).title = 'Error';
      throw genericError;
    }

    // Check if the response contains an error message (regardless of status code)
    if (!response.ok || responseData.error) {
      const error = responseData;
      
      // Provide specific error messages for sign-up
      let errorMessage = 'Failed to sign up';
      let errorTitle = 'Error';
      
      if (error.error) {
        if (error.error.includes('UsernameExistsException') || error.error.includes('User already exists')) {
          errorMessage = 'User already exists';
          errorTitle = 'Error';
        } else if (error.error.includes('InvalidPasswordException')) {
          errorMessage = 'Password too weak';
          errorTitle = 'Error';
        } else if (error.error.includes('InvalidParameterException')) {
          errorMessage = 'Invalid email format';
          errorTitle = 'Error';
        } else if (error.error.includes('CodeDeliveryFailureException')) {
          errorMessage = 'Email delivery failed';
          errorTitle = 'Error';
        } else if (error.error.includes('Invalid credentials') || error.error.includes('Invalid email or password') || error.error.includes('NotAuthorizedException')) {
          errorMessage = 'Invalid credentials';
          errorTitle = 'Error';
        } else {
          errorMessage = error.error;
          errorTitle = 'Error';
        }
      }
      
      // Return error result instead of throwing
      return {
        success: false,
        error: errorMessage,
        title: errorTitle
      };
    }

    // If we get here, the response was successful
    return {
      success: true,
      ...responseData
    };
  } catch (error) {
    // Return error result instead of throwing
    let errorMessage = "Failed to sign up";
    let errorTitle = "Error";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      if ((error as any).title) {
        errorTitle = (error as any).title;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      title: errorTitle
    };
  }
};

export const verifyOTP = async ({
  email,
  otp,
  password,
}: {
  email: string;
  otp: string;
  password?: string;
}) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - mock OTP verification (accept any code or '123456')
      if (otp === '123456' || otp.length === 6) {
        const mockUser = {
          id: `dev-user-${Date.now()}`,
          email,
          username: 'John Doe',
          token: 'mock-jwt-token',
        };
        
        // Set cookie
        const cookieStore = await cookies();
        cookieStore.set('aws-session', mockUser.token, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60, // 24 hours
          path: '/',
        });
        
        return mockUser;
      } else {
        throw new Error('Invalid verification code');
      }
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp, type: 'signup', password }),
    });

    // Always try to parse the response, regardless of status code
    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      // If we can't parse the response, treat it as a generic error
      const genericError = new Error('Failed to verify OTP');
      (genericError as any).title = 'Error';
      throw genericError;
    }

    // Check if the response contains an error message (regardless of status code)
    if (!response.ok || responseData.error) {
      const error = responseData;
      
      // Provide specific error messages for OTP verification
      let errorMessage = 'Failed to verify OTP';
      let errorTitle = 'Error';
      
      if (error.error) {
        if (error.error.includes('CodeMismatchException') || error.error.includes('Invalid code')) {
          errorMessage = 'Invalid verification code';
          errorTitle = 'Error';
        } else if (error.error.includes('ExpiredCodeException')) {
          errorMessage = 'Code expired';
          errorTitle = 'Error';
        } else if (error.error.includes('UserNotFoundException')) {
          errorMessage = 'User not found';
          errorTitle = 'Error';
        } else if (error.error.includes('Invalid credentials') || error.error.includes('Invalid email or password')) {
          errorMessage = 'Invalid credentials';
          errorTitle = 'Error';
        } else {
          errorMessage = error.error;
          errorTitle = 'Error';
        }
      }
      
      // Create a custom error with title and message
      const customError = new Error(errorMessage);
      (customError as any).title = errorTitle;
      throw customError;
    }

    // If we get here, the response was successful
    const result = responseData;
    
    // If verification successful and tokens are returned, set the cookie
    if (result.token || result.idToken) {
      const cookieStore = await cookies();
      const token = result.token || result.idToken;
      cookieStore.set('aws-session', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60, // 24 hours
        path: '/',
      });
    }

    return result;
  } catch (error) {
    // If it's already a custom error with title, preserve it
    if (error instanceof Error && (error as any).title) {
      throw error;
    }
    // Otherwise, create a new error with the fallback message
    const fallbackError = new Error("Failed to verify OTP");
    (fallbackError as any).title = "Error";
    throw fallbackError;
  }
};

export const resendOTP = async ({
  email,
}: {
  email: string;
}) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - mock resend OTP
      return { message: 'Verification code sent to your email' };
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/resend-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    // Always try to parse the response, regardless of status code
    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      // If we can't parse the response, treat it as a generic error
      const genericError = new Error('Failed to resend OTP');
      (genericError as any).title = 'Error';
      throw genericError;
    }

    // Check if the response contains an error message (regardless of status code)
    if (!response.ok || responseData.error) {
      const error = responseData;
      
      // Provide specific error messages for resend OTP
      let errorMessage = 'Failed to resend OTP';
      let errorTitle = 'Error';
      
      if (error.error) {
        if (error.error.includes('UserNotFoundException') || error.error.includes('User not found')) {
          errorMessage = 'User not found';
          errorTitle = 'Error';
        } else if (error.error.includes('CodeDeliveryFailureException')) {
          errorMessage = 'Email delivery failed';
          errorTitle = 'Error';
        } else if (error.error.includes('InvalidParameterException')) {
          errorMessage = 'Invalid email format';
          errorTitle = 'Error';
        } else if (error.error.includes('LimitExceededException')) {
          errorMessage = 'Too many attempts. Please try again later.';
          errorTitle = 'Error';
        } else if (error.error.includes('Invalid credentials') || error.error.includes('Invalid email or password')) {
          errorMessage = 'Invalid credentials';
          errorTitle = 'Error';
        } else {
          errorMessage = error.error;
          errorTitle = 'Error';
        }
      }
      
      // Create a custom error with title and message
      const customError = new Error(errorMessage);
      (customError as any).title = errorTitle;
      throw customError;
    }

    // If we get here, the response was successful
    return responseData;
  } catch (error) {
    // If it's already a custom error with title, preserve it
    if (error instanceof Error && (error as any).title) {
      throw error;
    }
    // Otherwise, create a new error with the fallback message
    const fallbackError = new Error("Failed to resend OTP");
    (fallbackError as any).title = "Error";
    throw fallbackError;
  }
};

export const signIn = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - mock signin
      const mockUser = {
        id: `dev-user-${Date.now()}`,
        email,
        username: 'John Doe',
        idToken: 'mock-jwt-token',
      };
      
      // Set cookie
      const cookieStore = await cookies();
      cookieStore.set('aws-session', mockUser.idToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60, // 24 hours
        path: '/',
      });
      
      return mockUser;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    // Always try to parse the response, regardless of status code
    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      // If we can't parse the response, treat it as a generic error
      const genericError = new Error('Failed to sign in');
      (genericError as any).title = 'Error';
      throw genericError;
    }

    // Check if the response contains an error message (regardless of status code)
    if (!response.ok || responseData.error) {
      const error = responseData;
      
      // Provide more specific error messages based on Cognito exceptions
      let errorMessage = 'Failed to sign in';
      let errorTitle = 'Sign In Error';
      
      if (error.error) {
        if (error.error.includes('Invalid email or password') || error.error.includes('Incorrect username or password') || error.error.includes('Invalid credentials') || error.error.includes('NotAuthorizedException')) {
          errorMessage = 'Invalid credentials';
          errorTitle = 'Error';
        } else if (error.error.includes('User not found') || error.error.includes('No account found') || error.error.includes('UserNotFoundException')) {
          errorMessage = 'Account not exists';
          errorTitle = 'Error';
        } else if (error.error.includes('verify your email') || error.error.includes('not confirmed') || error.error.includes('UserNotConfirmedException')) {
          errorMessage = 'Email not verified';
          errorTitle = 'Error';
        } else if (error.error.includes('Too many failed attempts') || error.error.includes('TooManyRequestsException')) {
          errorMessage = 'Too many attempts';
          errorTitle = 'Error';
        } else if (error.error.includes('Password reset required') || error.error.includes('PasswordResetRequiredException')) {
          errorMessage = 'Password reset required';
          errorTitle = 'Error';
        } else {
          errorMessage = error.error;
          errorTitle = 'Error';
        }
      }
      
      // Return error result instead of throwing
      return {
        success: false,
        error: errorMessage,
        title: errorTitle
      };
    }

    // If we get here, the response was successful
    const result = responseData;
    
    // Set both access token and refresh token in cookies
    await setTokens(result.idToken || result.token, result.refreshToken);
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    // Return error result instead of throwing
    let errorMessage = "Failed to sign in";
    let errorTitle = "Error";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      if ((error as any).title) {
        errorTitle = (error as any).title;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      title: errorTitle
    };
  }
};

export const forgotPassword = async ({
  email,
}: {
  email: string;
}) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - mock forgot password
      return { message: 'Password reset code sent to your email' };
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    // Always try to parse the response, regardless of status code
    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      // If we can't parse the response, treat it as a generic error
      const genericError = new Error('Failed to send reset code');
      (genericError as any).title = 'Error';
      throw genericError;
    }

    // Check if the response contains an error message (regardless of status code)
    if (!response.ok || responseData.error) {
      const error = responseData;
      
      // Provide specific error messages for forgot password
      let errorMessage = 'Failed to send reset code';
      let errorTitle = 'Error';
      
      if (error.error) {
        if (error.error.includes('UserNotFoundException') || error.error.includes('User not found')) {
          errorMessage = 'Account not exists';
          errorTitle = 'Error';
        } else if (error.error.includes('CodeDeliveryFailureException')) {
          errorMessage = 'Email delivery failed';
          errorTitle = 'Error';
        } else if (error.error.includes('InvalidParameterException')) {
          errorMessage = 'Invalid email format';
          errorTitle = 'Error';
        } else if (error.error.includes('LimitExceededException')) {
          errorMessage = 'Too many attempts. Please try again later.';
          errorTitle = 'Error';
        } else if (error.error.includes('Invalid credentials') || error.error.includes('Invalid email or password')) {
          errorMessage = 'Invalid credentials';
          errorTitle = 'Error';
        } else {
          errorMessage = error.error;
          errorTitle = 'Error';
        }
      }
      
      // Return error result instead of throwing
      return {
        success: false,
        error: errorMessage,
        title: errorTitle
      };
    }

    // If we get here, the response was successful
    return {
      success: true,
      ...responseData
    };
  } catch (error) {
    // Return error result instead of throwing
    let errorMessage = "Failed to send reset code";
    let errorTitle = "Error";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      if ((error as any).title) {
        errorTitle = (error as any).title;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      title: errorTitle
    };
  }
};

export const resetPassword = async ({
  email,
  resetCode,
  newPassword,
}: {
  email: string;
  resetCode: string;
  newPassword: string;
}) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - mock password reset
      return { message: 'Password reset successfully' };
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, resetCode, newPassword }),
    });

    // Always try to parse the response, regardless of status code
    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      // If we can't parse the response, treat it as a generic error
      const genericError = new Error('Failed to reset password');
      (genericError as any).title = 'Error';
      throw genericError;
    }

    // Check if the response contains an error message (regardless of status code)
    if (!response.ok || responseData.error) {
      const error = responseData;
      
      // Provide specific error messages for password reset
      let errorMessage = 'Failed to reset password';
      let errorTitle = 'Error';
      
      if (error.error) {
        if (error.error.includes('CodeMismatchException') || error.error.includes('Invalid code') || error.error.includes('Invalid reset code')) {
          errorMessage = 'Invalid reset code';
          errorTitle = 'Error';
        } else if (error.error.includes('ExpiredCodeException') || error.error.includes('Reset code expired')) {
          errorMessage = 'Reset code expired';
          errorTitle = 'Error';
        } else if (error.error.includes('InvalidPasswordException') || error.error.includes('Password too weak')) {
          errorMessage = 'Password too weak';
          errorTitle = 'Error';
        } else if (error.error.includes('UserNotFoundException') || error.error.includes('User not found')) {
          errorMessage = 'Account not exists';
          errorTitle = 'Error';
        } else if (error.error.includes('LimitExceededException')) {
          errorMessage = 'Too many attempts. Please try again later.';
          errorTitle = 'Error';
        } else if (error.error.includes('Invalid credentials') || error.error.includes('Invalid email or password')) {
          errorMessage = 'Invalid credentials';
          errorTitle = 'Error';
        } else {
          errorMessage = error.error;
          errorTitle = 'Error';
        }
      }
      
      // Create a custom error with title and message
      const customError = new Error(errorMessage);
      (customError as any).title = errorTitle;
      throw customError;
    }

    // If we get here, the response was successful
    return responseData;
  } catch (error) {
    // If it's already a custom error with title, preserve it
    if (error instanceof Error && (error as any).title) {
      throw error;
    }
    // Otherwise, create a new error with the fallback message
    const fallbackError = new Error("Failed to reset password");
    (fallbackError as any).title = "Error";
    throw fallbackError;
  }
};

export const signOut = async () => {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('aws-session');
    cookieStore.delete('aws-refresh-token');
    return { success: true, redirect: '/sign-in' };
  } catch (error) {
    return { success: false, error: "Failed to sign out" };
  }
};

export const getCurrentUser = async () => {
  try {
    if (isDevelopmentMode) {
      // Development mode - return mock user
      return {
        id: 'dev-user-1',
        email: 'john.doe@example.com',
        username: 'John Doe',
      };
    }

    const token = await getAuthToken();
    if (!token) {
      return null;
    }

    try {
      const response = await smartHttpClient(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/me`, {
        method: 'GET',
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
    
      // Validate that we have real user data, not example data
      if (result && result.email && result.email !== 'user@example.com') {
        // If username is missing or is 'User', try to get it from the result
        if (!result.username || result.username === 'User') {
          result.username = result.email.split('@')[0]; // Use email prefix as username
        }
        return result;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  } catch (error) {
    return null;
  }
};

export const verifyResetOTP = async ({
  email,
  resetCode,
}: {
  email: string;
  resetCode: string;
}) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - mock OTP verification for password reset
      return { message: 'Reset code verified successfully' };
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/verify-reset-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, resetCode }),
    });

    // Always try to parse the response, regardless of status code
    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      // If we can't parse the response, treat it as a generic error
      const genericError = new Error('Failed to verify reset code');
      (genericError as any).title = 'Error';
      throw genericError;
    }

    // Check if the response contains an error message (regardless of status code)
    if (!response.ok || responseData.error) {
      const error = responseData;
      
      // Provide specific error messages for reset OTP verification
      let errorMessage = 'Failed to verify reset code';
      let errorTitle = 'Error';
      
      if (error.error) {
        if (error.error.includes('Invalid reset code format')) {
          errorMessage = 'Invalid reset code format';
          errorTitle = 'Error';
        } else if (error.error.includes('User not found')) {
          errorMessage = 'User not found';
          errorTitle = 'Error';
        } else if (error.error.includes('Failed to verify user')) {
          errorMessage = 'Failed to verify user';
          errorTitle = 'Error';
        } else if (error.error.includes('Reset code not found') || error.error.includes('Reset code expired')) {
          errorMessage = error.error;
          errorTitle = 'Error';
        } else if (error.error.includes('Invalid reset code')) {
          errorMessage = 'Invalid reset code';
          errorTitle = 'Error';
        } else if (error.error.includes('Invalid credentials') || error.error.includes('Invalid email or password')) {
          errorMessage = 'Invalid credentials';
          errorTitle = 'Error';
        } else {
          errorMessage = error.error;
          errorTitle = 'Error';
        }
      }
      
      // Create a custom error with title and message
      const customError = new Error(errorMessage);
      (customError as any).title = errorTitle;
      throw customError;
    }

    // If we get here, the response was successful
    return responseData;
  } catch (error) {
    // If it's already a custom error with title, preserve it
    if (error instanceof Error && (error as any).title) {
      throw error;
    }
    // Otherwise, create a new error with the fallback message
    const fallbackError = new Error("Failed to verify reset code");
    (fallbackError as any).title = "Error";
    throw fallbackError;
  }
};
