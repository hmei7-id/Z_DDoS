# Z-DDOS

![Z-DDOS ASCII Art](https://i.imgur.com/Qk802o6.jpeg)

Z-DDOS is a powerful Layer 7 DDoS script designed for network stress testing. It utilizes the HTTP/2 protocol to send a high volume of requests through multiple threads and proxies, making it an effective tool for security research and testing website resilience.

## 🚨 Disclaimer 🚨

**This tool is intended for educational and testing purposes only.** Using this script to attack targets without prior mutual consent is illegal. The developer, **Z-BL4CK-H4T**, and the provider of this information are not responsible for any damage or legal consequences caused by your actions. **You are solely responsible for how you use this tool.**

---

## ✨ Features

* **HTTP/2 Flood:** Leverages the high-throughput capabilities of the HTTP/2 protocol.
* **Multi-Threaded:** Capable of running attacks across multiple CPU cores for maximum power.
* **Proxy Support:** Routes traffic through a proxy file to anonymize the source and distribute the load.
* **Advanced Header Spoofing:** Generates a wide variety of realistic browser headers (`User-Agent`, `Accept`, `Language`, etc.) to bypass basic security checks.
* **Dynamic Request Generation:** Randomizes request paths and parameters to avoid simple caching defenses.
* **Cluster Mode:** Utilizes Node.js cluster module for efficient multi-core processing.

---

## 📋 Requirements

* **Node.js** (Version 16.x or higher recommended)
* **Python3** (For the proxy scraper)
* **Git**
* A proxy file (`proxy.txt` or similar)

---

## ⚙️ Installation

Follow the instructions for your operating system.

### Linux (Debian / Ubuntu)

1.  **Update and Upgrade System**
    ```bash
    sudo apt update && sudo apt upgrade -y
    ```

2.  **Install Git, Node.js, and Python**
    ```bash
    sudo apt install git nodejs npm python3 -y
    ```

3.  **Clone the Repository**
    ```bash
    git clone https://github.com/hmei7-id/Z_DDoS/
    ```

4.  **Navigate to the Project Directory**
    ```bash
    cd Z_DDoS
    ```

5.  **Install Node.js Dependencies**
    ```bash
    npm install axios
    ```

6.  **run javascript z.js ""
    ```bash
    node z.js
    ```

### Termux (Android)

1.  **Update and Upgrade Packages**
    ```bash
    pkg update && pkg upgrade -y
    ```

2.  **Install Git, Node.js, and Python**
    ```bash
    pkg install git nodejs python -y
    ```

3.  **Clone the Repository**
    ```bash
    git clone <your-repository-url>
    ```

4.  **Navigate to the Project Directory**
    ```bash
    cd <repository-name>
    ```

5.  **Install Node.js Dependencies**
    ```bash
    npm install axios
    ```

---

## 🚀 How to Use

### 1. Get Proxies

The script requires a list of proxies to function effectively. You should have a file named `proxy.txt` (or similar) in the project directory with proxies in the `IP:PORT` format, one per line. The script's help text suggests using a scraper, which you might need to run first if available.

```bash
# Example command if you have a scraper.py
python3 scrape.py
