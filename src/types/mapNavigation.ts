export type TransportMode =
  | 'drive'
  | 'transit_bus'
  | 'transit_train'
  | 'bicycle'
  | 'walk'
  | 'two_wheeler';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface TransitStepDetails {
  vehicleType: 'BUS' | 'RAIL' | 'SUBWAY' | 'TRAIN' | 'TRAM' | 'FERRY' | 'TRANSIT';
  lineName: string;
  lineShortName?: string;
  departureStop: string;
  arrivalStop: string;
  departureTime?: string;
  arrivalTime?: string;
  numStops: number;
  headsign?: string;
  color?: string;
}

export interface NavigationStep {
  instruction: string;
  maneuver?: string;
  distanceMeters: number;
  distanceText: string;
  durationText: string;
  startLocation: GeoPoint;
  endLocation: GeoPoint;
  travelMode: TransportMode;
  transitDetails?: TransitStepDetails;
  polyline?: string;
}

export interface NavigationRoute {
  id: string;
  userEmail: string;
  title: string;
  originName: string;
  originLocation: GeoPoint;
  destinationName: string;
  destinationLocation: GeoPoint;
  travelMode: TransportMode;
  distanceMeters: number;
  distanceText: string;
  durationText: string;
  durationSeconds: number;
  encodedPolyline: string;
  decodedPath?: GeoPoint[];
  steps: NavigationStep[];
  transitSummary?: string;
  isOfflineCached: boolean;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveSyncStatus: 'synced' | 'local_only' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface OfflineMapPackage {
  id: string;
  packageName: string;
  center: GeoPoint;
  zoom: number;
  radiusKm: number;
  routesCount: number;
  routeIds: string[];
  sizeBytes: number;
  isDownloaded: boolean;
  downloadedAt: string;
  createdAt: string;
}
