import { OpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { AzureOpenAI } from "openai";

const USE_MANAGED_IDENTITIES = process.env.USE_MANAGED_IDENTITIES === "true";

// New function to allow dynamic deployment selection
export const OpenAIModelInstance = (deploymentName?: string, apiVersion?: string) => {
  const endpointSuffix = process.env.AZURE_OPENAI_API_ENDPOINT_SUFFIX || "openai.azure.com";
  
  // Log available env vars for debugging
  console.log("Environment variables:");
  console.log(`- AZURE_OPENAI_API_DEPLOYMENT_NAME: ${process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME}`);
  console.log(`- AZURE_OPENAI_O3_DEPLOYMENT_NAME: ${process.env.AZURE_OPENAI_O3_DEPLOYMENT_NAME}`);
  
  // Use the provided deployment name or fall back to the default
  const deployment = deploymentName || process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME;
  
  // Use the provided API version or fall back to the default
  const versionToUse = apiVersion || process.env.AZURE_OPENAI_API_VERSION;
  
  console.log(`Creating OpenAI client with deployment: ${deployment} and API version: ${versionToUse}`);
  
  let token = process.env.AZURE_OPENAI_API_KEY;
  
  if (USE_MANAGED_IDENTITIES) {
    const credential = new DefaultAzureCredential();
    const scope = "https://cognitiveservices.azure.com/.default";
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);
    const client = new AzureOpenAI({
      azureADTokenProvider,
      deployment,
      apiVersion: versionToUse,
      baseURL: `https://${process.env.AZURE_OPENAI_API_INSTANCE_NAME}.${endpointSuffix}/openai/deployments/${deployment}`
    });
    return client;
  } else {
    const openai = new OpenAI({
      apiKey: token,
      baseURL: `https://${process.env.AZURE_OPENAI_API_INSTANCE_NAME}.${endpointSuffix}/openai/deployments/${deployment}`,
      defaultQuery: { "api-version": versionToUse },
      defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
    });
    return openai;
  }
};

export const OpenAIInstance =  () => {
  const endpointSuffix = process.env.AZURE_OPENAI_API_ENDPOINT_SUFFIX || "openai.azure.com";
  let token = process.env.AZURE_OPENAI_API_KEY;
  if (USE_MANAGED_IDENTITIES) {
    const credential = new DefaultAzureCredential();
    const scope = "https://cognitiveservices.azure.com/.default";
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);
    const deployment = process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
    const client = new AzureOpenAI({
      azureADTokenProvider,
      deployment,
      apiVersion,
      baseURL: `https://${process.env.AZURE_OPENAI_API_INSTANCE_NAME}.${endpointSuffix}/openai/deployments/${process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME}`
    });
    return client;
  } else {
    const openai = new OpenAI({
      apiKey: token,
      baseURL: `https://${process.env.AZURE_OPENAI_API_INSTANCE_NAME}.${endpointSuffix}/openai/deployments/${process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME}`,
      defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION },
      defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
    });
    return openai;
  }
};

export const OpenAIEmbeddingInstance =  () => {
  const endpointSuffix = process.env.AZURE_OPENAI_API_ENDPOINT_SUFFIX || "openai.azure.com";
  let token = process.env.AZURE_OPENAI_API_KEY;
  if (USE_MANAGED_IDENTITIES) {
    const credential = new DefaultAzureCredential();
    const scope = "https://cognitiveservices.azure.com/.default";
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);
    const deployment = process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
    const client = new AzureOpenAI({
      azureADTokenProvider,
      deployment,
      apiVersion,
      baseURL: `https://${process.env.AZURE_OPENAI_API_INSTANCE_NAME}.${endpointSuffix}/openai/deployments/${process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME}`
    });
    return client;
  } else {
    const openai = new OpenAI({
      apiKey: token,
      baseURL: `https://${process.env.AZURE_OPENAI_API_INSTANCE_NAME}.${endpointSuffix}/openai/deployments/${process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME}`,
      defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION },
      defaultHeaders: { "api-key": token },
    });
    return openai;
  }
};

// A new instance definition for DALL-E image generation
export const OpenAIDALLEInstance =  () => {
  const endpointSuffix = process.env.AZURE_OPENAI_API_ENDPOINT_SUFFIX || "openai.azure.com";
  let token = process.env.AZURE_OPENAI_DALLE_API_KEY;
  if (USE_MANAGED_IDENTITIES) {
    const credential = new DefaultAzureCredential();
    const scope = "https://cognitiveservices.azure.com/.default";
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);
    const deployment = process.env.AZURE_OPENAI_DALLE_API_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_DALLE_API_VERSION || "2023-12-01-preview";
    const client = new AzureOpenAI({
      azureADTokenProvider,
      deployment,
      apiVersion,
      baseURL: `https://${process.env.AZURE_OPENAI_DALLE_API_INSTANCE_NAME}.${endpointSuffix}/openai/deployments/${process.env.AZURE_OPENAI_DALLE_API_DEPLOYMENT_NAME}`
    });
    return client;
  } else {
    const openai = new OpenAI({
      apiKey: token,
      baseURL: `https://${process.env.AZURE_OPENAI_DALLE_API_INSTANCE_NAME}.${endpointSuffix}/openai/deployments/${process.env.AZURE_OPENAI_DALLE_API_DEPLOYMENT_NAME}`,
      defaultQuery: { "api-version": process.env.AZURE_OPENAI_DALLE_API_VERSION || "2023-12-01-preview" },
      defaultHeaders: { "api-key": token },
    });
    return openai;
  }
};
