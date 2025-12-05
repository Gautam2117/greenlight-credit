# app/agents/master.py
from app.events import append_event, get_or_create_session, save_session
from app.agents import verification, underwriting, sanction

def _normalize(form: dict) -> dict:
    f = dict(form or {})
    # derive a single canonical last4 and mirror to both keys
    pan_src = f.get("pan_last4") or f.get("pan_tail") or f.get("pan") or ""
    last4 = str(pan_src)[-4:] if pan_src else ""
    f["pan_last4"] = last4
    f["pan_tail"] = last4  # keep legacy callers happy

    # coerce numerics used later
    for key in ("desired_amount", "tenure", "salary"):
        if key in f and f[key] is not None:
            try:
                f[key] = int(f[key])
            except Exception:
                pass
    return f

def handle_message(session_id: str, msg: str, form: dict) -> dict:
    form = _normalize(form)
    state = get_or_create_session(session_id)
    history = state.get("history", [])
    history.append({"role": "user", "content": msg})
    state["history"] = history

    if state.get("stage") == "start":
        state["stage"] = "precheck"
        save_session(session_id, state)
        append_event(session_id, "stage", "precheck")
        return {"reply": "Got consent. Share name, mobile, PAN last 4."}

    if state.get("stage") == "precheck":
        # store the basic identity fields
        state.update({
            "name": form.get("name") or "",
            "mobile": form.get("mobile") or "",
            "pan_tail": form.get("pan_tail") or "",   # normalized
        })
        state["stage"] = "verify"
        append_event(session_id, "precheck", {
            "name": state["name"],
            "mobile": state["mobile"],
            "pan_tail": state["pan_tail"],
        })

        v = verification.run(state)  # expected: {"ok": bool, ...}
        state["verify"] = v
        if not v.get("ok"):
            state["stage"] = "manual_review"
            save_session(session_id, state)
            return {"reply": "We queued this for manual review.", "handoff": True}

        state["stage"] = "underwrite"
        save_session(session_id, state)

        u = underwriting.run({
            **state,
            "desired_amount": form.get("desired_amount", 150000),
            "tenure": form.get("tenure", 24),
            "salary": form.get("salary", 0),
        })
        state["underwrite"] = u
        if not u.get("approve"):
            state["stage"] = "declined"
            save_session(session_id, state)
            return {"reply": f"Sorry, declined - reason: {u['reason']} (score {u['score']})."}

        state["stage"] = "sanction"
        save_session(session_id, state)

        s = sanction.run(session_id, u, state)
        state["sanction"] = s
        state["stage"] = "done"
        save_session(session_id, state)

        # return dict KFS plus a direct link for download
        return {
            "reply": "Sanctioned. Your PDF + KFS is ready.",
            "pdf": s["pdf"],
            "kfs": s["kfs"],
            "kfs_url": s.get("kfs_url"),
        }

    return {"reply": "Session complete."}
