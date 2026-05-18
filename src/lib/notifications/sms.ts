import { sendSms as sendTwilioSms } from "@/lib/notifications/twilio";

type SmsResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  providerMessageId?: string;
  error?: string;
};

type SendSmsInput = {
  to: string;
  message: string;
};

export async function sendSms(input: SendSmsInput): Promise<SmsResult> {
  return sendTwilioSms({
    to: input.to,
    body: input.message,
  });
}
