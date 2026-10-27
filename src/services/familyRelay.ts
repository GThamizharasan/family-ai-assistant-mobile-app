/**
 * Family Relay Real-Time Inter-Instance Communication Service
 * 
 * Enables two or more installed instances of AuraFamily AI (on different phones,
 * tablets, or browser sessions) to communicate in real time via:
 * 1. Bidirectional WebSocket Relay (/ws/family-relay)
 * 2. Peer Presence & Battery/Status Broadcast
 * 3. Instant Intercom & Walkie-Talkie Messaging with Web Audio Chimes
 * 4. Real-time Emergency SOS synchronization
 * 5. State synchronization across devices
 */

import { getWsUrl } from './api';

export interface ConnectedPeer {
  deviceId: string;
  deviceName: string;
  role: string;
  memberId?: string;
  lastSeen: number;
  batteryLevel?: number;
  location?: {
    lat: number;
    lng: number;
    address: string;
    timestamp: string;
  };
}

export interface IntercomMessage {
  id: string;
  fromDeviceId: string;
  fromName: string;
  fromRole: string;
  text: string;
  timestamp: string;
  urgent?: boolean;
}

export interface EmergencySosBroadcast {
  fromDeviceId: string;
  fromName: string;
  memberId?: string;
  active: boolean;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  timestamp: string;
}

// Generate or retrieve persistent unique device ID
export function getOrCreateDeviceId(): string {
  const STORAGE_KEY = 'aura_device_instance_id';
  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    deviceId = `aura-device-${Date.now().toString(36)}-${randomSuffix}`;
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return deviceId;
}

// Determine human-readable device name based on user agent
export function detectDevicePlatform(): string {
  const ua = navigator.userAgent;
  let os = 'Device';
  if (/android/i.test(ua)) os = 'Android Phone';
  else if (/iPad|iPhone|iPod/.test(ua)) os = 'iPhone / iPad';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'Mac Desktop';
  else if (/Windows/.test(ua)) os = 'Windows PC';
  else if (/Linux/.test(ua)) os = 'Linux Device';

  let browser = 'Browser';
  if (/chrome|crios/i.test(ua) && !/edge|opr\//i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/edg/i.test(ua)) browser = 'Edge';

  return `${os} (${browser})`;
}

// Web Audio synthesizer for crisp inter-instance audio chimes (no external files needed)
export function playIntercomChime(urgent: boolean = false) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = urgent ? 'sawtooth' : 'sine';
    const now = ctx.currentTime;

    if (urgent) {
      // Rapid dual alert tone for SOS
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1200, now + 0.1);
      osc.frequency.setValueAtTime(880, now + 0.2);
      osc.frequency.setValueAtTime(1200, now + 0.3);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // Harmonious modern intercom chime
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch {
    // Audio context may be restricted before first interaction
  }
}

type PeerListener = (peers: ConnectedPeer[]) => void;
type IntercomListener = (msg: IntercomMessage) => void;
type SosListener = (sos: EmergencySosBroadcast) => void;
type StateMutationListener = (mutation: { type: string; payload: any; fromDeviceId: string }) => void;
export type CodeSyncListener = (data: { type: 'code_generated' | 'code_redeemed' | 'code_reactivated'; codeRecord: any; memberName?: string; relationship?: string }) => void;
export type LocationUpdateListener = (data: { deviceId: string; memberId?: string; location: any }) => void;

class FamilyRelayService {
  private ws: WebSocket | null = null;
  private deviceId: string;
  private deviceName: string;
  private familyId: string = 'family-aura-primary';
  private role: string = 'primary';
  private memberId?: string;
  private isConnected: boolean = false;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;

  private peerListeners: Set<PeerListener> = new Set();
  private intercomListeners: Set<IntercomListener> = new Set();
  private sosListeners: Set<SosListener> = new Set();
  private stateListeners: Set<StateMutationListener> = new Set();
  private codeListeners: Set<CodeSyncListener> = new Set();
  private locationListeners: Set<LocationUpdateListener> = new Set();
  private activePeers: ConnectedPeer[] = [];

  constructor() {
    this.deviceId = getOrCreateDeviceId();
    this.deviceName = detectDevicePlatform();
  }

  public getMyDeviceId(): string {
    return this.deviceId;
  }

  public getMyDeviceName(): string {
    return this.deviceName;
  }

  public getActivePeers(): ConnectedPeer[] {
    return this.activePeers;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public init(params: {
    familyId?: string;
    role?: string;
    memberId?: string;
    customDeviceName?: string;
  }) {
    if (params.familyId) this.familyId = params.familyId;
    if (params.role) this.role = params.role;
    if (params.memberId) this.memberId = params.memberId;
    if (params.customDeviceName) this.deviceName = params.customDeviceName;

    this.connect();
  }

  private connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const wsUrl = getWsUrl('/ws/family-relay');
      if (!wsUrl) return;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        // Register this device with the server
        this.send({
          type: 'register',
          familyId: this.familyId,
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          role: this.role,
          memberId: this.memberId,
          batteryLevel: 98,
        });

        // Start heartbeat every 20s
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: 'heartbeat', deviceId: this.deviceId, familyId: this.familyId });
          }
        }, 20000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (e) {
          console.warn('Family relay message parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        // Attempt reconnect after 3 seconds
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };
    } catch (e) {
      console.warn('Failed to connect to family relay:', e);
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 4000);
    }
  }

  private handleIncomingMessage(data: any) {
    switch (data.type) {
      case 'registered':
      case 'peers_update': {
        // Filter out own device from peer list
        const others = (data.peers || []).filter((p: ConnectedPeer) => p.deviceId !== this.deviceId);
        this.activePeers = others;
        this.notifyPeers();
        break;
      }
      case 'peer_joined': {
        if (data.peer && data.peer.deviceId !== this.deviceId) {
          const filtered = this.activePeers.filter((p) => p.deviceId !== data.peer.deviceId);
          this.activePeers = [...filtered, data.peer];
          this.notifyPeers();
          playIntercomChime(false);
        }
        break;
      }
      case 'peer_left': {
        this.activePeers = this.activePeers.filter((p) => p.deviceId !== data.deviceId);
        this.notifyPeers();
        break;
      }
      case 'intercom_message': {
        if (data.message && data.message.fromDeviceId !== this.deviceId) {
          playIntercomChime(Boolean(data.message.urgent));
          this.intercomListeners.forEach((listener) => listener(data.message));
        }
        break;
      }
      case 'emergency_sos': {
        if (data.sos) {
          playIntercomChime(true);
          this.sosListeners.forEach((listener) => listener(data.sos));
        }
        break;
      }
      case 'state_mutation': {
        if (data.fromDeviceId !== this.deviceId) {
          this.stateListeners.forEach((listener) => listener(data));
        }
        break;
      }
      case 'code_generated':
      case 'code_redeemed':
      case 'code_reactivated': {
        this.codeListeners.forEach((listener) => listener(data));
        break;
      }
      case 'location_update': {
        this.locationListeners.forEach((listener) => listener(data));
        break;
      }
    }
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public sendIntercomMessage(text: string, urgent: boolean = false): IntercomMessage {
    const msg: IntercomMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fromDeviceId: this.deviceId,
      fromName: this.deviceName,
      fromRole: this.role,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      urgent,
    };

    this.send({
      type: 'intercom_message',
      familyId: this.familyId,
      message: msg,
    });

    return msg;
  }

  public broadcastSos(active: boolean, location?: { lat: number; lng: number; address: string }) {
    const sos: EmergencySosBroadcast = {
      fromDeviceId: this.deviceId,
      fromName: this.deviceName,
      memberId: this.memberId,
      active,
      location,
      timestamp: new Date().toISOString(),
    };

    this.send({
      type: 'emergency_sos',
      familyId: this.familyId,
      sos,
    });
  }

  public broadcastStateMutation(type: string, payload: any) {
    this.send({
      type: 'state_mutation',
      familyId: this.familyId,
      fromDeviceId: this.deviceId,
      mutationType: type,
      payload,
    });
  }

  public onPeers(listener: PeerListener): () => void {
    this.peerListeners.add(listener);
    listener(this.activePeers);
    return () => this.peerListeners.delete(listener);
  }

  public onIntercom(listener: IntercomListener): () => void {
    this.intercomListeners.add(listener);
    return () => this.intercomListeners.delete(listener);
  }

  public onSos(listener: SosListener): () => void {
    this.sosListeners.add(listener);
    return () => this.sosListeners.delete(listener);
  }

  public onStateMutation(listener: StateMutationListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public onCodeSync(listener: CodeSyncListener): () => void {
    this.codeListeners.add(listener);
    return () => this.codeListeners.delete(listener);
  }

  public broadcastLocation(
    location: {
      lat: number;
      lng: number;
      address: string;
      accuracy?: number;
      batteryLevel?: number;
      timestamp?: string;
    },
    memberId?: string
  ) {
    this.send({
      type: 'location_update',
      familyId: this.familyId,
      memberId: memberId || this.memberId,
      location,
    });
  }

  public onLocationUpdate(listener: LocationUpdateListener): () => void {
    this.locationListeners.add(listener);
    return () => this.locationListeners.delete(listener);
  }

  private notifyPeers() {
    this.peerListeners.forEach((listener) => listener(this.activePeers));
  }
}

export const familyRelay = new FamilyRelayService();
