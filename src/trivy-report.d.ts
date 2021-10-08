export interface JSONReport {
  SchemaVersion: number;
  ArtifactName: string;
  ArtifactType: string;
  Metadata: Metadata;
  Results: Result[];
}

export interface OS {
  Family: string;
  Name: string;
  EOSL: boolean;
}

export interface History {
  created: string;
  created_by: string;
  empty_layer?: boolean;
}

export interface Rootfs {
  type: string;
  diff_ids: string[];
}

export interface Config {
  Cmd: string[];
  Env: string[];
  Image: string;
  ArgsEscaped: boolean;
}

export interface ImageConfig {
  architecture: string;
  container: string;
  created: string;
  docker_version: string;
  history: History[];
  os: string;
  rootfs: Rootfs;
  config: Config;
}

export interface Metadata {
  OS: OS;
  ImageID: string;
  DiffIDs: string[];
  RepoTags: string[];
  RepoDigests: string[];
  ImageConfig: ImageConfig;
}

export interface Layer {
  Digest: string;
  DiffID: string;
}

export interface Nvd {
  V2Vector: string;
  V3Vector: string;
  V2Score: number;
  V3Score: number;
}

export interface Redhat {
  V3Vector: string;
  V3Score: number;
}

export interface CVSS {
  nvd: Nvd;
  redhat: Redhat;
}

export interface Vulnerability {
  VulnerabilityID: string;
  PkgName: string;
  InstalledVersion: string;
  FixedVersion: string;
  Layer: Layer;
  SeveritySource: string;
  PrimaryURL: string;
  Title: string;
  Description: string;
  Severity: string;
  CweIDs: string[];
  CVSS: CVSS;
  References: string[];
  PublishedDate: Date;
  LastModifiedDate: Date;
}

export interface Result {
  Target: string;
  Class: string;
  Type: string;
  Vulnerabilities: Vulnerability[];
}
