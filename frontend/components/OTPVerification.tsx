"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyOTP, resendOTP } from "@/lib/actions/user.actions";
import { toast } from "@/hooks/use-toast";
import { OTPInput } from "@/components/OTPInput";

interface OTPVerificationProps {
  email: string;
  userId: string;
  password: string;
}

export const OTPVerification = ({ email, userId, password }: OTPVerificationProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await verifyOTP({ email, otp, password });

      toast({
        title: "Success",
        description: "Email verified successfully!",
      });

      // Add a small delay to ensure cookie is set before redirect
      setTimeout(() => {
        router.push("/");
      }, 100);
    } catch (error) {
      // Handle specific error cases
      const errorMessage = error instanceof Error ? error.message : "Failed to verify OTP";
      let title = "Error";
      let description = errorMessage;
      
      if (errorMessage.includes('Invalid verification code')) {
        title = "Invalid Code";
        description = "The verification code you entered is incorrect. Please check your email and try again.";
      } else if (errorMessage.includes('Code expired')) {
        title = "Code Expired";
        description = "The verification code has expired. Please request a new code.";
      } else if (errorMessage.includes('User not found')) {
        title = "Account Not Found";
        description = "No account found with this email address.";
      } else if (errorMessage.includes('Invalid credentials')) {
        title = "Invalid Credentials";
        description = "Please check your email and password.";
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

  const handleResendOTP = async () => {
    setResendLoading(true);

    try {
      await resendOTP({ email });

      toast({
        title: "Success",
        description: "Verification code sent to your email",
      });
    } catch (error) {
      // Handle specific error cases
      const errorMessage = error instanceof Error ? error.message : "Failed to resend OTP";
      let title = "Error";
      let description = errorMessage;
      
      if (errorMessage.includes('User not found')) {
        title = "Account Not Found";
        description = "No account found with this email address.";
      } else if (errorMessage.includes('CodeDeliveryFailureException')) {
        title = "Delivery Failed";
        description = "Failed to send email. Please try again later.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-0 bg-white/95 backdrop-blur-sm">
      <CardHeader className="text-center pb-4 sm:pb-6">
        <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
          Verify Your Email
        </CardTitle>
        <CardDescription className="text-gray-600 text-sm sm:text-base">
          We've sent a verification code to {email}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8">
        <form onSubmit={handleVerifyOTP} className="space-y-4 sm:space-y-6">
          <OTPInput
            id="otp"
            label="Verification Code"
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
              {isLoading ? "Verifying..." : "Verify Email"}
            </Button>
          </div>
        </form>

        <div className="mt-4 sm:mt-6 text-center">
          <p className="text-sm text-gray-600 mb-2">
            Didn't receive the code?
          </p>
          <Button
            variant="outline"
            onClick={handleResendOTP}
            disabled={resendLoading}
            className="text-sm h-8 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-full transition-all duration-200"
          >
            {resendLoading ? "Sending..." : "Resend Code"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}; 
