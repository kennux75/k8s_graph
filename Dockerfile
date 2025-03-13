# Dockerfile
FROM python:3.9-slim

# Set the working directory
WORKDIR /app

RUN apt-get update && \
    apt-get install -y curl && \
    curl -LO "https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x ./kubectl && \
    mv ./kubectl /usr/local/bin/kubectl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install virtualenv
RUN pip install --no-cache-dir virtualenv

# Copy the application code and necessary directories
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY config ./config
COPY libs ./libs
COPY static ./static
COPY templates ./templates
COPY app.py .

# Expose the port the app runs on
EXPOSE 6200

# Command to run the application
CMD ["python", "app.py", "-d", "1"]
