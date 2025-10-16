# Copilot Instructions for AI Agents

This repository is an Azure Chat Solution Accelerator powered by Azure OpenAI Service. It enables organizations to deploy a private chat tenant in Azure, with support for custom data sources, managed identities, and enterprise-grade security.

## Architecture Overview
- **Frontend:** Next.js app in `src/app/` and feature modules in `src/features/`. Uses React components and Tailwind CSS.
- **Backend/Integration:** Azure OpenAI, identity providers (Entra ID), and private endpoints. Infrastructure as code is managed via Bicep files in `infra/`.
- **Extensions:** Extensible via the `src/features/extensions-page/` and related directories.
- **Persona & Prompt:** Persona and prompt management in `src/features/persona-page/` and `src/features/prompt-page/`.
- **Security:** Managed Identity and RBAC (see `/docs/9-managed-identities.md`). App registration scripts in `scripts/` automate identity setup.

## Developer Workflows
- **Local Development:**
  - See `/docs/2-run-locally.md` for setup.
  - Use `azd init` and `azd up` for provisioning and deployment.
  - Debug with `azd up --debug`.
- **Azure Deployment:**
  - Use Azure Developer CLI or Azure Portal. See `/docs/4-deploy-to-azure.md` for GitHub Actions deployment.
- **Identity Setup:**
  - Use `scripts/appreg_setup.sh` or `.ps1` to automate Entra ID registration.
- **Environment Variables:**
  - Reference `/docs/8-environment-variables.md` for required configuration.

## Project Conventions
- **Feature Modules:** Each major feature is in its own subdirectory under `src/features/`.
- **Type Definitions:** Shared types in `src/types/`.
- **Infrastructure:** All IaC is in `infra/` (Bicep, JSON parameters).
- **Docs:** All user and developer documentation in `docs/`.
- **No secrets in code:** Use managed identities and environment variables.

## Integration Points
- **Azure OpenAI:** Core chat logic integrates with Azure OpenAI endpoints.
- **Identity Providers:** Entra ID setup is required for authentication.
- **Private Endpoints:** Supported for secure, enterprise deployments.
- **Extensions:** Plug-and-play via the extensions feature.

## Examples
- **Adding a new feature:** Create a new folder in `src/features/`, follow the pattern in existing modules.
- **Deploying to Azure:** Use `azd up` or the Azure Portal button, then follow `/docs/4-deploy-to-azure.md` for CI/CD.
- **Setting up identity:** Run `scripts/appreg_setup.sh` and configure as per `/docs/3-add-identity.md`.

## Key Files & Directories
- `src/app/` - Main Next.js app
- `src/features/` - Feature modules
- `infra/` - Infrastructure as code
- `scripts/` - Helper scripts for identity and roles
- `docs/` - Documentation

---
For questions or unclear conventions, review the relevant docs or ask for clarification. Please suggest improvements if you find missing or outdated guidance.
