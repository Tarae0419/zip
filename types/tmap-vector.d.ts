type TmapVectorLatLng = object

type TmapVectorLatLngBounds = {
  extend: (coordinate: TmapVectorLatLng) => void
}

type TmapVectorMap = {
  on: (eventName: "ConfigLoad", listener: () => void) => void
  off?: (eventName: "ConfigLoad", listener: () => void) => void
  fitBounds: (bounds: TmapVectorLatLngBounds, margin?: number) => void
  destroy?: () => void
}

type TmapVectorOverlay = {
  setMap: (map: TmapVectorMap | null) => void
}

type TmapVectorNamespace = {
  Map: new (
    containerId: string,
    options: {
      center: TmapVectorLatLng
      width: string
      height: string
      zoom: number
      naviControl?: boolean
    },
  ) => TmapVectorMap
  LatLng: new (lat: number, lng: number) => TmapVectorLatLng
  LatLngBounds: new (coordinate: TmapVectorLatLng) => TmapVectorLatLngBounds
  Marker: new (options: {
    position: TmapVectorLatLng
    title?: string
    label?: string
    map: TmapVectorMap
  }) => TmapVectorOverlay
  Polyline: new (options: {
    path: TmapVectorLatLng[]
    strokeColor: string
    strokeWeight: number
    strokeOpacity?: number
    direction?: boolean
    map: TmapVectorMap
  }) => TmapVectorOverlay
}

interface Window {
  Tmapv3?: TmapVectorNamespace
}
