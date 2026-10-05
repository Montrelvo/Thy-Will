import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js';
import type { AssetContainer } from '@babylonjs/core/assetContainer.js';
import type { Scene } from '@babylonjs/core/scene.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';

export interface AssetEntry { rootUrl: string; fileName: string }
export class AssetLoader {
  private readonly containers = new Set<AssetContainer>();
  private disposed = false;
  constructor(private readonly scene: Scene, private readonly manifest: Readonly<Record<string, AssetEntry>>) {}

  async load(id: string): Promise<AssetContainer> {
    if (this.disposed) throw new Error('Asset loader is disposed');
    const entry = this.manifest[id];
    if (!entry) throw new Error(`Unknown asset: ${id}`);
    const container = await SceneLoader.LoadAssetContainerAsync(entry.rootUrl, entry.fileName, this.scene);
    if (this.disposed) { container.dispose(); throw new Error('Asset loader disposed during loading'); }
    this.containers.add(container);
    return container;
  }

  dispose(): void {
    this.disposed = true;
    for (const container of this.containers) container.dispose();
    this.containers.clear();
  }
}
