"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";

interface QuizAttemptStatus {
  canAttempt: boolean;
  reason: string;
  attemptsUsed: number;
  attemptsRemaining: number;
  nextAttemptAt?: string;
}

interface QuizRetryLimitProps {
  status: QuizAttemptStatus;
  maxAttempts?: number;
  retryDelayMinutes?: number;
}

export function QuizRetryLimit({ status, maxAttempts, retryDelayMinutes }: QuizRetryLimitProps) {
  if (status.canAttempt) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <div className="space-y-1">
            <p className="font-semibold">Ready to attempt</p>
            {maxAttempts && (
              <p className="text-sm">
                Attempts: {status.attemptsUsed} / {maxAttempts} used
                {status.attemptsRemaining > 0 && (
                  <span className="ml-2 text-green-600 font-semibold">
                    ({status.attemptsRemaining} remaining)
                  </span>
                )}
              </p>
            )}
            {!maxAttempts && (
              <p className="text-sm">
                Unlimited attempts • {status.attemptsUsed} attempts used
              </p>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Cannot attempt - check reason
  if (status.reason === "Maximum attempts reached") {
    return (
      <Alert className="border-red-200 bg-red-50">
        <XCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <div className="space-y-1">
            <p className="font-semibold">Maximum attempts reached</p>
            <p className="text-sm">
              You've used all {maxAttempts} attempts for this quiz.
            </p>
            <p className="text-sm">Contact your mentor for more information.</p>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (status.reason === "Please wait before retrying") {
    const nextAttempt = status.nextAttemptAt ? new Date(status.nextAttemptAt) : null;
    const now = new Date();
    const minutesLeft = nextAttempt
      ? Math.ceil((nextAttempt.getTime() - now.getTime()) / 60000)
      : 0;

    return (
      <Alert className="border-orange-200 bg-orange-50">
        <Clock className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <div className="space-y-1">
            <p className="font-semibold">Please wait before retrying</p>
            <p className="text-sm">
              You need to wait {retryDelayMinutes} minutes between attempts.
            </p>
            {nextAttempt && (
              <p className="text-sm font-semibold">
                Next attempt available in: {minutesLeft} minute{minutesLeft !== 1 ? "s" : ""}
              </p>
            )}
            {maxAttempts && (
              <p className="text-sm mt-2">
                Attempts: {status.attemptsUsed} / {maxAttempts} used
              </p>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-gray-200 bg-gray-50">
      <AlertCircle className="h-4 w-4 text-gray-600" />
      <AlertDescription className="text-gray-800">
        <p>{status.reason}</p>
      </AlertDescription>
    </Alert>
  );
}

interface QuizAttemptInfoProps {
  attemptsUsed: number;
  maxAttempts?: number;
  bestScore?: number;
  lastAttemptAt?: string;
}

export function QuizAttemptInfo({
  attemptsUsed,
  maxAttempts,
  bestScore,
  lastAttemptAt,
}: QuizAttemptInfoProps) {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <div>
        <span className="text-muted-foreground">Attempts: </span>
        <span className="font-semibold">
          {attemptsUsed}
          {maxAttempts ? ` / ${maxAttempts}` : " (unlimited)"}
        </span>
      </div>
      {bestScore !== undefined && (
        <div>
          <span className="text-muted-foreground">Best Score: </span>
          <span className="font-semibold">{bestScore}%</span>
        </div>
      )}
      {lastAttemptAt && (
        <div>
          <span className="text-muted-foreground">Last Attempt: </span>
          <span className="font-semibold">
            {new Date(lastAttemptAt).toLocaleDateString("id-ID")}
          </span>
        </div>
      )}
    </div>
  );
}
