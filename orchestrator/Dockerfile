# orchestrator/Dockerfile
FROM python:3.11-slim

# Add fonts for the rupee glyph
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY data ./data
