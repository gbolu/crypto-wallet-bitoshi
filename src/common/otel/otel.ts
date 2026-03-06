import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter as OTLPGrpcTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPHttpTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let otelSdk: NodeSDK | null = null;

function resolveTraceExporter(): OTLPHttpTraceExporter | OTLPGrpcTraceExporter {
  const protocol = (process.env.OTEL_EXPORTER_OTLP_PROTOCOL ?? 'http/protobuf')
    .trim()
    .toLowerCase();

  if (protocol === 'grpc') {
    return new OTLPGrpcTraceExporter();
  }

  return new OTLPHttpTraceExporter();
}

export function startOpenTelemetry(): void {
  if (otelSdk) {
    return;
  }

  const debugEnabled =
    (process.env.OTEL_LOG_LEVEL ?? '').toLowerCase() === 'debug';
  if (debugEnabled) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const serviceName =
    process.env.OTEL_SERVICE_NAME ?? 'crypto-wallet-bitoshi-api';
  const serviceVersion = process.env.npm_package_version ?? '0.0.0';
  const deploymentEnvironment = process.env.NODE_ENV ?? 'development';

  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: deploymentEnvironment,
  });

  otelSdk = new NodeSDK({
    resource,
    traceExporter: resolveTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  otelSdk.start();
}

export async function stopOpenTelemetry(): Promise<void> {
  if (!otelSdk) {
    return;
  }

  await otelSdk.shutdown();
  otelSdk = null;
}
