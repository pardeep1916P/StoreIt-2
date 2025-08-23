"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { forgotPassword, resetPassword, verifyResetOTP, resendOTP } from "@/lib/actions/user.actions";
import { toast } from "@/hooks/use-toast";
import { PasswordInput } from "@/components/PasswordInput";
import { OTPInput } from "@/components/OTPInput";

export const ForgotPasswordForm = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await forgotPassword({ email });
      
      if (result.success) {
        setStep("otp");
        toast({
          title: "Success",
          description: "Password reset code sent to your email",
        });
      } else {
        // Handle error result
        const errorTitle = result.title || "Error";
        const errorMessage = result.error || "Failed to send reset code";
        let title = errorTitle;
        let description = errorMessage;
        
        if (errorMessage.includes('Account not exists')) {
          title = "Account Not Found";
          description = "No account found with this email address.";
        } else if (errorMessage.includes('Email delivery failed')) {
          title = "Delivery Failed";
          description = "Failed to send email. Please try again later.";
        } else if (errorMessage.includes('Invalid email format')) {
          title = "Invalid Email";
          description = "Please enter a valid email address.";
        } else if (errorMessage.includes('Invalid credentials')) {
          title = "Invalid Credentials";
          description = "Please check your email address.";
        }
        
        toast({
          title,
          description,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Skip separate verification since Cognito will verify during password reset
      setStep("password");
      toast({
        title: "Success",
        description: "Please enter your new password.",
      });
    } catch (error) {
      // Handle specific error cases
      const errorMessage = error instanceof Error ? error.message : "Failed to verify code";
      let title = "Error";
      let description = errorMessage;
      
      if (errorMessage.includes('Invalid reset code format')) {
        title = "Invalid Code";
        description = "Please enter a 6-digit verification code.";
      } else if (errorMessage.includes('User not found')) {
        title = "Account Not Found";
        description = "No account found with this email address.";
      } else if (errorMessage.includes('Failed to verify user')) {
        title = "Verification Failed";
        description = "Unable to verify your account. Please try again.";
      } else if (errorMessage.includes('Invalid credentials')) {
        title = "Invalid Credentials";
        description = "Please check your verification code.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const result = await resetPassword({ email, resetCode: otp, newPassword });
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Password reset successfully!",
        });
        router.push("/sign-in");
      } else {
        // Handle error result
        const errorTitle = result.title || "Error";
        const errorMessage = result.error || "Failed to reset password";
        let title = errorTitle;
        let description = errorMessage;
        
        if (errorMessage.includes('Invalid reset code')) {
          title = "Invalid Code";
          description = "The reset code is incorrect. Please verify your code again.";
        } else if (errorMessage.includes('Reset code expired')) {
          title = "Code Expired";
          description = "The reset code has expired. Please request a new code.";
        } else if (errorMessage.includes('Password too weak')) {
          title = "Weak Password";
          description = "Please choose a stronger password with at least 6 characters.";
        } else if (errorMessage.includes('Account not exists')) {
          title = "Account Not Found";
          description = "No account found with this email address.";
        } else if (errorMessage.includes('Invalid credentials')) {
          title = "Invalid Credentials";
          description = "Please check your reset code and try again.";
        }
        
        toast({
          title,
          description,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      const result = await resendOTP({ email });
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Reset code resent to your email",
        });
      } else {
        // Handle error result
        const errorTitle = result.title || "Error";
        const errorMessage = result.error || "Failed to resend code";
        let title = errorTitle;
        let description = errorMessage;
        
        if (errorMessage.includes('User not found')) {
          title = "Account Not Found";
          description = "No account found with this email address.";
        } else if (errorMessage.includes('Email delivery failed')) {
          title = "Delivery Failed";
          description = "Failed to send email. Please try again later.";
        } else if (errorMessage.includes('Invalid email format')) {
          title = "Invalid Email";
          description = "Please enter a valid email address.";
        } else if (errorMessage.includes('Invalid credentials')) {
          title = "Invalid Credentials";
          description = "Please check your email address.";
        }
        
        toast({
          title,
          description,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resend code. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (step === "email") {
    return (
      <Card className="w-full max-w-md mx-auto shadow-lg border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-4 sm:pb-6">
          <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
            Reset Password
          </CardTitle>
          <CardDescription className="text-gray-600 text-sm sm:text-base">
            Enter your email to receive a password reset code
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8">
          <form onSubmit={handleSendResetCode} className="space-y-4 sm:space-y-6">
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 sm:h-12 px-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand focus:border-2 transition-all duration-300 bg-white hover:border-gray-300 shadow-sm focus:shadow-md"
                required
              />
            </div>

            <div className="flex justify-center">
              <Button
                type="submit"
                className="w-3/4 h-10 sm:h-12 bg-brand hover:bg-brand/90 text-white font-medium rounded-full transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Send Reset Code"}
              </Button>
            </div>
          </form>

          <div className="mt-4 sm:mt-6 text-center">
            <p className="text-gray-600 text-sm sm:text-base">
              Remember your password?{" "}
              <a href="/sign-in" className="text-brand hover:text-brand/80 font-medium transition-colors">
                Sign in
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "otp") {
    return (
      <Card className="w-full max-w-md mx-auto shadow-lg border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-4 sm:pb-6">
          <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
            Enter Reset Code
          </CardTitle>
          <CardDescription className="text-gray-600 text-sm sm:text-base">
            We've sent a reset code to {email}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8">
          <form onSubmit={handleVerifyOTP} className="space-y-4 sm:space-y-6">
            <OTPInput
              id="otp"
              label="Reset Code"
              value={otp}
              onChange={setOtp}
              required
            />

            <div className="flex justify-center">
              <Button
                type="submit"
                className="w-3/4 h-10 sm:h-12 bg-brand hover:bg-brand/90 text-white font-medium rounded-full transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? "Verifying..." : "Verify Code"}
              </Button>
            </div>
          </form>

          <div className="mt-4 sm:mt-6 text-center">
            <p className="text-sm text-gray-600 mb-2">
              Didn't receive the code?
            </p>
            <Button
              variant="outline"
              onClick={handleResendCode}
              className="text-sm h-8 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-full transition-all duration-200"
            >
              Resend Code
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-0 bg-white/95 backdrop-blur-sm">
      <CardHeader className="text-center pb-4 sm:pb-6">
        <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
          Set New Password
        </CardTitle>
        <CardDescription className="text-gray-600 text-sm sm:text-base">
          Enter your new password
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8">
        <form onSubmit={handleResetPassword} className="space-y-4 sm:space-y-6">
                     <PasswordInput
             id="newPassword"
             label="New Password"
             placeholder="Enter new password"
             value={newPassword}
             onChange={setNewPassword}
             showStrength={true}
             required
           />

           <PasswordInput
             id="confirmPassword"
             label="Confirm Password"
             placeholder="Confirm new password"
             value={confirmPassword}
             onChange={setConfirmPassword}
             confirmPassword={newPassword}
             required
           />

          <div className="flex justify-center">
            <Button
              type="submit"
              className="w-3/4 h-10 sm:h-12 bg-brand hover:bg-brand/90 text-white font-medium rounded-full transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || newPassword !== confirmPassword || newPassword.length < 6}
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}; 
