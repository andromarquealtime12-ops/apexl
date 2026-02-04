import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useSendVerificationCode, useVerifyEmailCode } from "@/hooks/useEmailVerification";
import { useAuth } from "@/contexts/AuthContext";

export function EmailVerificationCard() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const sendCode = useSendVerificationCode();
  const verifyCode = useVerifyEmailCode();
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement...
          </div>
        </CardContent>
      </Card>
    );
  }

  const isVerified = profile?.email_verified;

  const handleSendCode = async () => {
    await sendCode.mutateAsync();
    setShowOtpInput(true);
  };

  const handleVerify = async () => {
    if (otp.length === 6) {
      const success = await verifyCode.mutateAsync(otp);
      if (success) {
        setShowOtpInput(false);
        setOtp("");
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Vérification Email
        </CardTitle>
        <CardDescription>
          Vérifiez votre email pour sécuriser votre compte
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isVerified ? (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">Email vérifié</p>
              <p className="text-sm text-green-600 dark:text-green-500">{user?.email}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-green-600 border-green-600">
              Vérifié
            </Badge>
          </div>
        ) : showOtpInput ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Un code à 6 chiffres a été envoyé à <strong>{user?.email}</strong>
              </p>
            </div>

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => setOtp(value)}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowOtpInput(false)}
              >
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={handleVerify}
                disabled={otp.length !== 6 || verifyCode.isPending}
              >
                {verifyCode.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Vérifier
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={handleSendCode}
              disabled={sendCode.isPending}
            >
              Renvoyer le code
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Email non vérifié</p>
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  Vérifiez votre email pour passer des commandes
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleSendCode}
              disabled={sendCode.isPending}
            >
              {sendCode.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Envoyer le code de vérification
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
