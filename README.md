# GreenLight Credit - Instant Loan Origination Chat

One chat from hello to sanction in minutes. GreenLight Credit turns a messy, multi-screen loan journey into a clean, auditable flow inside a web chat. It captures consent, runs checks, applies policy rules, and issues a professional sanction letter PDF with KFS.

<p align="center">
  <img src="docs/screenshot_widget.png" alt="Chat widget" width="75%"/>
</p>

> Built for a demo-ready pilot with production-minded patterns: typed responses, clean CORS, containerized services, audit-friendly logs, and a high quality PDF output with a proper ₹ glyph.

---

## Features

- Web chat widget in Next.js - single guided flow
- Python FastAPI orchestrator - stateful endpoints with typed responses
- Clean KFS and sanction letter PDF using ReportLab with DejaVu fonts
- Session storage, consent-first flow, auditable event trail
- Docker Compose for one-command bring-up
- Static `/files` mount for generated PDFs and JSON KFS

---

## Architecture

```
web-widget (Next.js)  --->  orchestrator (FastAPI)
   |                          |
   | POST /api/chat           | writes session logs and files
   |                          v
   |                    /files/<pdf|json> (StaticFiles)
```

**Key services**

- `web-widget` - React/Next.js UI, posts form-data to the API, shows reply and links
- `orchestrator` - FastAPI app with agents for verification, underwriting, and sanction
- `pdf` - ReportLab builder for a professional sanction letter with Unicode rupee sign

---

## Quick start

### Prerequisites
- Docker and Docker Compose
- Ports 3000 and 8000 available

### Run

```bash
docker compose down
docker compose up --build
```

Open:
- Widget - http://localhost:3000
- API - http://localhost:8000/docs
- Files - http://localhost:8000/files/

---

## Configuration

### Environment

`docker-compose.yml` sets these important settings:

- Widget
  - `NEXT_PUBLIC_API=http://localhost:8000/api/chat`
  - `NEXT_PUBLIC_API_BASE=http://localhost:8000`

- Orchestrator
  - `ALLOWED_ORIGINS=http://localhost:3000`

You can pass multiple origins with commas:
```
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### CORS

CORS is applied in `app/deps.py` using `ALLOWED_ORIGINS`. Preflight requests return proper headers. If the browser shows *No 'Access-Control-Allow-Origin' header*, confirm the env and rebuild.

---

## API

### POST `/api/chat`

**Content-Type:** `multipart/form-data`

Fields:
- `session_id` - string
- `message` - string
- `name` - optional
- `mobile` - optional
- `pan_tail` - optional - last 4 of PAN, normalized to `pan_last4`
- `desired_amount` - int
- `tenure` - int (months)

Example curl:
```bash
curl -X POST http://localhost:8000/api/chat \
  -F session_id=demo123 \
  -F message="Apply" \
  -F name="Gautam" \
  -F mobile="9876543210" \
  -F pan_tail="1234" \
  -F desired_amount=150000 \
  -F tenure=24
```

Response:
```json
{
  "reply": "Sanctioned. Your PDF + KFS is ready.",
  "pdf": "/files/sanction_demo123.pdf",
  "kfs": {
    "Name": "Gautam",
    "PAN last 4": "1234",
    "Amount": 150000,
    "Tenure": 24,
    "EMI": 7488,
    "APR": "18.0%",
    "MandateID": "MDT-7k45qk"
  },
  "kfs_url": "/files/kfs_demo123.json",
  "handoff": false
}
```

### GET `/api/health`
Uptime probe.

### Static files
- `/files/*` - serves generated PDFs and JSON KFS stored in `/app/data`

---

## Data flow

1. User provides consent and minimal details in chat.
2. Server normalizes form values and resumes or creates a session.
3. Verification and underwriting agents run in-process mock logic.
4. Sanction agent prepares KFS, creates e-mandate ID, generates the PDF.
5. API returns a summary reply, a PDF link, and the parsed KFS for the UI.

---

## PDF generation

- Module: `app/pdf/sanction_letter.py`
- Library: ReportLab
- Font: DejaVu Sans for a proper ₹ glyph

### Font install

We install `fonts-dejavu-core` in the orchestrator image:

```dockerfile
# orchestrator/Dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY data ./data
```

If the font is not available the builder falls back to Helvetica and prints `Rs 1,23,456`. To always see the ₹ symbol keep the package install.

---

## Directory layout

```
orchestrator/
  app/
    agents/
      master.py
      verification.py
      underwriting.py
      sanction.py
    pdf/
      sanction_letter.py
    routers/
      chat.py
      health.py
    services/
      mandate.py
      crm.py
    deps.py
    main.py
    models.py
    events.py
  Dockerfile
web-widget/
  ...
docker-compose.yml
```

---

## Development notes

- Response model for chat:
  - `reply: str`
  - `pdf: Optional[str]`
  - `kfs: Optional[dict]` - always a dict
  - `kfs_url: Optional[str]`
  - `handoff: Optional[bool]`

- The API turns file system paths into public URLs when needed.

---

## Troubleshooting

**CORS errors in the browser**
- Make sure `ALLOWED_ORIGINS` includes your widget origin. Rebuild after changes.
- Confirm OPTIONS returns headers:  
  `curl -i -X OPTIONS http://localhost:8000/api/chat -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST"`

**`ResponseValidationError: ('response','kfs')`**
- The handler must return `kfs` as a dict. This repo returns a dict and `kfs_url` as a string.

**Black square instead of ₹**
- Install DejaVu fonts in the image as shown above.

**`KeyError: 'pan_tail'`**
- The flow normalizes to `pan_last4`. Both `pan_tail` and full `pan` are accepted.

**`'str' object has no attribute 'wrapOn'`**
- Do not put plain strings directly in `Table` cells. The builder converts to `Paragraph` objects, which this code already does.

---

## Roadmap

- Swap mocks with real CKYC, AA, bureau, offer and e-mandate APIs
- Persist sessions and events in a database
- Add WhatsApp and in-app chat channels
- Add admin console for policy rules and replays
- Add auth and vault backed secrets

---

## License

MIT. For demo and learning use.

---

## Credits

- UI: Next.js
- API: FastAPI
- PDF: ReportLab
- Fonts: DejaVu Sans

Maintainer: **Gautam**
