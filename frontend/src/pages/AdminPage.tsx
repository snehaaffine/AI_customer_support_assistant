import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
} from "../api/client.js";
import {
  clearAdminToken,
  fetchAdminConfig,
  fetchEscalationRules,
  fetchRecentEscalations,
  getAdminToken,
  loginAdmin,
  setAdminToken,
  updateAdminConfig,
  updateEscalationRule,
  type EscalationRecord,
  type EscalationRule,
} from "../api/admin.js";

type Tab = "prompt" | "rules" | "escalations";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(getAdminToken);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<Tab>("prompt");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptVersion, setPromptVersion] = useState(0);
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [escalations, setEscalations] = useState<EscalationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [config, rulesRes, escRes] = await Promise.all([
        fetchAdminConfig(),
        fetchEscalationRules(),
        fetchRecentEscalations(),
      ]);
      setSystemPrompt(config.systemPrompt);
      setPromptVersion(config.promptVersion);
      setRules(rulesRes.rules);
      setEscalations(escRes.escalations);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAdminToken();
        setToken(null);
      }
      setLoadError(
        err instanceof Error ? err.message : "Failed to load admin data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) loadDashboard();
  }, [token, loadDashboard]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const result = await loginAdmin(username, password);
      setAdminToken(result.token);
      setToken(result.token);
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : "Login failed"
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSavePrompt = async () => {
    setSaveMessage(null);
    try {
      const config = await updateAdminConfig(systemPrompt);
      setPromptVersion(config.promptVersion);
      setSaveMessage("System prompt saved. Response cache cleared.");
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : "Failed to save"
      );
    }
  };

  const toggleRule = async (rule: EscalationRule) => {
    const { rule: updated } = await updateEscalationRule(rule.id, {
      enabled: !rule.enabled,
    });
    setRules((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
  };

  const logout = () => {
    clearAdminToken();
    setToken(null);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-200 p-6 space-y-4"
        >
          <h1 className="text-xl font-semibold text-gray-900">Admin Login</h1>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              autoComplete="current-password"
              required
            />
          </div>
          {loginError && (
            <p className="text-xs text-red-600">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full rounded-xl bg-brand-600 text-white py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loggingIn ? "Signing in…" : "Sign in"}
          </button>
          <a href="/" className="block text-center text-xs text-brand-600 hover:underline">
            ← Back to store
          </a>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Support Assistant Admin
          </h1>
          <p className="text-xs text-gray-500">
            Prompt version {promptVersion}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-brand-600 hover:underline">
            View store
          </a>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <nav className="flex gap-2 mb-6">
          {(
            [
              ["prompt", "System Prompt"],
              ["rules", "Escalation Rules"],
              ["escalations", "Recent Escalations"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-brand-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {loading && (
          <p className="text-sm text-gray-500">Loading…</p>
        )}
        {loadError && (
          <p className="text-sm text-red-600 mb-4">{loadError}</p>
        )}

        {!loading && tab === "prompt" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <p className="text-sm text-gray-500">
              Saving updates the prompt version and clears the semantic response cache.
            </p>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={16}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-mono leading-relaxed"
            />
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleSavePrompt}
                className="rounded-xl bg-brand-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-brand-700"
              >
                Save prompt
              </button>
              {saveMessage && (
                <p className="text-sm text-gray-600">{saveMessage}</p>
              )}
            </div>
          </div>
        )}

        {!loading && tab === "rules" && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">
                    Rule
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">
                    Priority
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">
                    Enabled
                  </th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-gray-100">
                    <td className="px-4 py-3">{rule.name}</td>
                    <td className="px-4 py-3 text-gray-500">{rule.type}</td>
                    <td className="px-4 py-3">{rule.priority}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleRule(rule)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          rule.enabled
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {rule.enabled ? "On" : "Off"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === "escalations" && (
          <div className="space-y-3">
            {escalations.length === 0 ? (
              <p className="text-sm text-gray-500">No escalations yet.</p>
            ) : (
              escalations.map((e) => (
                <div
                  key={e.id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{e.customerEmail}</span>
                    <span>{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-800">{e.message}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Session: {e.sessionId}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
