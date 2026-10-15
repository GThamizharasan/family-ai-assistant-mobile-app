// Smart Devices & CCTV Tapo Cloud Integration Service

export interface SmartWatchDevice {
  id: string;
  name: string;
  brand: 'Wear OS' | 'Apple Watch' | 'Samsung Galaxy Watch' | 'Fitbit';
  model: string;
  assignedTo: string;
  avatar: string;
  batteryLevel: number;
  isCharging: boolean;
  isConnected: boolean;
  heartRateBpm: number;
  restingHeartRate: number;
  bloodOxygenSpO2: number;
  bodyTempCelsius: number;
  stepCount: number;
  stepGoal: number;
  activeCalories: number;
  sleepScore: number;
  sleepDurationHours: number;
  fallDetectionActive: boolean;
  stressLevel: 'Low' | 'Moderate' | 'High';
  lastSyncTime: string;
}

export interface TapoSdRecording {
  id: string;
  cameraId: string;
  startTime: string; // e.g. "14:15"
  endTime: string;   // e.g. "14:20"
  durationSeconds: number;
  dateStr: string;   // e.g. "Today" or "2026-10-11"
  eventType: 'continuous' | 'person' | 'vehicle' | 'motion' | 'sound';
  eventTitle: string;
  fileSizeBytes: number; // e.g. 35 MB
  thumbnailUrl: string;
}

export interface TapoCameraDevice {
  id: string;
  name: string;
  model: string;
  location: string;
  status: 'online' | 'offline' | 'privacy_mode';
  streamQuality: '2K QHD' | '1080P FHD' | '720P HD';
  bitrateKbps: number;
  frameRateFps: number;
  nightVisionMode: 'Smart IR' | 'Full Color' | 'Off';
  motionDetectionEnabled: boolean;
  aiPersonDetection: boolean;
  aiVehicleDetection: boolean;
  aiBabyCryDetection: boolean;
  privacyModeActive: boolean;
  twoWayAudioActive: boolean;
  sirenAlarmActive: boolean;
  sdCardStorageGb: { total: number; used: number; free: number };
  sdCardHealth?: 'Healthy (Good)' | 'Needs Formatting' | 'Error';
  sdCardRecordings?: TapoSdRecording[];
  localIp?: string;
  cameraAccountUser?: string;
  cameraAccountPassword?: string;
  rtspStreamUrl?: string;
  webrtcBridgeUrl?: string;
  onvifPort?: number;
  cloudArchiveDays: number;
  panTiltAngle: { pan: number; tilt: number };
  lastMotionEvent?: {
    timestamp: string;
    type: 'Person' | 'Vehicle' | 'Motion' | 'Sound';
    location: string;
    description: string;
  };
  mockFeedImage: string;
}

export interface TapoAccountConfig {
  accountEmail: string;
  isLinked: boolean;
  tokenExpires: string;
  totalCameras: number;
  cloudStorageActive: boolean;
  cloudStorageTier: string;
}

export const INITIAL_TAPO_ACCOUNT: TapoAccountConfig = {
  accountEmail: 'digitaltamilworld@gmail.com',
  isLinked: true,
  tokenExpires: 'Valid for 30 Days (Auto-Refresh)',
  totalCameras: 4,
  cloudStorageActive: true,
  cloudStorageTier: 'Tapo Care Premium 30-Day Cloud Archive',
};

export const INITIAL_SMART_WATCHES: SmartWatchDevice[] = [
  {
    id: 'watch-01',
    name: "Thamiz's Galaxy Watch Ultra",
    brand: 'Samsung Galaxy Watch',
    model: 'Galaxy Watch Ultra Titanium (Wear OS 5)',
    assignedTo: 'Thamiz',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    batteryLevel: 88,
    isCharging: false,
    isConnected: true,
    heartRateBpm: 68,
    restingHeartRate: 59,
    bloodOxygenSpO2: 99,
    bodyTempCelsius: 36.6,
    stepCount: 8420,
    stepGoal: 10000,
    activeCalories: 580,
    sleepScore: 91,
    sleepDurationHours: 7.8,
    fallDetectionActive: true,
    stressLevel: 'Low',
    lastSyncTime: 'Just now (Bluetooth LE & Cloud)',
  },
  {
    id: 'watch-02',
    name: "Selvapriya's Apple Watch Series 10",
    brand: 'Apple Watch',
    model: 'Apple Watch Series 10 Rose Gold',
    assignedTo: 'Selvapriya (Spouse)',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    batteryLevel: 74,
    isCharging: false,
    isConnected: true,
    heartRateBpm: 72,
    restingHeartRate: 64,
    bloodOxygenSpO2: 98,
    bodyTempCelsius: 36.7,
    stepCount: 6310,
    stepGoal: 8000,
    activeCalories: 420,
    sleepScore: 86,
    sleepDurationHours: 7.2,
    fallDetectionActive: true,
    stressLevel: 'Low',
    lastSyncTime: '2 mins ago',
  },
  {
    id: 'watch-03',
    name: "Maaran's Fitbit Sense 2",
    brand: 'Fitbit',
    model: 'Fitbit Sense 2 Advanced Health Tracker',
    assignedTo: 'Maaran (Son)',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    batteryLevel: 91,
    isCharging: false,
    isConnected: true,
    heartRateBpm: 76,
    restingHeartRate: 62,
    bloodOxygenSpO2: 98,
    bodyTempCelsius: 36.5,
    stepCount: 9840,
    stepGoal: 10000,
    activeCalories: 640,
    sleepScore: 89,
    sleepDurationHours: 8.1,
    fallDetectionActive: true,
    stressLevel: 'Low',
    lastSyncTime: '4 mins ago',
  },
];

export const INITIAL_TAPO_CAMERAS: TapoCameraDevice[] = [
  {
    id: 'cam-01',
    name: 'Living Room 360°',
    model: 'Tapo C210 (2K QHD Pan/Tilt)',
    location: 'Main Living Room & Family Foyer',
    status: 'online',
    streamQuality: '2K QHD',
    bitrateKbps: 2450,
    frameRateFps: 30,
    nightVisionMode: 'Smart IR',
    motionDetectionEnabled: true,
    aiPersonDetection: true,
    aiVehicleDetection: false,
    aiBabyCryDetection: true,
    privacyModeActive: false,
    twoWayAudioActive: false,
    sirenAlarmActive: false,
    sdCardStorageGb: { total: 128, used: 24, free: 104 },
    sdCardHealth: 'Healthy (Good)',
    localIp: '172.20.10.2',
    cameraAccountUser: 'thamizh',
    cameraAccountPassword: 'iloveyou',
    rtspStreamUrl: 'rtsp://thamizh:iloveyou@172.20.10.2:554/stream1',
    webrtcBridgeUrl: 'http://172.20.10.2:1984/stream.html?src=living_room_c210',
    onvifPort: 2020,
    cloudArchiveDays: 30,
    panTiltAngle: { pan: 0, tilt: 15 },
    lastMotionEvent: {
      timestamp: '14 mins ago',
      type: 'Person',
      location: 'Living Room',
      description: 'Family member passed by foyer.',
    },
    mockFeedImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80',
    sdCardRecordings: [
      {
        id: 'rec-01',
        cameraId: 'cam-01',
        startTime: '15:28',
        endTime: '15:33',
        durationSeconds: 300,
        dateStr: 'Today',
        eventType: 'person',
        eventTitle: 'Person Motion in Foyer',
        fileSizeBytes: 42 * 1024 * 1024,
        thumbnailUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&auto=format&fit=crop&q=80',
      },
      {
        id: 'rec-02',
        cameraId: 'cam-01',
        startTime: '14:10',
        endTime: '14:15',
        durationSeconds: 300,
        dateStr: 'Today',
        eventType: 'motion',
        eventTitle: 'Living Room Movement',
        fileSizeBytes: 38 * 1024 * 1024,
        thumbnailUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&auto=format&fit=crop&q=80',
      },
      {
        id: 'rec-03',
        cameraId: 'cam-01',
        startTime: '12:00',
        endTime: '13:00',
        durationSeconds: 3600,
        dateStr: 'Today',
        eventType: 'continuous',
        eventTitle: 'Midday Continuous Recording',
        fileSizeBytes: 240 * 1024 * 1024,
        thumbnailUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&auto=format&fit=crop&q=80',
      },
      {
        id: 'rec-04',
        cameraId: 'cam-01',
        startTime: '08:45',
        endTime: '08:52',
        durationSeconds: 420,
        dateStr: 'Today',
        eventType: 'sound',
        eventTitle: 'Acoustic / Voice Spike Detected',
        fileSizeBytes: 52 * 1024 * 1024,
        thumbnailUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'cam-02',
    name: 'Driveway & Main Gate',
    model: 'Tapo C310 (Outdoor 2K IP66)',
    location: 'Exterior Gate & Driveway',
    status: 'online',
    streamQuality: '2K QHD',
    bitrateKbps: 2890,
    frameRateFps: 30,
    nightVisionMode: 'Full Color',
    motionDetectionEnabled: true,
    aiPersonDetection: true,
    aiVehicleDetection: true,
    aiBabyCryDetection: false,
    privacyModeActive: false,
    twoWayAudioActive: false,
    sirenAlarmActive: false,
    sdCardStorageGb: { total: 256, used: 48, free: 208 },
    sdCardHealth: 'Healthy (Good)',
    localIp: '192.168.1.121',
    cameraAccountUser: 'thamiz_admin',
    rtspStreamUrl: 'rtsp://thamiz_admin:••••••••@192.168.1.121:554/stream1',
    webrtcBridgeUrl: 'ws://192.168.1.121:1984/api/ws?src=driveway_c310',
    onvifPort: 2020,
    cloudArchiveDays: 30,
    panTiltAngle: { pan: -30, tilt: 5 },
    lastMotionEvent: {
      timestamp: '4 mins ago',
      type: 'Vehicle',
      location: 'Driveway Gate',
      description: 'Vehicle parked at front perimeter.',
    },
    mockFeedImage: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&auto=format&fit=crop&q=80',
    sdCardRecordings: [
      {
        id: 'rec-05',
        cameraId: 'cam-02',
        startTime: '15:39',
        endTime: '15:43',
        durationSeconds: 240,
        dateStr: 'Today',
        eventType: 'vehicle',
        eventTitle: 'Vehicle Arrival at Gate',
        fileSizeBytes: 45 * 1024 * 1024,
        thumbnailUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=300&auto=format&fit=crop&q=80',
      },
      {
        id: 'rec-06',
        cameraId: 'cam-02',
        startTime: '13:15',
        endTime: '13:20',
        durationSeconds: 300,
        dateStr: 'Today',
        eventType: 'person',
        eventTitle: 'Courier Delivery at Gate',
        fileSizeBytes: 41 * 1024 * 1024,
        thumbnailUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'cam-03',
    name: 'Kids Study & Tech Lab',
    model: 'Tapo C200 (Pan/Tilt Security Cam)',
    location: 'Study Room & Library',
    status: 'online',
    streamQuality: '1080P FHD',
    bitrateKbps: 1820,
    frameRateFps: 25,
    nightVisionMode: 'Smart IR',
    motionDetectionEnabled: true,
    aiPersonDetection: true,
    aiVehicleDetection: false,
    aiBabyCryDetection: false,
    privacyModeActive: false,
    twoWayAudioActive: false,
    sirenAlarmActive: false,
    sdCardStorageGb: { total: 64, used: 18, free: 46 },
    sdCardHealth: 'Healthy (Good)',
    localIp: '192.168.1.122',
    cameraAccountUser: 'thamiz_admin',
    rtspStreamUrl: 'rtsp://thamiz_admin:••••••••@192.168.1.122:554/stream1',
    webrtcBridgeUrl: 'ws://192.168.1.122:1984/api/ws?src=study_c200',
    onvifPort: 2020,
    cloudArchiveDays: 30,
    panTiltAngle: { pan: 10, tilt: 0 },
    lastMotionEvent: {
      timestamp: '32 mins ago',
      type: 'Motion',
      location: 'Study Desk',
      description: 'Study session movement detected.',
    },
    mockFeedImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80',
    sdCardRecordings: [
      {
        id: 'rec-07',
        cameraId: 'cam-03',
        startTime: '15:10',
        endTime: '15:15',
        durationSeconds: 300,
        dateStr: 'Today',
        eventType: 'person',
        eventTitle: 'Maaran entered Study Desk',
        fileSizeBytes: 32 * 1024 * 1024,
        thumbnailUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'cam-04',
    name: 'Garden Perimeter Patrol',
    model: 'Tapo C500 (Outdoor Pan/Tilt 360° AI)',
    location: 'Backyard Garden & Terrace',
    status: 'online',
    streamQuality: '1080P FHD',
    bitrateKbps: 2100,
    frameRateFps: 30,
    nightVisionMode: 'Full Color',
    motionDetectionEnabled: true,
    aiPersonDetection: true,
    aiVehicleDetection: false,
    aiBabyCryDetection: false,
    privacyModeActive: false,
    twoWayAudioActive: false,
    sirenAlarmActive: false,
    sdCardStorageGb: { total: 128, used: 35, free: 93 },
    sdCardHealth: 'Healthy (Good)',
    localIp: '192.168.1.123',
    cameraAccountUser: 'thamiz_admin',
    rtspStreamUrl: 'rtsp://thamiz_admin:••••••••@192.168.1.123:554/stream1',
    webrtcBridgeUrl: 'ws://192.168.1.123:1984/api/ws?src=garden_c500',
    onvifPort: 2020,
    cloudArchiveDays: 30,
    panTiltAngle: { pan: 45, tilt: -10 },
    lastMotionEvent: {
      timestamp: '1 hour ago',
      type: 'Motion',
      location: 'Garden Pathway',
      description: 'Perimeter clear. Natural motion detected.',
    },
    mockFeedImage: 'https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=600&auto=format&fit=crop&q=80',
    sdCardRecordings: [
      {
        id: 'rec-08',
        cameraId: 'cam-04',
        startTime: '14:40',
        endTime: '14:45',
        durationSeconds: 300,
        dateStr: 'Today',
        eventType: 'motion',
        eventTitle: 'Garden Motion Detected',
        fileSizeBytes: 39 * 1024 * 1024,
        thumbnailUrl: 'https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
];
