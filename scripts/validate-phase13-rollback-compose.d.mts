export interface RollbackComposeEvidence {
  project: string;
  root: string;
  gatewayOrigin: string;
  appOrigin: string;
}

export function validateRollbackCompose(compose: Record<string, any>, evidence: RollbackComposeEvidence): {
  ready: true;
  project: string;
  serviceCount: number;
  containerCount: number;
  mountCount: number;
  namedVolumeCount: number;
  publishedPorts: string[];
  networkCount: number;
  composeSha256: string;
};
