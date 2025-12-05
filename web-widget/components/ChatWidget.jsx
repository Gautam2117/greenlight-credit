// widget/components/ChatWidget.jsx
import { useEffect, useMemo, useState } from "react";

const API_DEFAULT =
  process.env.NEXT_PUBLIC_API || "http://localhost:8000/api/chat";

const ORCH_ORIGIN = (() => {
  try {
    return new URL(API_DEFAULT).origin;
  } catch {
    return "http://localhost:8000";
  }
})();

const toPublicUrl = (u) => {
  if (!u) return null;
  if (/^https?:\/\//.test(u)) return u;
  // convert filesystem path to served path
  const served = u.replace("/app/data/", "/files/");
  return `${ORCH_ORIGIN}${served.startsWith("/") ? served : `/${served}`}`;
};

const inr = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(+v || 0);

const emiCalc = (p, apr = 0.18, n = 12) => {
  const r = apr / 12;
  if (!p || !n) return { emi: 0, total: 0, interest: 0 };
  const f = Math.pow(1 + r, n);
  const emi = (p * r * f) / (f - 1);
  const total = emi * n;
  return { emi, total, interest: total - p };
};

export default function ChatWidget({ api = API_DEFAULT }) {
  const sid = useMemo(() => Math.random().toString(36).slice(2, 10), []);
  const [msg, setMsg] = useState(
    "Got consent. Share name, mobile, PAN last 4."
  );
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(true);
  const [errors, setErrors] = useState({});
  const [docs, setDocs] = useState({ pdf: null, kfs: null });

  const [form, setForm] = useState({
    name: "",
    mobile: "",
    pan_tail: "",
    desired_amount: 410000,
    tenure: 36,
    salary: "100000",
  });

  // fire the "start" event with consent once
  useEffect(() => {
    (async () => {
      try {
        const fd = new FormData();
        fd.append("session_id", sid);
        fd.append("message", "start");
        fd.append("consent", "yes");
        await fetch(api, { method: "POST", body: fd });
      } catch (e) {
        console.error("start failed", e);
      }
    })();
  }, [api, sid]);

  // helpers
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setMobile = (v) => set("mobile", v.replace(/[^\d]/g, "").slice(0, 10));
  const setPan = (v) => set("pan_tail", v.replace(/[^\d]/g, "").slice(0, 4));
  const setAmt = (v) =>
    set("desired_amount", Math.max(10000, Math.min(2000000, +v || 0)));
  const setTenure = (v) => set("tenure", Math.max(6, Math.min(84, +v || 0)));
  const setSalary = (v) => {
    const digits = String(v).replace(/[^\d]/g, "");
    set("salary", digits); // no clamp here
  };

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const salaryNum = clamp(parseInt(form.salary || "0", 10) || 0, 10000, 500000);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Enter full name as per PAN";
    if (form.mobile.length !== 10) e.mobile = "Enter 10-digit mobile";
    if (form.pan_tail.length !== 4) e.pan_tail = "Enter last 4 of PAN";
    if (!form.desired_amount || form.desired_amount < 10000)
      e.desired_amount = "Min ₹10k";
    if (!form.tenure || form.tenure < 6) e.tenure = "Min 6 months";
    if (!salaryNum || salaryNum < 10000) e.salary = "Add monthly salary";
    if (!consent) e.consent = "Consent required to proceed";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      setMsg("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    setMsg("Submitting…");
    setDocs({ pdf: null, kfs: null });

    const body = new FormData();
    body.append("session_id", sid);
    body.append("message", "submit");
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    body.set("pan_last4", form.pan_tail);

    try {
      const res = await fetch(api, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      console.log("submit response:", data);

      if (data.reply) setMsg(data.reply);
      else setMsg("Processed. Waiting for offer…");

      setDocs((prev) => {
        const next = { ...prev };
        if (data.pdf) next.pdf = toPublicUrl(data.pdf);
        if (data.kfs) {
          next.kfs =
            typeof data.kfs === "string" ? toPublicUrl(data.kfs) : data.kfs;
        }
        return next;
      });

      if (data.handoff) {
        setMsg((m) => `${m} • Agent will call you shortly.`);
      }
    } catch (err) {
      console.error("submit failed:", err);
      setMsg("Network error. Check server logs.");
    } finally {
      setLoading(false);
    }
  };

  const { emi, total, interest } = emiCalc(
    form.desired_amount,
    0.18,
    form.tenure
  );

  // styles
  const s = {
    container: {
      maxWidth: 780,
      margin: "0 auto",
      color: "#e5e7eb",
      fontFamily:
        "-apple-system,BlinkMacSystemFont,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    },
    card: {
      display: "grid",
      gridTemplateColumns: "1.05fr 1.2fr",
      gap: 16,
      borderRadius: 18,
      border: "1px solid rgba(148,163,184,.35)",
      background:
        "radial-gradient(circle at top left, rgba(16,185,129,.18), transparent 55%), rgba(15,23,42,.98)",
      boxShadow: "0 20px 60px rgba(0,0,0,.7)",
      padding: 16,
    },
    leftChat: {
      borderRadius: 14,
      padding: 14,
      background:
        "linear-gradient(135deg, rgba(15,23,42,.9), rgba(15,23,42,.96))",
      border: "1px solid rgba(148,163,184,.4)",
      minHeight: 120,
      fontSize: 14,
      lineHeight: 1.5,
    },
    hint: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
    error: { color: "#f87171", fontSize: 12, marginTop: 4 },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 12px",
      borderRadius: 999,
      background: "rgba(16,185,129,.18)",
      border: "1px solid rgba(16,185,129,.5)",
      color: "#a7f3d0",
      fontSize: 12,
      textDecoration: "none",
      boxShadow: "0 0 18px rgba(16,185,129,.5)",
    },
    kpiBox: {
      background: "rgba(15,23,42,.96)",
      border: "1px solid rgba(148,163,184,.45)",
      padding: 10,
      borderRadius: 12,
      textAlign: "center",
    },
    label: {
      display: "block",
      fontSize: 13,
      color: "#e5e7eb",
      marginBottom: 4,
    },
    input: (hasError = false) => ({
      width: "100%",
      padding: "10px 11px",
      borderRadius: 10,
      border: hasError
        ? "1px solid rgba(248,113,113,.9)"
        : "1px solid rgba(148,163,184,.6)",
      background: "rgba(15,23,42,.98)",
      color: "#e2e8f0",
      fontSize: 13,
      outline: "none",
      boxShadow: "inset 0 0 0 1px rgba(15,23,42,1)",
    }),
  };

  return (
    <div className="glc-widget" style={s.container}>
      {/* title strip for widget */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          paddingInline: 4,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: "#64748b",
            }}
          >
            Quick sanction widget
          </div>
          <div style={{ fontSize: 13, color: "#e5e7eb" }}>
            GreenLight Credit · Demo
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#22c55e",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              height: 7,
              width: 7,
              borderRadius: "999px",
              background: "#22c55e",
              boxShadow: "0 0 12px rgba(34,197,94,.9)",
            }}
          />
          Live preview
        </div>
      </div>

      {/* main card */}
      <div style={s.card}>
        {/* Left: chat + downloads */}
        <div>
          <div style={s.leftChat}>
            {msg}
            {loading && (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "999px",
                    background: "#22c55e",
                    opacity: 0.85,
                    animation: "glc-pulse 1s infinite",
                  }}
                />
                <span style={{ fontSize: 12, color: "#cbd5e1" }}>
                  Processing…
                </span>
              </div>
            )}
          </div>

          {/* Downloads + KFS */}
          {(docs.pdf || docs.kfs) && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 12,
              }}
            >
              {docs.pdf && (
                <a
                  href={docs.pdf}
                  target="_blank"
                  rel="noreferrer"
                  style={s.badge}
                >
                  Download Sanction PDF
                </a>
              )}
            </div>
          )}

          {/* Pretty KFS summary */}
          {docs.kfs && typeof docs.kfs === "object" && (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Key Fact Statement
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {Object.entries(docs.kfs).map(([k, v]) => (
                  <div key={k} style={s.kpiBox}>
                    <div style={{ fontSize: 11, color: "#93c5fd" }}>{k}</div>
                    <div style={{ fontSize: 14 }}>{String(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: form */}
        <form
          onSubmit={submit}
          style={{
            borderRadius: 14,
            padding: 14,
            background:
              "linear-gradient(135deg, rgba(15,23,42,.96), rgba(15,23,42,1))",
            border: "1px solid rgba(148,163,184,.45)",
          }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <label style={s.label}>Full name</label>
              <input
                className="glc-input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g., Gautam Govind"
                style={s.input(!!errors.name)}
              />
              {errors.name && <div style={s.error}>{errors.name}</div>}
              <div style={s.hint}>Enter full name as per PAN</div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginTop: 4,
              }}
            >
              <div>
                <label style={s.label}>Mobile (10-digit)</label>
                <input
                  className="glc-input"
                  value={form.mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="9XXXXXXXXX"
                  inputMode="numeric"
                  style={s.input(!!errors.mobile)}
                />
                {errors.mobile && <div style={s.error}>{errors.mobile}</div>}
              </div>
              <div>
                <label style={s.label}>PAN last 4</label>
                <input
                  className="glc-input"
                  value={form.pan_tail}
                  onChange={(e) => setPan(e.target.value)}
                  placeholder="1234"
                  inputMode="numeric"
                  style={s.input(!!errors.pan_tail)}
                />
                {errors.pan_tail && (
                  <div style={s.error}>{errors.pan_tail}</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 4 }}>
              <label style={s.label}>
                Loan amount{" "}
                <span style={{ color: "#93c5fd", fontSize: 12 }}>
                  ({inr(form.desired_amount)})
                </span>
              </label>
              <input
                type="range"
                min="10000"
                max="2000000"
                step="5000"
                value={form.desired_amount}
                onChange={(e) => setAmt(e.target.value)}
                style={{
                  width: "100%",
                  accentColor: "#22c55e",
                  cursor: "pointer",
                }}
              />
              {errors.desired_amount && (
                <div style={s.error}>{errors.desired_amount}</div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginTop: 2,
              }}
            >
              <div>
                <label style={s.label}>
                  Tenure (months){" "}
                  <span style={{ color: "#93c5fd", fontSize: 12 }}>
                    ({form.tenure})
                  </span>
                </label>
                <input
                  type="range"
                  min="6"
                  max="84"
                  step="1"
                  value={form.tenure}
                  onChange={(e) => setTenure(e.target.value)}
                  style={{
                    width: "100%",
                    accentColor: "#22c55e",
                    cursor: "pointer",
                  }}
                />
                {errors.tenure && <div style={s.error}>{errors.tenure}</div>}
              </div>
              <div>
                <label style={s.label}>Monthly salary (net)</label>
                <input
                  className="glc-input"
                  value={form.salary}
                  onChange={(e) => setSalary(e.target.value)}
                  onBlur={() => set("salary", String(salaryNum))}
                  placeholder="60000"
                  inputMode="numeric"
                  style={s.input(!!errors.salary)}
                />
                {errors.salary && <div style={s.error}>{errors.salary}</div>}
              </div>
            </div>

            {/* Consent */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginTop: 6,
                fontSize: 12,
                color: "#e2e8f0",
              }}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: 3, accentColor: "#22c55e" }}
              />
              <span>
                I consent to share info for eligibility checks, CKYC / AA pulls
                and KFS generation for this application.
              </span>
            </label>
            {errors.consent && <div style={s.error}>{errors.consent}</div>}

            {/* KPIs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                marginTop: 6,
              }}
            >
              <div style={s.kpiBox}>
                <div style={{ fontSize: 11, color: "#cbd5e1" }}>EMI</div>
                <div
                  style={{
                    fontWeight: 700,
                    color: "#a7f3d0",
                    fontSize: 13,
                    marginTop: 3,
                  }}
                >
                  {inr(emi)}
                </div>
              </div>
              <div style={s.kpiBox}>
                <div style={{ fontSize: 11, color: "#cbd5e1" }}>Interest</div>
                <div
                  style={{
                    fontWeight: 700,
                    color: "#e5e7eb",
                    fontSize: 13,
                    marginTop: 3,
                  }}
                >
                  {inr(interest)}
                </div>
              </div>
              <div style={s.kpiBox}>
                <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                  Total payable
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    color: "#e5e7eb",
                    fontSize: 13,
                    marginTop: 3,
                  }}
                >
                  {inr(total)}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px 14px",
                marginTop: 6,
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                color: "#fff",
                border: 0,
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 12px 30px rgba(22,163,74,.7)",
                opacity: loading ? 0.7 : 1,
                transition:
                  "transform .12s ease, box-shadow .12s ease, opacity .12s ease",
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "translateY(1px)";
                e.currentTarget.style.boxShadow =
                  "0 6px 16px rgba(22,163,74,.7)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 12px 30px rgba(22,163,74,.7)";
              }}
            >
              {loading ? "Processing…" : "Get Offer"}
            </button>
          </div>
        </form>
      </div>

      {/* local styles for placeholder + tiny animation */}
      <style>{`
        .glc-widget input::placeholder {
          color: #64748b;
          opacity: 1;
        }
        @keyframes glc-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.2); opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
