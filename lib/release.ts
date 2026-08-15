import packageJson from "../package.json";

export const RELEASE_VERSION = packageJson.version;

export function releaseLabel(): string {
  return `v${RELEASE_VERSION}`;
}
