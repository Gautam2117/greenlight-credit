import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

/* helpers */
const inr = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(isNaN(+v) ? 0 : +v);

/** basic EMI preview: p - principal, apr - annual rate (0.18 = 18%), n - months */
function emiPreview(p, apr = 0.18, n = 12) {
  const r = apr / 12;
  if (!p || !n) return { emi: 0, interest: 0, total: 0 };
  const factor = Math.pow(1 + r, n);
  const emi = (p * r * factor) / (factor - 1);
  const total = emi * n;
  const interest = total - p;
  return { emi, interest, total };
}

const inputBase =
  "w-full rounded-xl border bg-slate-900/70 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 shadow-inner outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500 transition";

export default function Home() {
  const sessionId = useMemo(() => "sess_" + Math.random().toString(36).slice(2, 10), []);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(1); // 1 Details, 2 Verify, 3 Offer

  // form
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [pan, setPan] = useState("");
  const [amount, setAmount] = useState(150000);
  const [tenure, setTenure] = useState(24);
  const [salary, setSalary] = useState("60000");
  const [consent, setConsent] = useState(true);

  const [errors, setErrors] = useState({});
  const [pdfUrl, setPdfUrl] = useState(null);

  const listRef = useRef(null);

  /* boot: start session */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const fd = new FormData();
        fd.append("session_id", sessionId);
        fd.append("message", "start");
        if (consent) fd.append("consent", "yes");
        const res = await fetch(`${API_BASE}/api/chat`, { method: "POST", body: fd });
        const data = await res.json();
        setMessages([{ role: "bot", text: data.reply || "Welcome to GreenLight Credit!" }]);
        setStep(1);
      } catch (err) {
        console.error("start failed", err);
        setMessages([{ role: "bot", text: "Welcome to GreenLight Credit!" }]);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* autoscroll chat */
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  /* sanitize numeric fields */
  const onMobile = (v) => setMobile(v.replace(/[^\d]/g, "").slice(0, 10));
  const onPan = (v) => setPan(v.replace(/[^\d]/g, "").slice(0, 4));
  const onAmount = (v) => {
    const n = v.replace(/[^\d]/g, "");
    setAmount(Math.max(10000, Math.min(2000000, Number(n || 0))));
  };
  const onTenure = (v) => setTenure(Math.max(6, Math.min(84, Number(v || 0))));
  const onSalary = (v) => setSalary(String(v).replace(/[^\d]/g, ""));
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const salaryNum = clamp(parseInt(salary || "0", 10) || 0, 10000, 500000);

  /* validation */
  function validate() {
    const e = {};
    if (!name.trim()) e.name = "Enter full name as per PAN";
    if (mobile.length !== 10) e.mobile = "Enter 10-digit mobile";
    if (pan.length !== 4) e.pan = "Enter last 4 digits of PAN";
    if (!amount || amount < 10000) e.amount = "Min amount ₹10,000";
    if (!tenure || tenure < 6) e.tenure = "Min tenure 6 months";
    if (!salaryNum || salaryNum < 10000) e.salary = "Enter monthly net salary";
    if (!consent) e.consent = "Consent is required to proceed";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit() {
    if (!validate()) return;

    setStep(2); // move to "Verify" state
    setLoading(true);

    setMessages((m) => [
      ...m,
      { role: "user", text: `Apply ${inr(amount)} for ${tenure} months. Salary ${inr(salary)}.` },
    ]);

    const fd = new FormData();
    fd.append("session_id", sessionId);
    fd.append("message", "submit");
    fd.append("name", name);
    fd.append("mobile", mobile);
    fd.append("pan_last4", pan);
    fd.append("desired_amount", String(amount));
    fd.append("tenure", String(tenure));
    fd.append("salary", String(salaryNum));

    try {
      const res = await fetch(`${API_BASE}/api/chat`, { method: "POST", body: fd });
      const data = await res.json();

      setMessages((m) => [
        ...m,
        { role: "bot", text: data.reply || "Thanks. Generating offer…" },
      ]);

      if (data.pdf) {
        setPdfUrl(`${API_BASE}${data.pdf}`);
        setStep(3); // Offer ready
      }
    } catch (err) {
      console.error("submit failed", err);
      setMessages((m) => [...m, { role: "bot", text: "Something went wrong. Try again in a bit." }]);
    } finally {
      setLoading(false);
    }
  }

  const apr = 0.18; // demo APR 18% p.a.
  const { emi, interest, total } = emiPreview(amount, apr, tenure);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-950 bg-[radial-gradient(circle_at_top,_#22c55e22,_transparent_55%),radial-gradient(circle_at_bottom,_#0ea5e922,_transparent_55%)]">
      <div className="w-full max-w-5xl mx-auto">
        {/* header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            RBI-compliant, consent-first flow (demo)
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
            <span className="text-emerald-300">Green</span>Light Credit
          </h1>
          <p className="text-slate-300 text-sm md:text-base mt-1">
            Share basic details, preview EMI, and download your sanction letter in minutes.
          </p>
        </div>

        {/* step indicator */}
        <div className="mx-auto mb-5 max-w-3xl flex items-center gap-3 text-xs text-slate-300">
          {[
            { n: 1, label: "Details" },
            { n: 2, label: "Verification" },
            { n: 3, label: "Offer" },
          ].map((s, i, arr) => (
            <div key={s.n} className="flex items-center gap-3 flex-1">
              <div
                className={[
                  "h-8 w-8 rounded-full grid place-items-center border text-xs font-semibold transition",
                  step >= s.n
                    ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.6)]"
                    : "bg-slate-900 border-slate-600/60 text-slate-300",
                ].join(" ")}
              >
                {s.n}
              </div>
              <div className="text-[11px] sm:text-xs hidden sm:block">{s.label}</div>
              {i < arr.length - 1 && (
                <div
                  className={[
                    "h-[2px] flex-1 rounded-full transition-all",
                    step > s.n ? "bg-emerald-500/80" : "bg-slate-700",
                  ].join(" ")}
                />
              )}
            </div>
          ))}
        </div>

        {/* main card */}
        <div className="relative rounded-3xl bg-slate-900/80 border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.65)] overflow-hidden">
          {/* glow accents */}
          <div className="pointer-events-none absolute -top-24 -right-10 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />

          <div className="relative grid md:grid-cols-2 gap-px">
            {/* left: chat */}
            <div className="p-5 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Assistant
                  </p>
                  <p className="text-sm text-slate-200">GreenLight virtual agent</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live decisioning mock
                </div>
              </div>

              <div className="h-80 rounded-2xl bg-slate-950/70 border border-white/10 px-4 py-3 flex flex-col">
                <div
                  ref={listRef}
                  className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scroll"
                >
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={[
                          "max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
                          m.role === "user"
                            ? "bg-emerald-600 text-white shadow-[0_0_24px_rgba(16,185,129,0.6)]"
                            : "bg-slate-900/90 text-slate-100 border border-slate-700/70",
                        ].join(" ")}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex items-center gap-2 text-slate-300 text-sm mt-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" />
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:120ms]" />
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:240ms]" />
                      <span className="ml-2">Processing…</span>
                    </div>
                  )}
                </div>
              </div>

              {/* sanction chip */}
              {pdfUrl && (
                <div className="mt-4">
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500/90 hover:bg-emerald-500 text-white px-4 py-2 text-xs md:text-sm transition shadow-[0_0_20px_rgba(16,185,129,0.7)]"
                    title="Sanction letter + KFS"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v14h2V4h8V2Zm3 4h-6a2 2 0 0 0-2 2v12l5-2 5 2V8a2 2 0 0 0-2-2Z" />
                    </svg>
                    Download Sanction PDF
                  </a>
                </div>
              )}
            </div>

            {/* right: form + preview */}
            <div className="bg-slate-950/60 border-t md:border-t-0 md:border-l border-white/10 p-5 md:p-6">
              {/* form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-200 mb-1">Full name</label>
                  <input
                    className={`${inputBase} ${
                      errors.name ? "border-red-400/80 focus:ring-red-400/70" : "border-white/10"
                    }`}
                    placeholder="e.g., Gautam Govind"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-400">{errors.name}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-200 mb-1">
                      Mobile (10-digit)
                    </label>
                    <input
                      className={`${inputBase} ${
                        errors.mobile
                          ? "border-red-400/80 focus:ring-red-400/70"
                          : "border-white/10"
                      }`}
                      placeholder="9XXXXXXXXX"
                      inputMode="numeric"
                      value={mobile}
                      onChange={(e) => onMobile(e.target.value)}
                    />
                    {errors.mobile && (
                      <p className="mt-1 text-xs text-red-400">{errors.mobile}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-slate-200 mb-1">PAN last 4</label>
                    <input
                      className={`${inputBase} ${
                        errors.pan ? "border-red-400/80 focus:ring-red-400/70" : "border-white/10"
                      }`}
                      placeholder="1234"
                      inputMode="numeric"
                      value={pan}
                      onChange={(e) => onPan(e.target.value)}
                    />
                    {errors.pan && (
                      <p className="mt-1 text-xs text-red-400">{errors.pan}</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm text-slate-200 mb-1">
                      Loan amount
                    </label>
                    <div className="text-xs text-emerald-300 font-medium">
                      {inr(amount)}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="10000"
                    max="2000000"
                    step="5000"
                    value={amount}
                    onChange={(e) => onAmount(e.target.value)}
                    className="w-full accent-emerald-500"
                  />
                  <div className="grid grid-cols-3 text-[11px] text-slate-400 mt-1">
                    <span>₹10k</span>
                    <span className="text-center">₹10L</span>
                    <span className="text-right">₹20L</span>
                  </div>
                  {errors.amount && (
                    <p className="mt-1 text-xs text-red-400">{errors.amount}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-sm text-slate-200 mb-1">
                        Tenure (months)
                      </label>
                      <div className="text-xs text-slate-300">{tenure} mo</div>
                    </div>
                    <input
                      type="range"
                      min="6"
                      max="84"
                      step="1"
                      value={tenure}
                      onChange={(e) => onTenure(e.target.value)}
                      className="w-full accent-emerald-500"
                    />
                    <div className="grid grid-cols-3 text-[11px] text-slate-400 mt-1">
                      <span>6</span>
                      <span className="text-center">36</span>
                      <span className="text-right">84</span>
                    </div>
                    {errors.tenure && (
                      <p className="mt-1 text-xs text-red-400">{errors.tenure}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-slate-200 mb-1">
                      Monthly salary (net)
                    </label>
                    <input
                      className={`${inputBase} ${
                        errors.salary
                          ? "border-red-400/80 focus:ring-red-400/70"
                          : "border-white/10"
                      }`}
                      placeholder="e.g., 60000"
                      inputMode="numeric"
                      value={salary}
                      onChange={(e) => onSalary(e.target.value)}
                      onBlur={() => setSalary(String(salaryNum))}
                    />
                    {errors.salary && (
                      <p className="mt-1 text-xs text-red-400">{errors.salary}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-emerald-500 rounded"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <div className="text-xs sm:text-sm text-slate-200">
                    I consent to share info for eligibility checks, CKYC / AA pulls and
                    KFS generation for this application.
                  </div>
                </div>
                {errors.consent && (
                  <p className="mt-1 text-xs text-red-400">{errors.consent}</p>
                )}

                <button
                  onClick={onSubmit}
                  disabled={loading}
                  className="w-full mt-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition shadow-[0_10px_30px_rgba(16,185,129,0.55)]"
                >
                  {loading ? "Processing…" : "Get instant offer preview"}
                </button>
              </div>

              {/* preview */}
              <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    Offer preview (demo)
                  </div>
                  <span className="text-[11px] text-slate-400">
                    APR {Math.round(apr * 100)}% p.a.
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-700/60">
                    <div className="text-[11px] text-slate-400">EMI</div>
                    <div className="text-emerald-300 font-semibold mt-1">
                      {inr(emi)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-700/60">
                    <div className="text-[11px] text-slate-400">Interest</div>
                    <div className="text-slate-100 font-medium mt-1">
                      {inr(interest)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-700/60">
                    <div className="text-[11px] text-slate-400">Total payable</div>
                    <div className="text-slate-100 font-medium mt-1">
                      {inr(total)}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  * Preview numbers only. Final sanction letter & KFS will reflect the
                  actual APR, fees and schedule.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* scrollbar styling */}
        <style jsx global>{`
          .custom-scroll::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scroll::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.4);
            border-radius: 9999px;
          }
        `}</style>
      </div>
    </main>
  );
}
