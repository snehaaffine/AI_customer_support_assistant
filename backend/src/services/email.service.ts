import fs from "fs";
import path from "path";
import { Resend } from "resend";
import { MessageRole } from "@prisma/client";
import { assertResendKey, env } from "../config/env.js";
import { uploadDir } from "../lib/upload.js";

let client: Resend | null = null;

function getResend(): Resend {
  assertResendKey();
  if (!client) {
    client = new Resend(env.resendApiKey);
  }
  return client;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface TranscriptMessage {
  role: MessageRole;
  content: string;
  createdAt: Date;
}

function formatTranscript(messages: TranscriptMessage[]): string {
  return messages
    .map((m) => {
      const who =
        m.role === MessageRole.USER
          ? "Customer"
          : m.role === MessageRole.ASSISTANT
            ? "Assistant"
            : "System";
      const time = m.createdAt.toLocaleString();
      return `[${time}] ${who}:\n${m.content}`;
    })
    .join("\n\n");
}

export async function sendEscalationEmails(params: {
  sessionId: string;
  customerEmail: string;
  customerMessage: string;
  imageFilenames: string[];
  transcript: TranscriptMessage[];
  categoryLabel?: string;
}): Promise<void> {
  if (!env.resendApiKey) {
    if (env.isDev) {
      console.warn(
        "RESEND_API_KEY not set — skipping escalation emails (dev mode)"
      );
      return;
    }
    assertResendKey();
  }

  const resend = getResend();
  const transcriptText = formatTranscript(params.transcript);

  const attachments = params.imageFilenames.map((filename) => ({
    filename,
    content: fs.readFileSync(path.join(uploadDir, filename)),
  }));

  const supportHtml = `
    <h2>Customer support escalation</h2>
    <p><strong>Session ID:</strong> ${escapeHtml(params.sessionId)}</p>
    ${
      params.categoryLabel
        ? `<p><strong>Category:</strong> ${escapeHtml(params.categoryLabel)}</p>`
        : ""
    }
    <p><strong>Customer email:</strong> ${escapeHtml(params.customerEmail)}</p>
    <h3>Additional message from customer</h3>
    <p>${escapeHtml(params.customerMessage).replace(/\n/g, "<br>")}</p>
    <h3>Conversation transcript</h3>
    <pre style="white-space:pre-wrap;font-family:monospace;font-size:13px;">${escapeHtml(transcriptText)}</pre>
  `;

  await resend.emails.send({
    from: env.fromEmail,
    to: env.supportInboxEmail,
    subject: `Support escalation — ${params.customerEmail}`,
    html: supportHtml,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  await resend.emails.send({
    from: env.fromEmail,
    to: params.customerEmail,
    subject: "We received your support request",
    html: `
      <p>Thank you for reaching out. We've received your support request and a member of our team will follow up with you at
      <strong>${escapeHtml(params.customerEmail)}</strong> within 1–2 business days.</p>
      <p>You don't need to do anything else — we'll be in touch soon.</p>
    `,
  });
}
