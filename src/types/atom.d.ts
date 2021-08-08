declare module "atom/src/package-manager" {
  import { Package, Emitter } from "atom"

  /** The content of a package.json */
  export type PackageMetadata = {
    name: string
    version: string
    repository?: string | { url: string }
  }

  export class PackageManager {
    readonly initialPackagesActivated: boolean

    getAvailablePackageMetadata(): Array<PackageMetadata>

    activate(): Promise<any>
    deactivatePackages(): Promise<void>
    deactivatePackage(name: string, suppressSerialization?: boolean): Promise<void>
    emitter: Emitter
    loadedPackages: {
      [packageName: string]: Package
    }
    loadPackage(name: string): void
    loadPackages(): void
    serializePackage(pkg: Package): void
    // serviceHub: ServiceHub
    packageDirPaths: Array<string>
    triggerActivationHook(hook: string): void
    triggerDeferredActivationHooks(): void
    unloadPackage(name: string): void
    unloadPackages(): void
  }
}
