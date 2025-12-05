
# GreenLight Credit - Loan Sanction Chat Widget

This repository contains a working prototype of **GreenLight Credit**, a small credit sanction widget plus a backend orchestrator, built for the EY Techathon 6.0 theme on Agentic AI.

The system lets a user enter basic details in a single widget, runs verification and underwriting rules in the backend, and returns a **sanction letter PDF** and a **Key Fact Statement (KFS)** that the widget renders as a clean summary.

---

## 1. Problem

Small ticket credit journeys often suffer from:

- Scattered forms and handoffs
- Manual checks and error prone decision making
- Poor documentation for the customer (no clear KFS or sanction letter)

EY Techathon asks for practical agent style systems. Here, the "agent" is a backend orchestrator that owns the full mini journey: collect inputs, verify, underwrite, and issue documents, all behind a simple front end.

---

## 2. Solution overview

**GreenLight Credit** is a two part system:

1. **Web widget (Next.js)**  
   - A drop in widget that can sit inside any web page.  
   - Collects name, mobile, PAN last 4 digits, desired amount, and tenure.  
   - Talks to the backend with a `session_id` and renders replies, KFS cards, and a link to the sanction PDF.

2. **Orchestrator (FastAPI)**  
   - Owns the full state machine for a credit request.  
   - Stages: `start → precheck → verify → underwrite → sanction → done` (or `manual_review` / `declined`).  
   - Generates a **Sanction Letter PDF** and a **KFS JSON** in `/files`, which the widget consumes.

At the end of a successful flow the user sees:

- A friendly confirmation message.  
- A Key Fact Statement rendered as a grid (amount, tenure, EMI, APR, mandate).  
- A downloadable sanction letter PDF.

---

## 3. Architecture

High level view:

```text
[ Web Widget (Next.js) ]
          |
          v
[ Orchestrator API (FastAPI) ]
          |
  +------------------------+
  |  Agents & Services     |
  |                        |
  |  - verification        |
  |  - underwriting        |
  |  - sanction            |
  |  - mandate, crm, audit |
  +------------------------+
          |
          v
   /app/data  →  /files (PDF + JSON)
```

### Components

- **web-widget/**  
  Next.js 14 app that renders the credit widget, calls the API, and shows the returned KFS and PDF link.

- **orchestrator/**  
  FastAPI app that exposes:
  - `GET /api/health` - simple health check  
  - `POST /api/chat` - main endpoint for the widget

- **Agents** (`app/agents/`)  
  - `verification.py` - simple checks on name, mobile, and PAN last 4.  
  - `underwriting.py` - rule based decision for approve or decline, score and reason.  
  - `sanction.py` - creates the KFS data, generates the PDF, and stores everything under `/app/data`.

- **PDF and KFS**  
  - `app/pdf/sanction_letter.py` - builds a professional sanction letter using ReportLab.  
  - KFS is stored as JSON and also returned inline to the widget.

---

## 4. User journey

1. The widget opens and starts a session.
2. The user accepts consent and enters:
   - Name  
   - Mobile number  
   - PAN last 4 digits  
   - Desired amount  
   - Tenure (months)
3. The widget sends a `POST /api/chat` with:
   - `session_id`  
   - `message` (free text from user)  
   - `name`, `mobile`, `pan_tail`, `desired_amount`, `tenure`
4. The orchestrator:
   - Moves stage from `start` to `precheck`, logs events.
   - Runs `verification.run(state)` for basic checks.
   - Runs `underwriting.run(...)` for score, approve/decline, and reason.
   - If approved, calls `sanction.run(session_id, decision, state)` to:
     - Create a mandate object.
     - Build a KFS dict.
     - Generate a high quality sanction PDF.
     - Store both in `/app/data` and expose them under `/files`.
5. The widget receives a JSON response and:
   - Shows the reply message.
   - Shows a Key Fact Statement grid from `kfs`.
   - Shows a link to the PDF (served by the backend).

---

## 5. Tech stack

- **Backend**  
  - Python 3.11  
  - FastAPI + Uvicorn  
  - Pydantic models  
  - ReportLab for PDF generation  
  - Simple in memory session store and events

- **Frontend**  
  - Next.js 14  
  - React  
  - A single widget page that can be embedded

- **Runtime**  
  - Docker and Docker Compose for local run  
  - Two containers: `orchestrator` and `widget`

---

## 6. Running the project locally

### Prerequisites

- Docker installed (with the compose plugin)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Gautam2117/greenlight-credit.git
cd greenlight-credit

# 2. Set environment variables (if needed)
# cp .env.example .env

# 3. Build and start
docker compose up --build
```

This will:

- Start the **orchestrator** on `http://localhost:8000`  
- Start the **widget** on `http://localhost:3000`

Open `http://localhost:3000` in the browser to use the widget.

The backend serves generated files from:

- `http://localhost:8000/files/...`

---

## 7. API contract

### Endpoint

`POST /api/chat`

- **URL**: `http://localhost:8000/api/chat`  
- **Method**: `POST`  
- **Content-Type**: `multipart/form-data`

#### Request fields

- `session_id` (string, required)  
- `message` (string, required) - chat style text from the widget  
- `name` (string, optional but required for approval)  
- `mobile` (string, optional but required for approval)  
- `pan_tail` (string, last 4 digits, optional but required for approval)  
- `desired_amount` (int, default `150000`)  
- `tenure` (int, default `24`)

#### Response shape

```json
{
  "reply": "Sanctioned. Your PDF + KFS is ready.",
  "pdf": "http://localhost:8000/files/sanction_<session_id>.pdf",
  "kfs": {
    "Name": "Test User",
    "Amount": 150000,
    "Tenure": 24,
    "EMI": 7321,
    "APR": "16.5%",
    "MandateID": "MDT_123456"
  },
  "handoff": false
}
```

For declined or manual review cases:

```json
{
  "reply": "Sorry, declined - reason: Low score (score 420).",
  "pdf": null,
  "kfs": null,
  "handoff": false
}
```

or

```json
{
  "reply": "We queued this for manual review.",
  "pdf": null,
  "kfs": null,
  "handoff": true
}
```

The widget uses this contract to decide what to show.

---

## 8. Sanction PDF and KFS design

The PDF is generated from the same KFS data that the widget shows, so the customer sees consistent information in both places.

**Sanction letter highlights:**

- Bank and product header  
- Customer name and masked PAN (last 4 digits)  
- Sanctioned amount with currency formatting  
- Tenure, EMI, APR  
- Mandate reference  
- Simple terms and conditions block  
- Sign off section

**KFS JSON:**

- Compact structure that is easy to render in any UI or export to other systems.

---

## 9. Project structure

```text
greenlight-credit/
├─ docker-compose.yml
├─ orchestrator/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ routers/
│  │  │  ├─ health.py
│  │  │  └─ chat.py
│  │  ├─ agents/
│  │  │  ├─ master.py
│  │  │  ├─ verification.py
│  │  │  ├─ underwriting.py
│  │  │  └─ sanction.py
│  │  ├─ pdf/
│  │  │  └─ sanction_letter.py
│  │  ├─ services/
│  │  │  ├─ mandate.py
│  │  │  └─ crm.py
│  │  ├─ events.py, models.py, deps.py, audit.py
│  └─ data/    # generated PDF and KFS files (mapped to /files)
└─ web-widget/
   ├─ Dockerfile
   ├─ package.json
   ├─ app/ or pages/ (Next.js widget UI)
   └─ src/components/...
```

---

## 10. Possible extensions

The prototype is kept small on purpose so that each part is easy to understand and extend. Natural next steps include:

- Plugging in real verification APIs for PAN and mobile.
- Replacing the rule based underwriting with a scoring model or an external credit engine.
- Adding audit persistence so that every decision and input is stored for later review.
- Adding role based dashboards for operations teams to review manual cases.

---

## 11. License

This project is shared as part of EY Techathon 6.0.  
Use for review and learning is welcome. For any other use, please contact the author.
