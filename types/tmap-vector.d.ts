type TmapVectorLatLng = object

type TmapVectorMap = {
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
      zoomControl?: boolean
      scrollwheel?: boolean
    },
  ) => TmapVectorMap
  LatLng: new (lat: number, lng: number) => TmapVectorLatLng
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
