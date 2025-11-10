declare module '@deck.gl/google-maps' {
  export class GoogleMapsOverlay {
    constructor(props?: any);
    setMap(map: google.maps.Map | null): void;
    setProps(props: any): void;
  }
}

declare module '@deck.gl/geo-layers' {
  export class Tile3DLayer<DataT = any> {
    constructor(props?: any);
  }
}

declare module '@deck.gl/mesh-layers' {
  export class SimpleMeshLayer<DataT = any> {
    constructor(props?: any);
  }
  export class ScenegraphLayer<DataT = any> {
    constructor(props?: any);
  }
}

declare module '@loaders.gl/core' {
  export function registerLoaders(loaders: any[]): void;
}

declare module '@loaders.gl/gltf' {
  export const GLTFLoader: any;
}

declare module '@loaders.gl/draco' {
  export const DracoLoader: any;
}

declare module '@luma.gl/engine' {
  export class CubeGeometry {
    constructor(props?: any);
  }
}

declare module '@math.gl/core' {
  export class Matrix4 {
    constructor(array?: readonly number[]);
    identity(): this;
    scale(scale: readonly [number, number, number]): this;
    rotateZ(radians: number): this;
    rotateX(radians: number): this;
    toArray(): number[];
    clone(): Matrix4;
  }
}
