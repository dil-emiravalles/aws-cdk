/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-console */
import { execSync } from 'child_process';

interface AwsSdk {
  [key: string]: any;
}

let installedSdk: { [service: string]: boolean } = {};
export function forceSdkInstallation(): void {
  installedSdk = {};
}

/**
 * Installs latest AWS SDK v3
 */
function installLatestSdk(packageName: string): void {
  console.log(`Installing latest AWS SDK v3: ${packageName}`);
  // Both HOME and --prefix are needed here because /tmp is the only writable location
  execSync(
    `NPM_CONFIG_UPDATE_NOTIFIER=false HOME=/tmp npm install ${JSON.stringify(packageName)} --omit=dev --no-package-lock --no-save --prefix /tmp`,
  );
  installedSdk = {
    ...installedSdk,
    [packageName]: true,
  };
}

/**
 * Loads the SDK package that will be used to make the specified API call.
 */
export async function loadAwsSdk(
  packageName: string,
  installLatestAwsSdk?: 'true' | 'false',
): Promise<AwsSdk> {
  try {
    // Try to install the latest version, and fall back to the pre-installed version if that fails
    if (!installedSdk[packageName] && installLatestAwsSdk === 'true') {
      try {
        installLatestSdk(packageName);
      } catch (e) {
        console.log(`Failed to install latest AWS SDK v3. Falling back to pre-installed version. Error: ${e}`);
        // MUST use require as dynamic import() does not support importing from directories
        // esbuild-disable unsupported-require-call -- not esbuildable but that's fine
        return require(packageName); // Fallback to pre-installed version
      }
    }
    
    // Try to load the installed version, and fall back to the pre-installed version if that fails
    try {
      // MUST use require here. Dynamic import() do not support importing from directories
      // esbuild-disable unsupported-require-call -- not esbuildable but that's fine
      return require(`/tmp/node_modules/${packageName}`);
    } catch (e) {
      console.log(`Failed to load latest AWS SDK v3. Falling back to pre-installed version. Error: ${e}`);
      // MUST use require as dynamic import() does not support importing from directories
      // esbuild-disable unsupported-require-call -- not esbuildable but that's fine
      return require(packageName); // Fallback to pre-installed version
    }
  } catch (error) {
    throw Error(`Package ${packageName} does not exist.`);
  }
}
