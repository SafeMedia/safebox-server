# 📦 SafeBox Server Deployment Guide

This guide walks you through deploying the **SafeBox** server on a fresh Ubuntu 24.04 VPS using **Docker**. You'll configure the server, clone the repo, and run the application in a clean, production-ready way.

Here is an example of a server using SafeBox server:

https://anttp.antsnest.site/gindex

---

## 🖥️ Prerequisites

- A VPS or cloud instance (Ubuntu 24.04 recommended)
- A domain pointing to your server's IP
- Basic familiarity with the terminal

---

## 🚀 Step 1: Update Your Server

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 🐳 Step 2: Install Docker

Install required packages:

```bash
sudo apt install apt-transport-https ca-certificates curl software-properties-common -y
```

Add Docker’s GPG key:

```bash
sudo mkdir -m 0755 -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc > /dev/null
```

Add the Docker repository:

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Install Docker and related tools:

```bash
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
```

Verify Docker installation:

```bash
docker --version
```

Enable the Docker service:

```bash
sudo service docker start
```

---

## 🔐 (Optional) Set Up UFW Firewall

> ⚠️ If you're using SSH, allow it before enabling the firewall!

```bash
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

---

## 📁 Step 3: Clone the SafeBox Server

Create a directory for the code:

```bash
sudo mkdir -p /home/git/safebox-server
```

### Option A: Fork and Customize

1. Go to: [SafeMedia/safebox-server](https://github.com/SafeMedia/safebox-server)
2. Click **Fork** to create your own copy
3. Edit the `Caddyfile` in your forked repo:
   - Change `ws.mydomain.com {` to your actual domain, do the same for ws. anttp. & dweb.:
     ```text
     ws.example.com {
     ```
     ```text
     anttp.example.com {
     ```
     ```text
     dweb.example.com {
     ```

4. Clone your forked repo:
   ```bash
   git clone https://github.com/your-username/safebox-server.git /home/git/safebox-server
   ```

### Option B: Clone Directly and Edit, I'm using a folder called safebox-server

```bash
git clone https://github.com/SafeMedia/safebox-server.git /home/git/safebox-server
cd /home/git/safebox-server
nano Caddyfile
```

Replace the first part of the file with your actual domain.

---

## 🌐 Step 4: Configure Your Domain (DNS)

Ensure your domain/subdomains point to your server's IP via A records.

### Example A Record Configurations:

| Type | Host             | Value (IP)        | TTL   |
|------|------------------|-------------------|-------|
| A    | ws               | your-server-ip    | 5 min |
| A    | anttp            | your-server-ip    | 5 min |
| A    | dweb             | your-server-ip    | 5 min |

DNS changes may take time to propagate.

---

## 🧱 Step 5: Start the SafeBox Server

```bash
docker compose -f /home/git/safebox-server/docker-compose.yml up -d
```

To rebuild the app with fresh changes:

```bash
docker compose -f /home/git/safebox-server/docker-compose.yml up --build -d
```

To stop the app:

```bash
docker compose -f /home/git/safebox-server/docker-compose.yml down
```

---

## 🧪 Step 6: Test Your Setup

### WebSocket Test (via [Postman](https://www.postman.com/downloads/)):

1. Open a new WebSocket request.
2. Connect to:
   ```
   wss://ws.yourdomain.com
   ```
3. You should see:
   ```
   Connected to wss://ws.yourdomain.com
   ```

4. Send a message like:
   ```
   91d16e58e9164bccd29a8fd8d25218a61d8253b51c26119791b2633ff4f6b309/start-a-node.png
   ```

   Expect a binary response starting with:
   ```
   ...v{"mimeType":"image/png","xorname":"91d16e58e...
   ```

### Browser Test

Try accessing:

```
https://anttp.yourdomain.com/91d16e58e9164bccd29a8fd8d25218a61d8253b51c26119791b2633ff4f6b309/autonomi/start-a-node.png
```

---

## 🛠️ Troubleshooting

List all running Docker containers:

```bash
docker ps
```

View logs for a container:

```bash
docker container logs <container-id>
```

Delete current source code (if needed to restart):

```bash
sudo rm -rf /home/git/safebox-server
```

You can pull the latest again:

```bash
git clone https://github.com/username/safebox-server.git /home/git/safebox-server
```


If you wish to upgrade & rebuild your images in the future you can do:

```bash
docker compose -f /home/git/safebox-server/docker-compose.yml down
```
then

```bash
docker compose -f /home/git/safebox-server/docker-compose.yml up --build -d
```

Should it not update you can do a hard reset:


delete all docker images (warning)

```bash
docker kill $(docker ps -q)
```

Remove all docker images

```bash
docker rmi -f $(docker images -aq)
```

Prune all docker volumes

```bash
docker system prune -a --volumes -f
```

---

## ✅ You're Done!

Your SafeBox server should now be up and running, accessible via your sub-domains and ready to serve content securely and efficiently.


---

## Other Products

Make/find an issue & create a PR - All contributions appreciated!

https://github.com/SafeMedia/safebox-client

https://github.com/SafeMedia/autonomi-chrome-extension

