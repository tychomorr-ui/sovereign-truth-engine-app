# Sovereign Truth Trifecta Portal Chat Deployment Guide

This guide outlines the process for deploying and managing the Sovereign Truth Trifecta Portal Chat application on the Manus Platform, including custom domain setup and continuous integration/continuous deployment (CI/CD) considerations.

## 1. Deployment on Manus Platform

The Sovereign Truth Trifecta Portal Chat is designed for seamless deployment on the Manus Platform, leveraging its integrated hosting, scaling, and monitoring capabilities.

### Initial Deployment

1.  **Access Management UI**: Log in to your Manus Platform account and navigate to the project dashboard for `sovereign-truth-engine-app`.
2.  **Publish**: In the top-right corner of the Management UI, click the **"Publish"** button.
3.  **Confirmation**: Confirm the deployment. The Manus Platform will automatically:
    -   Build your project (install dependencies, compile TypeScript, bundle assets).
    -   Provision necessary infrastructure (serverless functions, database connections).
    -   Deploy the application to a unique Manus subdomain (e.g., `sovereignapp-hkcgwye7.manus.space`).
    -   Enable integrated services (Stripe, OAuth, S3 storage).
4.  **Live URL**: Once deployed, your application will be accessible via the provided Manus subdomain.

### Continuous Deployment (CD)

Any subsequent `webdev_save_checkpoint` operations or direct pushes to the connected GitHub repository (`tychomorr-ui/sovereign-truth-engine`) will trigger an automatic rebuild and deployment cycle on the Manus Platform. This ensures that your live application always reflects the latest audit-ready codebase.

## 2. Custom Domain Setup

To connect your own domain (e.g., `universaltruth.life`) to your deployed Sovereign Truth Trifecta Portal Chat:

1.  **Access Management UI**: Navigate to your project dashboard on the Manus Platform.
2.  **Settings**: In the left-hand navigation, click on **"Settings"**.
3.  **Domains**: Select the **"Domains"** sub-panel.
4.  **Bind Custom Domain**: Click the **"Bind Custom Domain"** button.
5.  **Enter Domain**: Input your custom domain (e.g., `universaltruth.life`) and click "Next".
6.  **DNS Configuration**: The Manus Platform will provide specific DNS records (typically CNAME or A records) that you need to add to your domain registrar (e.g., GoDaddy, Cloudflare, Namecheap).
    -   **Example CNAME Record**: `www IN CNAME your-manus-subdomain.manus.space`
    -   **Example A Record**: `@ IN A <Manus_IP_Address>`
7.  **Update DNS**: Log in to your domain registrar and update your DNS settings with the provided records.
8.  **Verification**: Return to the Manus Management UI. The platform will automatically verify the DNS changes. This process can take a few minutes to several hours due to DNS propagation.
9.  **SSL/TLS**: Manus automatically provisions and manages SSL/TLS certificates for your custom domain, ensuring secure HTTPS access.

## 3. Monitoring and Logging

The Manus Platform provides integrated tools for monitoring the health and performance of your application:

-   **Dashboard**: Access real-time metrics (UV/PV, response times, error rates) from the project dashboard.
-   **Logs**: Use the `manus-webdev-logs` CLI tool to view production console logs:
    ```bash
    manus-webdev-logs
    manus-webdev-logs --limit 50 --end-time <oldest_time>
    ```
-   **Health Checks**: The platform continuously performs health checks on your deployed services. Alerts can be configured for critical issues.

## 4. Rollbacks

In case of issues with a new deployment, you can easily roll back to a previous stable version:

1.  **Access Management UI**: Navigate to your project dashboard.
2.  **Version History**: Click the "⋯" (More) menu in the header and select **"Version history"**.
3.  **Select Checkpoint**: Choose the desired stable checkpoint from the list.
4.  **Rollback**: Click the **"Rollback"** button to revert your deployed application to that specific version.

## 5. Environment Variables and Secrets

Environment variables and secrets (e.g., API keys, database credentials) are securely managed by the Manus Platform. They are injected into your application at runtime and should never be hardcoded or committed to your repository.

-   **Management**: Update secrets via **Settings → Secrets** in the Management UI or by using the `webdev_request_secrets` tool during development.

### Local model configuration

Use the canonical server-only variables below when connecting KEIRA to an
OpenAI-compatible Ollama or llama.cpp endpoint:

```env
KEIRA_LLM_RUNTIME=ollama
KEIRA_LLM_ENDPOINT=http://10.9.0.1:11434/v1
KEIRA_LLM_MODEL=llama3.2:3b
KEIRA_LLM_FALLBACK_MODEL=llama3.2:1b
KEIRA_LLM_NUM_CTX=2048
```

`KEIRA_LLM_*` takes priority. Existing matching `LOCAL_LLM_*` names remain
available only as deprecated compatibility fallbacks. The browser never calls
the model endpoint directly. On startup, the server logs which model variable
names were loaded, defaulted, or missing without logging their values.

---

**Author**: Manus AI
**Version**: 1.0.0
**Date**: August 2, 2026
