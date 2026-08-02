import { useEffect, useState } from "react";

type HealthStatus = {
  status: string;
  timestamp: string;
  environment: string;
};

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-brand-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Customer Support Assistant
        </h1>
        <p className="text-gray-500 mb-6">
          E-Commerce &amp; Retail AI Chatbot
        </p>

        <div className="rounded-lg bg-gray-50 p-4 text-sm">
          {error && (
            <p className="text-red-600">
              Backend unreachable: {error}
              <br />
              <span className="text-gray-500">
                Start the backend with{" "}
                <code className="bg-gray-200 px-1 rounded">npm run dev</code> in{" "}
                <code className="bg-gray-200 px-1 rounded">backend/</code>
              </span>
            </p>
          )}
          {health && (
            <p className="text-green-700">
              Backend connected — {health.status} ({health.environment})
            </p>
          )}
          {!error && !health && (
            <p className="text-gray-400">Checking backend connection…</p>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Phase 1 scaffolding complete. Chat UI coming in Phase 4.
        </p>
      </div>
    </div>
  );
}
