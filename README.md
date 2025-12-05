# GreenLight Credit

A small, working credit journey that runs entirely from a chat widget.

The user types into a web widget, and under the hood the system runs a short pipeline:

1. Capture consent and minimal KYC fields  
2. Run basic verification checks  
3. Run a simple underwriting rule engine  
4. If approved, generate a Sanction Letter plus Key Fact Statement (KFS) as a clean PDF  
5. Return both PDF and KFS back to the widget

The goal is to show how agent style AI can sit around real workflows, not just a toy chatbot.

---

## 1. Problem statement

Traditional small-ticket credit journeys (personal loans, cards, instant EMI) often suffer from:

- Long forms and drop offs  
- Manual checks carried out in separate systems  
- Sanction letters and KFS generated as plain templates with little structure  

For a simple use case like a pre approved personal loan, the journey can be made much lighter:

- Ask only what is needed  
- Run checks automatically in the background  
- Produce clear, audit friendly output (KFS plus sanction PDF)  
- Hand off to a human only when needed

GreenLight Credit is a small simulation of such a journey.

---

## 2. What this prototype does

From the user point of view:

- A chat widget sits on a page  
- The user starts the conversation and gives consent  
- The assistant asks for name, mobile, and last 4 digits of PAN  
- The user shares desired amount and tenure  
- In seconds, the user receives:
  - A KFS grid in the UI  
  - A downloadable PDF sanction letter  

From the system point of view, each message is handled by a simple agent pipeline:

1. Start and consent  
2. Precheck  
3. Verification agent  
4. Underwriting agent  
5. Sanction agent that generates KFS plus PDF

Each stage writes to a small event log for traceability.

---

## 3. Architecture

### High level

- **Orchestrator (backend)**  
  - FastAPI application  
  - Routes under `/api`  
  - Session store in a lightweight JSON file  
  - Agents for `verification`, `underwriting`, and `sanction`  
  - Sanction PDF and KFS JSON written under `/app/data` and served from `/files/...`

- **Web widget (frontend)**  
  - Next.js 14 app (React)  
  - Chat style widget with:
    - Message history  
    - Loading states  
    - KFS card when available  
    - Links to generated PDF  

- **Docker setup**  
  - `orchestrator` container on port `8000`  
  - `widget` container on port `3000`  
  - Shared `data` volume for generated files  

### Tech stack

- Backend: FastAPI, Uvicorn, Pydantic, ReportLab  
- Frontend: Next.js 14, React, TypeScript, Tailwind CSS  
- Containerisation: Docker, docker compose

---

## 4. How the credit flow works

The core logic lives in `app/agents/master.py` and the agent modules under `app/agents/`.

### Stages

1. **start**  
   - Default stage for a new session  
   - On first user message, moves to `precheck` and asks for:
     - Name  
     - Mobile  
     - PAN last 4 digits  

2. **precheck**  
   - Stores the form data in the session  
   - Logs an event  
   - Moves to `verify`

3. **verify** (`app/agents/verification.py`)  
   - Reads `name`, `mobile`, `pan_last4`  
   - Performs simple checks (length, basic format, etc.)  
   - Returns `{"ok": true or false, "reasons": [...]}`  
   - If `ok` is false, the flow moves to `manual_review` and returns `handoff: true`

4. **underwrite** (`app/agents/underwriting.py`)  
   - Evaluates requested `desired_amount` and `tenure` against simple rules  
   - Produces:
     - `amount` (sanctioned amount)  
     - `tenure`  
     - `emi`  
     - `apr`  
     - `score`  
     - `approve` (boolean)  
   - If `approve` is false, returns a clear decline reason

5. **sanction** (`app/agents/sanction.py`)  
   - Creates a mock e mandate object  
   - Builds a KFS dictionary with key fields:
     - Name  
     - Amount  
     - Tenure  
     - EMI  
     - APR  
     - Mandate ID  
     - PAN last 4  
   - Writes:
     - `sanction_<session>.pdf`  
     - `kfs_<session>.json`  
   - Updates a mock CRM store  
   - Returns browser safe data:
     ```json
     {
       "ok": true,
       "pdf": "/files/sanction_<session>.pdf",
       "kfs": {
         "Name": "...",
         "Amount": 150000,
         "Tenure": 24,
         "EMI": 7200,
         "APR": "16%",
         "MandateID": "MDT12345",
         "PAN Last 4": "1234"
       }
     }
     ```

6. **done**  
   - The journey is marked complete  
   - Further messages get a simple "session complete" reply

---

## 5. Sanction letter and KFS PDF

Sanction PDFs are built in `app/pdf/sanction_letter.py` using ReportLab layout primitives.

The PDF includes:

- Bank and product header  
- Customer details (name, masked PAN, mobile)  
- Loan summary table:
  - Sanctioned amount with ₹ symbol  
  - Tenure (months)  
  - EMI  
  - APR  
- A Key Fact Statement table  
- Mandate details section  
- Standard terms section  
- Signature placeholders for:
  - Bank representative  
  - Customer  

The layout is designed for:

- A4 page  
- Clear section headings  
- Proper alignment and spacing  
- Simple fonts that render well in common PDF viewers  

---

## 6. Running locally

### 6.1 Prerequisites

- Docker and docker compose installed  
- Git installed

### 6.2 Clone the repository

```bash
git clone https://github.com/<your-username>/greenlight-credit.git
cd greenlight-credit
```

### 6.3 Environment file

If an `.env` file is used, copy it from the example:

```bash
cp orchestrator/.env.example orchestrator/.env
```

Fill in any keys if present in the codebase. For this prototype, default values are enough.

### 6.4 Start the stack

From the project root:

```bash
docker compose up --build
```

Services:

- Widget: http://localhost:3000  
- API: http://localhost:8000  

### 6.5 Using the widget

1. Open `http://localhost:3000` in your browser  
2. Start a new conversation in the widget  
3. Follow the prompts:
   - Give consent  
   - Share name, mobile, PAN last 4 digits  
   - Provide desired amount and tenure  
4. On approval you should see:
   - KFS fields inside the widget  
   - A "Download sanction letter" link that opens the generated PDF  

Generated files can also be found under:

```text
orchestrator/data/
  ├─ sanction_<session>.pdf
  └─ kfs_<session>.json
```

---

## 7. API reference (quick)

### `POST /api/chat`

Form fields:

- `session_id` (string, required)  
- `message` (string, required)  
- `name` (string, optional)  
- `mobile` (string, optional)  
- `pan_tail` (string, optional, last 4 digits)  
- `desired_amount` (int, optional, default `150000`)  
- `tenure` (int, optional, default `24`)

Example:

```bash
curl -X POST http://localhost:8000/api/chat \
  -F 'session_id=demo123' \
  -F 'message=Hi, I want a loan' \
  -F 'name=Riya Sharma' \
  -F 'mobile=9876543210' \
  -F 'pan_tail=1234' \
  -F 'desired_amount=150000' \
  -F 'tenure=24'
```

Sample response shape:

```json
{
  "reply": "Sanctioned. Your PDF + KFS is ready.",
  "pdf": "http://localhost:8000/files/sanction_demo123.pdf",
  "kfs": {
    "Name": "Riya Sharma",
    "Amount": 150000,
    "Tenure": 24,
    "EMI": 7200,
    "APR": "16%",
    "MandateID": "MDT-DEMO-1234",
    "PAN Last 4": "1234"
  },
  "handoff": false
}
```

---

## 8. Project structure

```text
.
├─ orchestrator/
│  ├─ app/
│  │  ├─ main.py              # FastAPI app entry
│  │  ├─ deps.py              # CORS and shared deps
│  │  ├─ models.py            # Session store and init_db
│  │  ├─ routers/
│  │  │  ├─ health.py         # /api/health
│  │  │  └─ chat.py           # /api/chat
│  │  ├─ agents/
│  │  │  ├─ master.py         # Conversation state machine
│  │  │  ├─ verification.py   # Verification agent
│  │  │  ├─ underwriting.py   # Underwriting rules
│  │  │  └─ sanction.py       # Sanction plus KFS plus PDF
│  │  ├─ pdf/
│  │  │  └─ sanction_letter.py # ReportLab PDF builder
│  │  ├─ services/
│  │  │  ├─ mandate.py        # Mock e mandate integration
│  │  │  └─ crm.py            # Mock CRM integration
│  │  └─ events.py            # Simple event log utilities
│  └─ data/                   # Generated PDFs and JSON
│
├─ web-widget/
│  ├─ app/                    # Next.js app directory
│  ├─ components/             # Chat widget components
│  ├─ lib/                    # API helpers and session utils
│  └─ public/                 # Static assets
│
└─ docker-compose.yml
```

---

## 9. Design choices

A few deliberate choices that keep the project clear to review:

- Named stages instead of one opaque AI call  
  - Each stage has a clear input and output  

- Plain JSON and files instead of a database  
  - Easy to inspect during judging  

- PDF and KFS generated from the same source data  
  - Avoids mismatches between what is shown on screen and what is in the letter  

- Minimal, clean UI  
  - Focus on correctness and clarity of the journey  

---

## 10. Possible extensions

If this were taken further, natural next steps would be:

- Plug in real verification APIs for PAN, mobile, and bank details  
- Replace the rule based underwriting with a scorecard backed by real data  
- Add more fields to the KFS, such as charges, prepayment rules, and schedules  
- Plug the event log into a small dashboard for operations teams  

---

## 11. How to use this repository in the EY submission

- GitHub link: `<your final repo URL>`  
- Demo steps:
  1. Start the containers  
  2. Open `http://localhost:3000`  
  3. Run through a sample loan journey  
  4. Download and show the sanction letter and KFS PDF  

This keeps the focus on a real, working flow rather than only slides.
