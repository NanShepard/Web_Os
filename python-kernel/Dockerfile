FROM python:3.11-alpine

WORKDIR /app

# Run as non-root user for security
RUN adduser -D nexosuser
USER nexosuser

COPY kernel.py /app/kernel.py

# Run unbuffered so that outputs stream immediately to the Node.js server
CMD ["python", "-u", "kernel.py"]
