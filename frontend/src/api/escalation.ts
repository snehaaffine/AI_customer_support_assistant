export async function submitEscalation(
  sessionId: string,
  data: {
    customerEmail: string;
    message: string;
    images: File[];
  }
): Promise<void> {
  const form = new FormData();
  form.append("customerEmail", data.customerEmail);
  form.append("message", data.message);
  for (const file of data.images) {
    form.append("images", file);
  }

  const res = await fetch(`/api/sessions/${sessionId}/escalate`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.error === "string") message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
}
