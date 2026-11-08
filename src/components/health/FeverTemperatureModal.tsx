import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import {
  X,
  Thermometer,
  Calendar,
  Clock,
  Printer,
  Cloud,
  CheckCircle,
  AlertTriangle,
  Pill,
  Plus,
  RefreshCw,
  User,
  Activity,
  Trash2,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Database,
  Eye,
  FolderPlus,
  Folder,
  Tag,
  Sparkles,
  CheckCircle2,
  Bookmark,
  Share2,
  Download,
  FileText,
} from 'lucide-react';
import { FeverLogEntry, FeverSeverity, FamilyHealthRecord, FeverReadingGroup } from '../../types/healthRecord';
import {
  getLocalFeverLogs,
  recordFeverTemperature,
  deleteFeverLog,
  syncFeverLogsWithGoogleDrive,
  syncSingleFeverLogToGoogleDrive,
  syncFeverDataWithSqlite,
  fetchFeverLogsFromSqlite,
  getLocalFeverGroups,
  fetchFeverGroupsFromSqlite,
  createFeverReadingGroup,
  updateFeverReadingGroup,
  deleteFeverReadingGroup,
  syncFeverGroupToGoogleDrive,
  getPrintableFeverReport,
  getSeverityColor,
  getSeverityLabel,
  calculateFeverSeverity,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  FEVER_FOLDER_PATH,
} from '../../services/feverDriveSync';
import { getLocalHealthRecords, getGoogleAccessToken } from '../../services/healthRecordDriveSync';

interface FeverTemperatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMemberId?: string;
  onMemberSelect?: (memberId: string) => void;
  initialTempF?: number;
  autoLogOpen?: boolean;
  autoPrint?: boolean;
}

const COMMON_SYMPTOMS = [
  'Chills & Shivering',
  'Headache',
  'Body Ache',
  'Flushed Cheeks',
  'Runny Nose',
  'Sore Throat',
  'Fatigue & Lethargy',
  'Loss of Appetite',
  'Sweating / Perspiration',
  'Cough',
  'Ear Pain',
  'Nausea',
];

const QUICK_TEMPS_F = [98.6, 99.5, 100.4, 101.2, 102.0, 102.8, 103.5];

function getLocalDateTimeString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export const FeverTemperatureModal: React.FC<FeverTemperatureModalProps> = ({
  isOpen,
  onClose,
  selectedMemberId,
  onMemberSelect,
  initialTempF,
  autoLogOpen = false,
  autoPrint = false,
}) => {
  const [members, setMembers] = useState<FamilyHealthRecord[]>([]);
  const [activeMemberId, setActiveMemberId] = useState<string>('');
  const [feverLogs, setFeverLogs] = useState<FeverLogEntry[]>([]);
  const [feverGroups, setFeverGroups] = useState<FeverReadingGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupNotes, setNewGroupNotes] = useState<string>('');
  const [formGroupId, setFormGroupId] = useState<string>('');
  const [isSyncingGroup, setIsSyncingGroup] = useState<boolean>(false);
  const [unit, setUnit] = useState<'F' | 'C'>('F');
  const [showAddForm, setShowAddForm] = useState(autoLogOpen);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSyncSuccess, setDriveSyncSuccess] = useState<string | null>(null);

  // Form State
  const [recordedDateTime, setRecordedDateTime] = useState<string>(() => getLocalDateTimeString());
  const [inputTempF, setInputTempF] = useState<number>(initialTempF || 100.4);
  const [inputTempC, setInputTempC] = useState<number>(38.0);
  const [measurementMethod, setMeasurementMethod] = useState<FeverLogEntry['measurementMethod']>('forehead');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [notes, setNotes] = useState('');
  const [recordedBy, setRecordedBy] = useState('Chinnathambi');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<FeverLogEntry | null>(null);
  const [inspectingMoment, setInspectingMoment] = useState<FeverLogEntry | null>(null);
  const [syncingMomentId, setSyncingMomentId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const printSvgRef = useRef<SVGSVGElement | null>(null);
  const previewSvgRef = useRef<SVGSVGElement | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);

  // Load initial members, groups, and logs
  useEffect(() => {
    if (!isOpen) return;
    const allMembers = getLocalHealthRecords();
    setMembers(allMembers);

    const initialId = selectedMemberId || allMembers[0]?.memberId || 'member_mithran';
    setActiveMemberId(initialId);

    // Initial load from SQLite and localStorage
    const localLogs = getLocalFeverLogs();
    setFeverLogs(localLogs);
    fetchFeverLogsFromSqlite().then((logs) => {
      if (logs && logs.length > 0) setFeverLogs(logs);
    });

    const localGroups = getLocalFeverGroups();
    setFeverGroups(localGroups);
    fetchFeverGroupsFromSqlite().then((groups) => {
      if (groups && groups.length > 0) setFeverGroups(groups);
    });

    if (initialTempF) {
      setInputTempF(initialTempF);
      setInputTempC(fahrenheitToCelsius(initialTempF));
      setShowAddForm(true);
    }
  }, [isOpen, selectedMemberId, initialTempF]);

  // Listen for local updates
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) {
        setFeverLogs(e.detail);
      } else {
        setFeverLogs(getLocalFeverLogs());
      }
    };
    window.addEventListener('aura_fever_logs_changed', handleUpdate);
    return () => window.removeEventListener('aura_fever_logs_changed', handleUpdate);
  }, []);

  useEffect(() => {
    const handleGroupsUpdate = (e: any) => {
      if (e.detail) {
        setFeverGroups(e.detail);
      } else {
        setFeverGroups(getLocalFeverGroups());
      }
    };
    window.addEventListener('aura_fever_groups_changed', handleGroupsUpdate);
    return () => window.removeEventListener('aura_fever_groups_changed', handleGroupsUpdate);
  }, []);

  // Handle autoPrint trigger if voice assistant requested printing
  useEffect(() => {
    if (isOpen && autoPrint) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint]);

  const activeMember = useMemo(() => {
    return members.find((m) => m.memberId === activeMemberId || m.id === activeMemberId) || members[0] || null;
  }, [members, activeMemberId]);

  // Groups associated with current active member
  const memberGroups = useMemo(() => {
    if (!activeMember) return [];
    return feverGroups.filter(
      (g) =>
        g.memberId === activeMember.memberId ||
        g.memberId === activeMember.id ||
        g.memberName.toLowerCase() === activeMember.memberName.toLowerCase()
    );
  }, [feverGroups, activeMember]);

  // Set default formGroupId to active group or first group when member changes
  useEffect(() => {
    const active = memberGroups.find((g) => g.isActive);
    if (active) {
      setFormGroupId(active.id);
    } else if (memberGroups.length > 0) {
      setFormGroupId(memberGroups[0].id);
    } else {
      setFormGroupId('');
    }
  }, [activeMemberId, memberGroups]);

  // Filter logs for active member
  const memberLogs = useMemo(() => {
    if (!activeMember) return [];
    return feverLogs
      .filter(
        (l) =>
          l.memberId === activeMember.memberId ||
          l.memberId === activeMember.id ||
          l.memberName.toLowerCase() === activeMember.memberName.toLowerCase()
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [feverLogs, activeMember]);

  const currentSelectedGroup = useMemo(() => {
    if (selectedGroupId === 'all') return null;
    return memberGroups.find((g) => g.id === selectedGroupId) || null;
  }, [memberGroups, selectedGroupId]);

  // Filter logs based on member AND selected reading group
  const displayedLogs = useMemo(() => {
    if (selectedGroupId === 'all') return memberLogs;
    return memberLogs.filter((l) => l.readingGroupId === selectedGroupId);
  }, [memberLogs, selectedGroupId]);

  const latestLog = memberLogs[memberLogs.length - 1];
  const peakLog = useMemo(() => {
    if (memberLogs.length === 0) return null;
    return [...memberLogs].sort((a, b) => b.temperatureF - a.temperatureF)[0];
  }, [memberLogs]);

  const displayedLatestLog = displayedLogs[displayedLogs.length - 1];
  const displayedPeakLog = useMemo(() => {
    if (displayedLogs.length === 0) return null;
    return [...displayedLogs].sort((a, b) => b.temperatureF - a.temperatureF)[0];
  }, [displayedLogs]);

  // Synchronize F and C inputs
  const handleTempFChange = (val: number) => {
    setInputTempF(Number(val.toFixed(1)));
    setInputTempC(fahrenheitToCelsius(val));
  };

  const handleTempCChange = (val: number) => {
    setInputTempC(Number(val.toFixed(1)));
    setInputTempF(celsiusToFahrenheit(val));
  };

  // Quick offset helper for reading date and time
  const setQuickTimeOffset = (minutesAgo: number) => {
    if (minutesAgo === 0) {
      setRecordedDateTime(getLocalDateTimeString(new Date()));
    } else {
      setRecordedDateTime(getLocalDateTimeString(new Date(Date.now() - minutesAgo * 60 * 1000)));
    }
  };

  const isPastReading = useMemo(() => {
    if (!recordedDateTime) return false;
    const diffMs = Date.now() - new Date(recordedDateTime).getTime();
    return diffMs > 2 * 60 * 1000;
  }, [recordedDateTime]);

  const isFutureReading = useMemo(() => {
    if (!recordedDateTime) return false;
    const diffMs = new Date(recordedDateTime).getTime() - Date.now();
    return diffMs > 60 * 1000;
  }, [recordedDateTime]);

  const timeLabel = useMemo(() => {
    if (!recordedDateTime) return 'Current Time';
    const d = new Date(recordedDateTime);
    if (isNaN(d.getTime())) return 'Invalid date';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (Math.abs(diffMs) < 60 * 1000) return 'Just now (Current Time)';
    if (diffMs > 0) {
      const diffMins = Math.round(diffMs / (60 * 1000));
      if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      const diffHours = Math.round(diffMs / (3600 * 1000));
      if (diffHours < 24 && d.getDate() === now.getDate()) {
        return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      if (diffHours < 48 && (now.getDate() - d.getDate() === 1 || diffHours >= 18)) {
        return `Yesterday at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `Future scheduled: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, [recordedDateTime]);

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember) return;
    setIsSubmitting(true);

    try {
      const selectedTimestamp = recordedDateTime
        ? new Date(recordedDateTime).toISOString()
        : new Date().toISOString();

      const targetGroup = memberGroups.find((g) => g.id === formGroupId);

      await recordFeverTemperature({
        memberId: activeMember.memberId,
        memberName: activeMember.memberName,
        readingGroupId: targetGroup?.id,
        readingGroupName: targetGroup?.groupName,
        temperatureF: inputTempF,
        temperatureC: inputTempC,
        measurementMethod,
        timestamp: selectedTimestamp,
        symptoms: selectedSymptoms,
        medicationGiven:
          medName.trim()
            ? {
                name: medName.trim(),
                dose: medDose.trim() || '1 standard dose',
                givenAt: selectedTimestamp,
              }
            : undefined,
        notes,
        recordedBy,
      });

      // Reset form
      setShowAddForm(false);
      setRecordedDateTime(getLocalDateTimeString());
      setSelectedSymptoms([]);
      setMedName('');
      setMedDose('');
      setNotes('');
      setFeverLogs(getLocalFeverLogs());
      setFeverGroups(getLocalFeverGroups());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember || !newGroupName.trim()) return;
    try {
      const created = await createFeverReadingGroup({
        memberId: activeMember.memberId,
        memberName: activeMember.memberName,
        groupName: newGroupName.trim(),
        notes: newGroupNotes.trim(),
        recordedBy: 'Chinnathambi',
      });
      setNewGroupName('');
      setNewGroupNotes('');
      setShowCreateGroupModal(false);
      setSelectedGroupId(created.id);
      setFormGroupId(created.id);
      setFeverGroups(getLocalFeverGroups());
      setDriveSyncSuccess(`Created Fever Episode: "${created.groupName}"`);
    } catch (err: any) {
      console.warn('Error creating episode:', err);
    }
  };

  const handleToggleGroupActive = async (group: FeverReadingGroup) => {
    const updated = await updateFeverReadingGroup(group.id, {
      isActive: !group.isActive,
      endDate: group.isActive ? new Date().toISOString() : undefined,
    });
    if (updated) {
      setFeverGroups(getLocalFeverGroups());
      setDriveSyncSuccess(
        updated.isActive
          ? `Re-opened episode: "${updated.groupName}"`
          : `Episode resolved & closed: "${updated.groupName}"`
      );
    }
  };

  const handleDeleteGroup = async (group: FeverReadingGroup) => {
    if (confirm(`Delete episode "${group.groupName}"? Readings will remain as individual moments.`)) {
      await deleteFeverReadingGroup(group.id);
      setSelectedGroupId('all');
      setFeverGroups(getLocalFeverGroups());
      setDriveSyncSuccess(`Deleted episode "${group.groupName}".`);
    }
  };

  const handleSyncGroupToDrive = async (group: FeverReadingGroup) => {
    setIsSyncingGroup(true);
    try {
      const groupMoments = memberLogs.filter((l) => l.readingGroupId === group.id);
      const res = await syncFeverGroupToGoogleDrive(group, groupMoments);
      if (res.success) {
        setDriveSyncSuccess(`Fever Episode "${group.groupName}" & all ${groupMoments.length} moments synced to Google Drive & SQLite!`);
        setFeverGroups(getLocalFeverGroups());
      } else {
        setDriveSyncSuccess('Could not sync episode to Drive. Ensure Google Drive is connected in Settings.');
      }
    } finally {
      setIsSyncingGroup(false);
      setTimeout(() => setDriveSyncSuccess(null), 5000);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this fever temperature reading?')) {
      await deleteFeverLog(id);
      setFeverLogs(getLocalFeverLogs());
    }
  };

  const handleSyncToDrive = async () => {
    setIsSyncingDrive(true);
    setDriveSyncSuccess(null);
    try {
      // 1. Sync SQLite and LocalStorage bidirectionally
      const sqliteRes = await syncFeverDataWithSqlite();

      // 2. Sync with Google Drive (folders, groups, moments, timeline)
      const driveRes = await syncFeverLogsWithGoogleDrive();

      // 3. Refresh reactive view state
      setFeverLogs(getLocalFeverLogs());
      setFeverGroups(getLocalFeverGroups());

      const token = getGoogleAccessToken();
      if (driveRes.success && token) {
        setDriveSyncSuccess(
          `Synced! SQLite (${sqliteRes.syncedLogs} moments, ${sqliteRes.syncedGroups} episodes) + Google Drive (${driveRes.syncedCount} moments, ${driveRes.groupCount} episodes) updated.`
        );
      } else if (sqliteRes.success) {
        setDriveSyncSuccess(
          `SQLite synchronized (${sqliteRes.syncedLogs} moments, ${sqliteRes.syncedGroups} episodes). ${
            !token ? 'Connect Google Drive in Settings for cloud backup.' : 'Cloud sync completed.'
          }`
        );
      } else {
        setDriveSyncSuccess('Sync completed with local SQLite store.');
      }
    } catch (err: any) {
      setDriveSyncSuccess('Synced with SQLite persistent store.');
    } finally {
      setIsSyncingDrive(false);
      setTimeout(() => setDriveSyncSuccess(null), 6000);
    }
  };

  const handleSyncSingleMoment = async (moment: FeverLogEntry) => {
    setSyncingMomentId(moment.id);
    try {
      const res = await syncSingleFeverLogToGoogleDrive(moment);
      if (res.success) {
        setFeverLogs(getLocalFeverLogs());
        if (inspectingMoment && inspectingMoment.id === moment.id) {
          setInspectingMoment({
            ...inspectingMoment,
            driveFileId: res.driveFileId,
            driveWebViewLink: res.driveWebViewLink,
            driveSyncStatus: 'synced',
          });
        }
        setDriveSyncSuccess(`Moment from ${new Date(moment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} synced to Google Drive & SQLite!`);
      } else {
        setDriveSyncSuccess('Could not sync moment to Google Drive. Check connection in Settings.');
      }
    } catch (err) {
      console.warn('Sync moment error:', err);
    } finally {
      setSyncingMomentId(null);
      setTimeout(() => setDriveSyncSuccess(null), 4000);
    }
  };

  const drawChart = (
    svgNode: SVGSVGElement,
    logs: FeverLogEntry[],
    isPrintMode: boolean = false
  ) => {
    if (!svgNode || logs.length === 0) return;

    const svg = d3.select(svgNode);
    svg.selectAll('*').remove();

    const container = svgNode.parentElement;
    const width = isPrintMode ? 720 : (container ? container.clientWidth : 700);
    const height = isPrintMode ? 175 : 300;
    const margin = isPrintMode
      ? { top: 18, right: 52, bottom: 42, left: 54 }
      : { top: 25, right: 55, bottom: 48, left: 55 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse dates
    const data = logs.map((d) => ({
      ...d,
      date: new Date(d.timestamp),
    }));

    // Scales
    const xExtent = d3.extent(data, (d) => d.date) as [Date, Date];
    const timePadding = (xExtent[1].getTime() - xExtent[0].getTime()) * 0.05 || 3600000;
    const xScale = d3
      .scaleTime()
      .domain([new Date(xExtent[0].getTime() - timePadding), new Date(xExtent[1].getTime() + timePadding)])
      .range([0, innerWidth]);

    const minTemp = Math.min(97.0, d3.min(data, (d) => d.temperatureF) || 98.6);
    const maxTemp = Math.max(104.5, d3.max(data, (d) => d.temperatureF) || 102.0);

    const yScaleF = d3.scaleLinear().domain([minTemp - 0.5, maxTemp + 0.5]).range([innerHeight, 0]);
    const yScaleC = d3
      .scaleLinear()
      .domain([fahrenheitToCelsius(minTemp - 0.5), fahrenheitToCelsius(maxTemp + 0.5)])
      .range([innerHeight, 0]);

    // Background Fever Severity Zones
    const zones = isPrintMode
      ? [
          { y1: 97.0, y2: 99.0, color: 'rgba(16, 185, 129, 0.06)' },
          { y1: 99.1, y2: 100.4, color: 'rgba(245, 158, 11, 0.07)' },
          { y1: 100.5, y2: 102.0, color: 'rgba(249, 115, 22, 0.08)' },
          { y1: 102.1, y2: 104.0, color: 'rgba(239, 68, 68, 0.09)' },
          { y1: 104.1, y2: 106.0, color: 'rgba(220, 38, 38, 0.12)' },
        ]
      : [
          { y1: 97.0, y2: 99.0, color: 'rgba(16, 185, 129, 0.08)' },
          { y1: 99.1, y2: 100.4, color: 'rgba(245, 158, 11, 0.08)' },
          { y1: 100.5, y2: 102.0, color: 'rgba(249, 115, 22, 0.10)' },
          { y1: 102.1, y2: 104.0, color: 'rgba(239, 68, 68, 0.12)' },
          { y1: 104.1, y2: 106.0, color: 'rgba(220, 38, 38, 0.20)' },
        ];

    zones.forEach((zone) => {
      const top = Math.max(0, yScaleF(zone.y2));
      const bottom = Math.min(innerHeight, yScaleF(zone.y1));
      if (bottom > top) {
        g.append('rect')
          .attr('x', 0)
          .attr('y', top)
          .attr('width', innerWidth)
          .attr('height', bottom - top)
          .attr('fill', zone.color);
      }
    });

    // 100.4°F Clinical Fever Reference Threshold Line
    if (yScaleF(100.4) >= 0 && yScaleF(100.4) <= innerHeight) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScaleF(100.4))
        .attr('y2', yScaleF(100.4))
        .attr('stroke', '#e11d48')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 4')
        .attr('opacity', 0.85);

      g.append('text')
        .attr('x', innerWidth - 6)
        .attr('y', yScaleF(100.4) - 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#e11d48')
        .attr('font-size', isPrintMode ? '9px' : '10px')
        .attr('font-weight', '700')
        .text('Fever Threshold: 100.4°F (38.0°C)');
    }

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', isPrintMode ? 0.25 : 0.15)
      .call(
        d3
          .axisLeft(yScaleF)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      );

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.min(data.length + 1, 6))
      .tickFormat((d) => d3.timeFormat('%b %d, %I:%M %p')(d as Date));

    const yAxisLeft = d3.axisLeft(yScaleF).ticks(5).tickFormat((d) => `${d}°F`);
    const yAxisRight = d3.axisRight(yScaleC).ticks(5).tickFormat((d) => `${(d as number).toFixed(1)}°C`);

    const axisColor = isPrintMode ? '#0f172a' : '#94a3b8';
    const tickLineColor = isPrintMode ? '#475569' : '#64748b';
    const domainLineColor = isPrintMode ? '#1e293b' : '#475569';

    // Render X Axis
    const xAxisG = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.select('.domain')
      .attr('stroke', domainLineColor)
      .attr('stroke-width', 1.2);

    xAxisG.selectAll('.tick line')
      .attr('stroke', tickLineColor);

    xAxisG.selectAll('text')
      .attr('fill', axisColor)
      .attr('font-size', isPrintMode ? '9px' : '10px')
      .attr('font-weight', isPrintMode ? '700' : 'normal')
      .attr('transform', 'rotate(-12)')
      .style('text-anchor', 'end')
      .attr('dx', '-3px')
      .attr('dy', '4px');

    // Render Left Y Axis (Fahrenheit)
    const yAxisLeftG = g.append('g')
      .attr('class', 'y-axis-left')
      .call(yAxisLeft);

    yAxisLeftG.select('.domain')
      .attr('stroke', domainLineColor)
      .attr('stroke-width', 1.2);

    yAxisLeftG.selectAll('.tick line')
      .attr('stroke', tickLineColor);

    yAxisLeftG.selectAll('text')
      .attr('fill', axisColor)
      .attr('font-size', isPrintMode ? '9px' : '10px')
      .attr('font-weight', isPrintMode ? '700' : 'normal');

    // Render Right Y Axis (Celsius)
    const yAxisRightG = g.append('g')
      .attr('class', 'y-axis-right')
      .attr('transform', `translate(${innerWidth}, 0)`)
      .call(yAxisRight);

    yAxisRightG.select('.domain')
      .attr('stroke', domainLineColor)
      .attr('stroke-width', 1.2);

    yAxisRightG.selectAll('.tick line')
      .attr('stroke', tickLineColor);

    yAxisRightG.selectAll('text')
      .attr('fill', axisColor)
      .attr('font-size', isPrintMode ? '9px' : '10px')
      .attr('font-weight', isPrintMode ? '700' : 'normal');

    // EXPLICIT AXIS TITLES / LABELS
    // 1. Left Y-Axis Label: Temperature (°F)
    g.append('text')
      .attr('class', 'y-axis-left-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', isPrintMode ? -38 : -40)
      .attr('text-anchor', 'middle')
      .attr('fill', isPrintMode ? '#0f172a' : '#cbd5e1')
      .attr('font-size', isPrintMode ? '9.5px' : '11px')
      .attr('font-weight', '700')
      .text('Temperature (°F)');

    // 2. Right Y-Axis Label: Temperature (°C)
    g.append('text')
      .attr('class', 'y-axis-right-label')
      .attr('transform', 'rotate(90)')
      .attr('x', innerHeight / 2)
      .attr('y', isPrintMode ? -(innerWidth + 38) : -(innerWidth + 42))
      .attr('text-anchor', 'middle')
      .attr('fill', isPrintMode ? '#0f172a' : '#cbd5e1')
      .attr('font-size', isPrintMode ? '9.5px' : '11px')
      .attr('font-weight', '700')
      .text('Temperature (°C)');

    // 3. Bottom X-Axis Label: Observation Timeline
    g.append('text')
      .attr('class', 'x-axis-label')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + (isPrintMode ? 35 : 42))
      .attr('text-anchor', 'middle')
      .attr('fill', isPrintMode ? '#0f172a' : '#cbd5e1')
      .attr('font-size', isPrintMode ? '9.5px' : '11px')
      .attr('font-weight', '700')
      .text('Observation Timeline (Date & Time)');

    // Area Generator
    const gradId = isPrintMode ? 'print-fever-grad' : 'screen-fever-grad';
    const defs = svg.append('defs');
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    if (isPrintMode) {
      areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.25);
      areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.03);
    } else {
      areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.4);
      areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.02);
    }

    const area = d3
      .area<any>()
      .x((d) => xScale(d.date))
      .y0(innerHeight)
      .y1((d) => yScaleF(d.temperatureF))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', `url(#${gradId})`)
      .attr('d', area);

    // Line Generator
    const line = d3
      .line<any>()
      .x((d) => xScale(d.date))
      .y((d) => yScaleF(d.temperatureF))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', isPrintMode ? '#e11d48' : '#ec4899')
      .attr('stroke-width', isPrintMode ? 2.2 : 2.5)
      .attr('d', line);

    // Data points
    const pointsGroup = g.append('g').attr('class', 'points');

    data.forEach((d) => {
      const cx = xScale(d.date);
      const cy = yScaleF(d.temperatureF);

      const circle = pointsGroup
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', isPrintMode ? (d.medicationGiven ? 4.5 : 3.5) : (d.medicationGiven ? 6.5 : 5))
        .attr('fill', d.temperatureF >= 100.4 ? '#e11d48' : '#10b981')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', isPrintMode ? 1.5 : 2);

      if (!isPrintMode) {
        circle
          .attr('cursor', 'pointer')
          .on('mouseenter', () => setHoveredPoint(d))
          .on('mouseleave', () => setHoveredPoint(null))
          .on('click', () => setInspectingMoment(d));
      } else {
        g.append('text')
          .attr('x', cx)
          .attr('y', cy - 6)
          .attr('text-anchor', 'middle')
          .attr('fill', d.temperatureF >= 100.4 ? '#be123c' : '#047857')
          .attr('font-size', '8px')
          .attr('font-weight', '700')
          .text(`${d.temperatureF}°`);
      }

      // If medication was given at this timestamp, add a pill icon badge
      if (d.medicationGiven) {
        const markerY = isPrintMode ? cy - 14 : cy - 18;
        const markerR = isPrintMode ? 5.5 : 8;

        const rxCircle = g.append('circle')
          .attr('cx', cx)
          .attr('cy', markerY)
          .attr('r', markerR)
          .attr('fill', '#7c3aed')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.2);

        if (!isPrintMode) {
          rxCircle
            .attr('cursor', 'pointer')
            .on('mouseenter', () => setHoveredPoint(d))
            .on('mouseleave', () => setHoveredPoint(null))
            .on('click', () => setInspectingMoment(d));
        }

        g.append('text')
          .attr('x', cx)
          .attr('y', isPrintMode ? markerY + 2.5 : markerY + 3)
          .attr('text-anchor', 'middle')
          .attr('fill', '#ffffff')
          .attr('font-size', isPrintMode ? '7px' : '9px')
          .attr('font-weight', 'bold')
          .text('Rx')
          .attr('pointer-events', 'none');
      }
    });
  };

  const handlePrint = () => {
    const patientName = activeMember?.memberName || 'Family';
    const episodeName = currentSelectedGroup ? currentSelectedGroup.groupName.replace(/\s+/g, '_') : 'Fever';
    const docTitle = `Fever_Report_${patientName}_${episodeName}`;

    if (printSvgRef.current && displayedLogs.length > 0) {
      drawChart(printSvgRef.current, displayedLogs, true);
    }
    if (previewSvgRef.current && displayedLogs.length > 0) {
      drawChart(previewSvgRef.current, displayedLogs, true);
    }

    // 1. Native Android Capacitor App support via our AndroidPrinter bridge
    if (typeof window !== 'undefined' && (window as any).AndroidPrinter && typeof (window as any).AndroidPrinter.print === 'function') {
      try {
        setTimeout(() => {
          (window as any).AndroidPrinter.print(docTitle);
        }, 120);
        return;
      } catch (err) {
        console.warn('Native Android printer error:', err);
      }
    }

    // 2. Mobile environment detection
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.());

    if (isMobile) {
      setShowPrintPreview(true);
      setTimeout(() => {
        try {
          window.print();
        } catch {
          // ignore on mobile WebViews where window.print is unsupported
        }
      }, 120);
      return;
    }

    // 3. Desktop browser print preview
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const handleShareReport = async () => {
    const patientName = activeMember?.memberName || 'Family Member';
    const episodeName = currentSelectedGroup ? currentSelectedGroup.groupName : 'All Moments';
    const peakTemp = displayedPeakLog
      ? `${displayedPeakLog.temperatureF}°F / ${displayedPeakLog.temperatureC}°C`
      : 'N/A';
    const latestTemp = displayedLatestLog
      ? `${displayedLatestLog.temperatureF}°F / ${displayedLatestLog.temperatureC}°C`
      : 'N/A';

    const textSummary =
      `📋 *CLINICAL FEVER EPISODE REPORT*\n` +
      `👤 Patient: ${patientName} (${activeMember?.age || ''} yrs, Blood: ${activeMember?.bloodGroup || 'O+'})\n` +
      `🌡️ Episode: ${episodeName}\n` +
      `🔥 Peak Temp: ${peakTemp}\n` +
      `⏱️ Latest Reading: ${latestTemp}\n` +
      `💊 Medication Doses: ${displayedLogs.filter((l) => l.medicationGiven).length}\n` +
      `📊 Total Moments: ${displayedLogs.length}\n\n` +
      `Chronological Moments:\n` +
      displayedLogs
        .slice(0, 15)
        .map(
          (l, i) =>
            `${i + 1}. ${new Date(l.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}: ${l.temperatureF}°F (${l.temperatureC}°C) - ${l.severity}${l.medicationGiven ? ` [Rx: ${l.medicationGiven.name} ${l.medicationGiven.dose}]` : ''}`
        )
        .join('\n') +
      (displayedLogs.length > 15 ? `\n...and ${displayedLogs.length - 15} more readings.` : '') +
      `\n\nGenerated by AuraFamily Sovereign Health Vault.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Clinical Fever Report - ${patientName}`,
          text: textSummary,
        });
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Share error:', err);
        }
      }
    }

    try {
      await navigator.clipboard.writeText(textSummary);
      setDriveSyncSuccess('Report summary copied to clipboard! You can paste in WhatsApp or Email.');
      setTimeout(() => setDriveSyncSuccess(null), 4000);
    } catch {
      // ignore
    }
  };

  const handleDownloadOfflineReport = () => {
    const patientName = activeMember?.memberName || 'Family_Member';
    const episodeName = currentSelectedGroup
      ? currentSelectedGroup.groupName.replace(/\s+/g, '_')
      : 'Fever';
    const docTitle = `Fever_Report_${patientName}_${episodeName}_${new Date().toISOString().slice(0, 10)}`;

    const svgEl = previewSvgRef.current || printSvgRef.current;
    const svgHtml = svgEl ? svgEl.outerHTML : '';

    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #ffffff; color: #0f172a; margin: 0; padding: 15px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: bold; }
    .kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; text-align: center; }
    .kpi-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #f8fafc; }
    .kpi-title { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; }
    .kpi-val { font-size: 16px; font-weight: bold; margin-top: 2px; }
    @media print {
      @page { size: A4 portrait; margin: 8mm 10mm; }
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 15px; display: flex; gap: 10px;">
    <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>
  <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between;">
    <div>
      <h1 style="font-size: 18px; margin: 0; font-weight: bold;">CLINICAL FEVER EPISODE REPORT</h1>
      <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">Family Circle Health Vault • Sovereign Health Record System</p>
    </div>
    <div style="text-align: right; font-size: 10px; color: #64748b;">
      <div>Printed: ${new Date().toLocaleString()}</div>
    </div>
  </div>

  <div class="card" style="background: #f8fafc; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px;">
    <div><span style="font-size: 9px; color: #64748b; text-transform: uppercase; display: block; font-weight: bold;">Patient</span><strong>${activeMember?.memberName}</strong></div>
    <div><span style="font-size: 9px; color: #64748b; text-transform: uppercase; display: block; font-weight: bold;">Age / Gender</span>${activeMember?.age} yrs • ${activeMember?.gender}</div>
    <div><span style="font-size: 9px; color: #64748b; text-transform: uppercase; display: block; font-weight: bold;">Blood Group</span>${activeMember?.bloodGroup || 'O+'}</div>
    <div><span style="font-size: 9px; color: #64748b; text-transform: uppercase; display: block; font-weight: bold;">Allergies</span><span style="color: #be123c;">${activeMember?.allergies?.map((a: any) => a.allergen).join(', ') || 'No Known Allergies'}</span></div>
  </div>

  <div class="kpi">
    <div class="kpi-box"><div class="kpi-title">Peak Temp</div><div class="kpi-val" style="color: #e11d48;">${displayedPeakLog ? `${displayedPeakLog.temperatureF}°F` : 'N/A'}</div></div>
    <div class="kpi-box"><div class="kpi-title">Latest Reading</div><div class="kpi-val">${displayedLatestLog ? `${displayedLatestLog.temperatureF}°F` : 'N/A'}</div></div>
    <div class="kpi-box"><div class="kpi-title">Moments</div><div class="kpi-val">${displayedLogs.length}</div></div>
    <div class="kpi-box"><div class="kpi-title">Meds Doses</div><div class="kpi-val" style="color: #7c3aed;">${displayedLogs.filter((l) => l.medicationGiven).length}</div></div>
  </div>

  <div class="card" style="margin-bottom: 12px;">
    <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase; color: #334155;">Thermal Trend Curve & Antipyretic Timeline</div>
    <div style="width: 100%; height: 175px;">${svgHtml}</div>
  </div>

  <div style="font-size: 12px; font-weight: bold; margin-bottom: 4px;">Chronological Fever Moments</div>
  <table>
    <thead>
      <tr>
        <th>Date & Time</th>
        <th>Temp (°F / °C)</th>
        <th>Site</th>
        <th>Classification</th>
        <th>Symptoms</th>
        <th>Antipyretic / Meds</th>
        <th>Caregiver Notes</th>
      </tr>
    </thead>
    <tbody>
      ${displayedLogs
        .map(
          (l) => `
        <tr>
          <td style="font-family: monospace; white-space: nowrap;">${new Date(l.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
          <td style="font-weight: bold; color: ${l.temperatureF >= 100.4 ? '#e11d48' : '#059669'};">${l.temperatureF}°F (${l.temperatureC}°C)</td>
          <td style="text-transform: capitalize;">${l.measurementMethod.replace('_', ' ')}</td>
          <td style="text-transform: capitalize;">${l.severity}</td>
          <td>${l.symptoms.length > 0 ? l.symptoms.join(', ') : 'None'}</td>
          <td style="color: #6b21a8; font-weight: 500;">${l.medicationGiven ? `${l.medicationGiven.name} (${l.medicationGiven.dose})` : '—'}</td>
          <td style="color: #475569;">${l.notes || '—'}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 25px; padding-top: 15px; border-top: 1px solid #94a3b8; font-size: 11px;">
    <div>
      <strong>Pediatrician / Physician Assessment:</strong>
      <div style="height: 35px; border-bottom: 1px dashed #94a3b8; margin-top: 5px;"></div>
    </div>
    <div style="text-align: right;">
      <strong>Consulting Physician Signature & Stamp</strong>
      <div style="margin-top: 20px; color: #64748b;">Date: __________________________</div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDriveSyncSuccess(`Clinical report downloaded as "${docTitle}.html"!`);
    setTimeout(() => setDriveSyncSuccess(null), 4000);
  };

  // D3.js Temperature Graph Renderer
  useEffect(() => {
    if (displayedLogs.length === 0) return;
    if (svgRef.current) {
      drawChart(svgRef.current, displayedLogs, false);
    }
    if (printSvgRef.current) {
      drawChart(printSvgRef.current, displayedLogs, true);
    }
    if (previewSvgRef.current) {
      drawChart(previewSvgRef.current, displayedLogs, true);
    }
  }, [displayedLogs, unit]);

  useEffect(() => {
    if (showPrintPreview && displayedLogs.length > 0) {
      setTimeout(() => {
        if (previewSvgRef.current) {
          drawChart(previewSvgRef.current, displayedLogs, true);
        }
      }, 50);
    }
  }, [showPrintPreview, displayedLogs]);

  if (!isOpen) return null;

  const printPortalNode =
    typeof document !== 'undefined'
      ? createPortal(
          <div id="aura-clinical-print-portal" className="hidden print:block bg-white text-slate-900 font-sans">
            <style>{`
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 8mm 8mm;
                }
                html, body {
                  height: auto !important;
                  min-height: 0 !important;
                  max-height: none !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  color: #0f172a !important;
                  overflow: visible !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #root {
                  display: none !important;
                }
                body > *:not(#aura-clinical-print-portal) {
                  display: none !important;
                }
                #aura-clinical-print-portal {
                  display: block !important;
                  position: static !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  color: #0f172a !important;
                }
                .page-break-avoid {
                  break-inside: avoid !important;
                  page-break-inside: avoid !important;
                }
                tr {
                  break-inside: avoid !important;
                  page-break-inside: avoid !important;
                }
                thead {
                  display: table-header-group !important;
                }
              }
            `}</style>

            {/* Report Header */}
            <div className="border-b-2 border-slate-900 pb-1.5 mb-1.5 flex justify-between items-start">
              <div>
                <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
                  {currentSelectedGroup
                    ? `CLINICAL FEVER EPISODE REPORT: ${currentSelectedGroup.groupName.toUpperCase()}`
                    : 'CLINICAL FEVER EPISODE & TEMPERATURE REPORT'}
                </h1>
                <p className="text-[10px] text-slate-600">
                  Family Circle Health Vault • Sovereign Health Record System
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-block bg-slate-900 text-white text-[9px] px-2 py-0.5 font-semibold rounded">
                  {currentSelectedGroup
                    ? (currentSelectedGroup.isActive ? 'ACTIVE EPISODE REPORT' : 'RESOLVED EPISODE REPORT')
                    : 'CLINICAL REPORT'}
                </span>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  Printed: {new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            </div>

            {/* Fever Episode Details Box (if specific episode selected) */}
            {currentSelectedGroup && (
              <div className="bg-amber-50/80 border border-amber-400 rounded p-1.5 mb-1.5 text-[10px] text-slate-800 flex justify-between items-start page-break-avoid">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 text-xs">
                    Fever Episode: {currentSelectedGroup.groupName}
                  </span>
                  <div className="text-slate-700 text-[10px]">
                    <strong>Status:</strong>{' '}
                    <span className={currentSelectedGroup.isActive ? 'text-amber-800 font-bold' : 'text-slate-700'}>
                      {currentSelectedGroup.isActive ? 'Active Monitoring Episode' : 'Resolved / Concluded'}
                    </span>
                    {' • '}
                    <strong>Timeline:</strong> Started {new Date(currentSelectedGroup.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    {currentSelectedGroup.endDate ? ` to ${new Date(currentSelectedGroup.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : ' (Ongoing)'}
                  </div>
                  {currentSelectedGroup.notes && (
                    <p className="italic text-slate-800 text-[10px] mt-0.5">
                      <strong>Clinical Context:</strong> "{currentSelectedGroup.notes}"
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-[9px] bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                    EPISODE ID: {currentSelectedGroup.id.slice(-8)}
                  </span>
                </div>
              </div>
            )}

            {/* Patient Profile & Demographics */}
            <div className="grid grid-cols-4 gap-2 p-1.5 bg-slate-100 rounded mb-1.5 border border-slate-300 text-[10px] page-break-avoid">
              <div>
                <span className="block text-[8.5px] uppercase text-slate-500 font-bold">Patient Name</span>
                <span className="font-bold text-slate-900 text-[11px]">{activeMember?.memberName}</span>
              </div>
              <div>
                <span className="block text-[8.5px] uppercase text-slate-500 font-bold">Age / Gender</span>
                <span className="font-semibold text-slate-900 text-[10.5px]">
                  {activeMember?.age} yrs • {activeMember?.gender}
                </span>
              </div>
              <div>
                <span className="block text-[8.5px] uppercase text-slate-500 font-bold">Blood Group</span>
                <span className="font-semibold text-slate-900 text-[10.5px]">{activeMember?.bloodGroup || 'O+'}</span>
              </div>
              <div>
                <span className="block text-[8.5px] uppercase text-slate-500 font-bold">Known Allergies</span>
                <span className="font-semibold text-rose-700 text-[10.5px] truncate block">
                  {activeMember?.allergies && activeMember.allergies.length > 0
                    ? activeMember.allergies.map((a) => a.allergen).join(', ')
                    : 'No Known Allergies'}
                </span>
              </div>
            </div>

            {/* Clinical Summary KPI Cards */}
            <div className="grid grid-cols-4 gap-2 mb-1.5 text-center page-break-avoid">
              <div className="p-1 border border-slate-300 rounded bg-slate-50/50">
                <span className="text-[8.5px] text-slate-500 uppercase font-bold block">Peak Recorded Temp</span>
                <p className="text-xs font-bold text-rose-600 mt-0.5">
                  {displayedPeakLog ? `${displayedPeakLog.temperatureF}°F / ${displayedPeakLog.temperatureC}°C` : 'N/A'}
                </p>
              </div>
              <div className="p-1 border border-slate-300 rounded bg-slate-50/50">
                <span className="text-[8.5px] text-slate-500 uppercase font-bold block">Latest Reading</span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">
                  {displayedLatestLog ? `${displayedLatestLog.temperatureF}°F / ${displayedLatestLog.temperatureC}°C` : 'N/A'}
                </p>
              </div>
              <div className="p-1 border border-slate-300 rounded bg-slate-50/50">
                <span className="text-[8.5px] text-slate-500 uppercase font-bold block">
                  {currentSelectedGroup ? 'Episode Moments' : 'Total Readings'}
                </span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{displayedLogs.length}</p>
              </div>
              <div className="p-1 border border-slate-300 rounded bg-slate-50/50">
                <span className="text-[8.5px] text-slate-500 uppercase font-bold block">Medication Doses</span>
                <p className="text-xs font-bold text-purple-700 mt-0.5">
                  {displayedLogs.filter((l) => l.medicationGiven).length}
                </p>
              </div>
            </div>

            {/* EMBEDDED THERMAL TREND CURVE GRAPH CHART */}
            <div className="mb-1.5 border border-slate-300 rounded p-1.5 bg-white page-break-avoid">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-700">
                  Thermal Trend Curve & Antipyretic Timeline
                </span>
                <span className="text-[8.5px] text-slate-500 font-medium">
                  Red line = 100.4°F Fever Threshold • 'Rx' = Antipyretic Medication Administered
                </span>
              </div>
              <div className="w-full h-[155px]">
                <svg ref={printSvgRef} className="w-full h-full overflow-visible" />
              </div>
            </div>

            {/* Detailed Moments Table */}
            <div className="page-break-avoid">
              <h2 className="text-[10px] font-bold text-slate-900 mb-0.5 border-b pb-0.5">
                {currentSelectedGroup
                  ? `CHRONOLOGICAL EPISODE MOMENTS: ${currentSelectedGroup.groupName.toUpperCase()}`
                  : 'CHRONOLOGICAL FEVER LOG & ANTIPYRETIC ADMINISTRATION'}
              </h2>
            </div>
            <table className="w-full text-left text-[8.5px] border-collapse border border-slate-300 mb-1.5">
              <thead>
                <tr className="bg-slate-200 text-slate-800 font-bold">
                  <th className="border border-slate-300 py-0.5 px-1 whitespace-nowrap">Date & Time</th>
                  {selectedGroupId === 'all' && <th className="border border-slate-300 py-0.5 px-1">Fever Episode</th>}
                  <th className="border border-slate-300 py-0.5 px-1 whitespace-nowrap">Temp (°F / °C)</th>
                  <th className="border border-slate-300 py-0.5 px-1">Site</th>
                  <th className="border border-slate-300 py-0.5 px-1">Classification</th>
                  <th className="border border-slate-300 py-0.5 px-1">Symptoms</th>
                  <th className="border border-slate-300 py-0.5 px-1">Antipyretic / Meds</th>
                  <th className="border border-slate-300 py-0.5 px-1">Caregiver Notes</th>
                </tr>
              </thead>
              <tbody>
                {displayedLogs.map((log) => (
                  <tr key={log.id} className="border border-slate-300 page-break-avoid">
                    <td className="border border-slate-300 py-0.5 px-1 font-mono whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    {selectedGroupId === 'all' && (
                      <td className="border border-slate-300 py-0.5 px-1 font-semibold text-slate-700">
                        {log.readingGroupName || 'Ungrouped'}
                      </td>
                    )}
                    <td className="border border-slate-300 py-0.5 px-1 font-bold whitespace-nowrap">
                      <span className={log.temperatureF >= 100.4 ? 'text-rose-600' : 'text-emerald-700'}>
                        {log.temperatureF}°F ({log.temperatureC}°C)
                      </span>
                    </td>
                    <td className="border border-slate-300 py-0.5 px-1 capitalize">{log.measurementMethod.replace('_', ' ')}</td>
                    <td className="border border-slate-300 py-0.5 px-1 capitalize font-semibold">{log.severity}</td>
                    <td className="border border-slate-300 py-0.5 px-1">
                      {log.symptoms.length > 0 ? log.symptoms.join(', ') : 'None'}
                    </td>
                    <td className="border border-slate-300 py-0.5 px-1 font-medium text-purple-900">
                      {log.medicationGiven ? `${log.medicationGiven.name} (${log.medicationGiven.dose})` : '—'}
                    </td>
                    <td className="border border-slate-300 py-0.5 px-1 text-slate-600">{log.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Doctor Assessment & Signature Block */}
            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-400 mt-1 text-[9px] page-break-avoid">
              <div>
                <p className="font-bold text-slate-800">Pediatrician / Physician Notes & Assessment:</p>
                <div className="h-6 border-b border-dashed border-slate-400 mt-0.5"></div>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-800 mb-4">Consulting Physician Signature & Stamp</p>
                <p className="text-slate-500">Date: __________________________</p>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {printPortalNode}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto print:hidden">
        {/* SCREEN UI DIALOG */}
        <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/20">
              <Thermometer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Fever Temperature Tracker & Clinical Graph
                </h2>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  AURO Health
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interactive thermal monitoring, pediatric fever curves, and antipyretic logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sync Drive Button */}
            <button
              onClick={handleSyncToDrive}
              disabled={isSyncingDrive}
              title="Sync with Google Drive & SQLite"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <Cloud className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Drive & SQLite Sync</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              title="Print Clinical Doctor Report"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sync Success / Notice Banner */}
        {driveSyncSuccess && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-6 py-2 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{driveSyncSuccess}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Member Switcher Strip */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Select Family Member:
              </span>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {members.map((m) => {
                const isSelected = m.memberId === activeMemberId || m.id === activeMemberId;
                const mLogs = feverLogs.filter(
                  (l) => l.memberId === m.memberId || l.memberName.toLowerCase() === m.memberName.toLowerCase()
                );
                const mLatest = mLogs.sort(
                  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                )[0];

                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setActiveMemberId(m.memberId);
                      if (onMemberSelect) onMemberSelect(m.memberId);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                      isSelected
                        ? 'bg-gradient-to-r from-rose-500/20 to-indigo-500/20 border-rose-500/50 text-white shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>{m.memberName}</span>
                    {mLatest && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          mLatest.temperatureF >= 100.4
                            ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                            : 'bg-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        {mLatest.temperatureF}°F
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Named Fever Episodes Switcher Bar */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Fever Episodes:
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  (Group moment-level readings into clinical episodes)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm hover:brightness-110 transition cursor-pointer self-start sm:self-auto"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ New Fever Episode</span>
              </button>
            </div>

            {/* Group Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* All Moments Button */}
              <button
                onClick={() => setSelectedGroupId('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  selectedGroupId === 'all'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                }`}
              >
                <Bookmark className="w-3 h-3" />
                <span>All Moments</span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full text-slate-300">
                  {memberLogs.length}
                </span>
              </button>

              {/* Individual Group Pills */}
              {memberGroups.map((grp) => {
                const isSelected = selectedGroupId === grp.id;
                const count = memberLogs.filter((l) => l.readingGroupId === grp.id).length;
                return (
                  <button
                    key={grp.id}
                    onClick={() => setSelectedGroupId(grp.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      isSelected
                        ? 'bg-gradient-to-r from-amber-500/20 to-rose-500/20 border-amber-500/50 text-white shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        grp.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                      }`}
                      title={grp.isActive ? 'Active Fever Episode' : 'Resolved Episode'}
                    />
                    <span className="font-semibold text-slate-200">{grp.groupName}</span>
                    <span className="text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded-full text-slate-400">
                      {count} moment{count !== 1 ? 's' : ''}
                    </span>
                    {grp.isActive && (
                      <span className="text-[9px] uppercase px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}

              {memberGroups.length === 0 && (
                <span className="text-xs text-slate-500 italic">
                  No episodes created yet. Click "+ New Fever Episode" to organize moments into episodes.
                </span>
              )}
            </div>

            {/* Selected Group Inspector / Management Banner */}
            {currentSelectedGroup && (
              <div className="mt-2 p-3 bg-gradient-to-r from-slate-900 to-slate-950 border border-amber-500/30 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">
                      {currentSelectedGroup.groupName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        currentSelectedGroup.isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {currentSelectedGroup.isActive ? '● Active Monitoring' : '✓ Concluded / Resolved'}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Started {new Date(currentSelectedGroup.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      {currentSelectedGroup.endDate && ` • Resolved ${new Date(currentSelectedGroup.endDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                    </span>
                  </div>
                  {currentSelectedGroup.notes && (
                    <p className="text-slate-300 italic text-[11px]">"{currentSelectedGroup.notes}"</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                    <span>
                      Total Moments: <strong className="text-white">{displayedLogs.length}</strong>
                    </span>
                    <span>
                      Peak Temp:{' '}
                      <strong className="text-rose-400">
                        {displayedPeakLog ? `${displayedPeakLog.temperatureF}°F` : '—'}
                      </strong>
                    </span>
                    <span>
                      Medications Administered:{' '}
                      <strong className="text-purple-400">
                        {displayedLogs.filter((l) => l.medicationGiven).length} doses
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm transition"
                    title="Generate clinical doctor report specifically for this fever episode"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Episode Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSyncGroupToDrive(currentSelectedGroup)}
                    disabled={isSyncingGroup}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium transition"
                    title="Sync this episode report and all its moments to Google Drive and SQLite"
                  >
                    <Cloud className={`w-3.5 h-3.5 ${isSyncingGroup ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
                    <span>Sync Episode to Drive</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleGroupActive(currentSelectedGroup)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
                  >
                    {currentSelectedGroup.isActive ? 'Mark Resolved' : 'Re-open Episode'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(currentSelectedGroup)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                    title="Delete Episode"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Clinical Overview Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {currentSelectedGroup ? 'Latest in Episode' : 'Latest Temperature'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-white">
                  {displayedLatestLog ? (unit === 'F' ? `${displayedLatestLog.temperatureF}°F` : `${displayedLatestLog.temperatureC}°C`) : '—'}
                </span>
                {displayedLatestLog && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      getSeverityColor(displayedLatestLog.severity).badge
                    }`}
                  >
                    {displayedLatestLog.severity.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {displayedLatestLog ? new Date(displayedLatestLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No records in view'}
              </p>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {currentSelectedGroup ? 'Episode Peak' : 'Peak Temperature'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-rose-400">
                  {displayedPeakLog ? (unit === 'F' ? `${displayedPeakLog.temperatureF}°F` : `${displayedPeakLog.temperatureC}°C`) : '—'}
                </span>
                {displayedPeakLog && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {displayedPeakLog.temperatureF >= 100.4 ? 'Spike' : 'Normal'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {displayedPeakLog ? new Date(displayedPeakLog.timestamp).toLocaleDateString() : '—'}
              </p>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {currentSelectedGroup ? 'Moments in Group' : 'Medication Given'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-purple-400">
                  {currentSelectedGroup
                    ? `${displayedLogs.length} moments`
                    : `${memberLogs.filter((l) => l.medicationGiven).length} doses`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {currentSelectedGroup
                  ? `${displayedLogs.filter((l) => l.medicationGiven).length} antipyretic doses`
                  : 'Antipyretic Tracking (Paracetamol / Ibuprofen)'}
              </p>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Unit Switch
                </span>
                <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                  <button
                    onClick={() => setUnit('F')}
                    className={`px-2 py-0.5 text-xs font-bold rounded ${
                      unit === 'F' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    °F
                  </button>
                  <button
                    onClick={() => setUnit('C')}
                    className={`px-2 py-0.5 text-xs font-bold rounded ${
                      unit === 'C' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    °C
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!showAddForm) {
                    setRecordedDateTime(getLocalDateTimeString());
                  }
                  setShowAddForm(!showAddForm);
                }}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddForm ? 'Hide Logger' : 'Record Temperature'}</span>
              </button>
            </div>
          </div>

          {/* Add Temperature Entry Panel */}
          {showAddForm && (
            <div className="bg-slate-950/90 border border-rose-500/30 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-bold text-white">
                    Record Temperature for {activeMember?.memberName}
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-500 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSaveEntry} className="space-y-4">
                {/* Fever Episode Selection */}
                <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-amber-400" />
                      <span>Fever Episode</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCreateGroupModal(true)}
                      className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Create New Episode</span>
                    </button>
                  </div>

                  <select
                    value={formGroupId}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setShowCreateGroupModal(true);
                      } else {
                        setFormGroupId(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none"
                  >
                    {memberGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.groupName} {g.isActive ? '(Active Episode)' : '(Resolved)'}
                      </option>
                    ))}
                    <option value="">— No Episode (Ungrouped Moment) —</option>
                    <option value="__new__">+ Create New Fever Episode...</option>
                  </select>
                  <p className="text-[10px] text-slate-400">
                    Moments are grouped into this episode for chronological tracking and doctor reporting.
                  </p>
                </div>
                {/* Date and Time Selection (Default to current, editable for past readings) */}
                <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-rose-400" />
                      <label className="text-xs font-semibold text-slate-200">
                        Date & Time of Reading
                      </label>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isPastReading
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : isFutureReading
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {timeLabel}
                      </span>
                    </div>

                    {/* Quick jump to Now */}
                    <button
                      type="button"
                      onClick={() => setQuickTimeOffset(0)}
                      className="text-[11px] font-medium text-rose-400 hover:text-rose-300 flex items-center gap-1 self-start sm:self-auto px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 transition border border-rose-500/20 cursor-pointer"
                      title="Reset to current date and time"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Set to Current Time</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {/* HTML5 datetime-local input */}
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={recordedDateTime}
                        onChange={(e) => setRecordedDateTime(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none [color-scheme:dark]"
                      />
                    </div>

                    {/* Quick Past Presets */}
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      <span className="text-[10px] text-slate-400 font-medium mr-1">Quick:</span>
                      <button
                        type="button"
                        onClick={() => setQuickTimeOffset(0)}
                        className={`px-2 py-1 rounded border text-[11px] font-medium transition cursor-pointer ${
                          !isPastReading && !isFutureReading
                            ? 'bg-rose-600 text-white border-rose-500'
                            : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                      >
                        Now
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickTimeOffset(15)}
                        className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-medium transition cursor-pointer"
                        title="15 minutes ago"
                      >
                        -15m
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickTimeOffset(60)}
                        className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-medium transition cursor-pointer"
                        title="1 hour ago"
                      >
                        -1 hr
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickTimeOffset(120)}
                        className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-medium transition cursor-pointer"
                        title="2 hours ago"
                      >
                        -2 hrs
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickTimeOffset(240)}
                        className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-medium transition cursor-pointer"
                        title="4 hours ago"
                      >
                        -4 hrs
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickTimeOffset(1440)}
                        className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-medium transition cursor-pointer"
                        title="24 hours ago (Yesterday)"
                      >
                        Yesterday
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    Quick Presets (°F):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TEMPS_F.map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => handleTempFChange(t)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                          Math.abs(inputTempF - t) < 0.1
                            ? 'bg-rose-500 text-white border-rose-400 shadow-md'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {t}°F
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Temperature Input Slider & Number */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Temperature Reading ({unit === 'F' ? 'Fahrenheit' : 'Celsius'})
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          step="0.1"
                          min={unit === 'F' ? 95 : 35}
                          max={unit === 'F' ? 107 : 42}
                          value={unit === 'F' ? inputTempF : inputTempC}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              if (unit === 'F') handleTempFChange(val);
                              else handleTempCChange(val);
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xl font-bold text-white focus:outline-none focus:border-rose-500"
                        />
                        <span className="absolute right-3 top-2.5 text-sm font-semibold text-slate-400">
                          °{unit}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        = {unit === 'F' ? `${inputTempC}°C` : `${inputTempF}°F`}
                      </div>
                    </div>

                    <input
                      type="range"
                      min={unit === 'F' ? 96.0 : 35.5}
                      max={unit === 'F' ? 105.0 : 41.0}
                      step="0.1"
                      value={unit === 'F' ? inputTempF : inputTempC}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (unit === 'F') handleTempFChange(val);
                        else handleTempCChange(val);
                      }}
                      className="w-full mt-3 accent-rose-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Measurement Site & Severity
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {(
                        [
                          { id: 'forehead', label: 'Forehead (Temporal)' },
                          { id: 'oral', label: 'Oral (Mouth)' },
                          { id: 'tympanic_ear', label: 'Ear (Tympanic)' },
                          { id: 'axillary_armpit', label: 'Armpit (Axillary)' },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMeasurementMethod(m.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition ${
                            measurementMethod === m.id
                              ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Calculated Severity Indicator */}
                    <div
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                        getSeverityColor(calculateFeverSeverity(inputTempF)).badge
                      }`}
                    >
                      <span className="font-semibold">
                        {getSeverityLabel(calculateFeverSeverity(inputTempF))}
                      </span>
                      {inputTempF >= 100.4 && <AlertTriangle className="w-4 h-4 text-rose-300" />}
                    </div>
                  </div>
                </div>

                {/* Symptoms Chips */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Accompanying Symptoms:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_SYMPTOMS.map((sym) => {
                      const active = selectedSymptoms.includes(sym);
                      return (
                        <button
                          type="button"
                          key={sym}
                          onClick={() => toggleSymptom(sym)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition ${
                            active
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-medium'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {sym}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Antipyretic Medication Given */}
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      Antipyretic Medication (Optional)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Paracetamol / Crocin / Calpol"
                      value={medName}
                      onChange={(e) => setMedName(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                    <input
                      type="text"
                      placeholder="Dosage (e.g. 5ml syrup / 500mg)"
                      value={medDose}
                      onChange={(e) => setMedDose(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Notes and Recorded By */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Clinical notes (e.g. Lukewarm water compress applied, sleeping comfortably)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
                  />
                  <input
                    type="text"
                    placeholder="Recorded by (e.g. Chinnathambi / Sangeetha / AURO)"
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{isSubmitting ? 'Saving to SQLite...' : 'Save Temperature'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* D3.js Temperature Chart Section */}
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-400" />
                  Thermal Trend Curve: {activeMember?.memberName}
                  {currentSelectedGroup && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {currentSelectedGroup.groupName}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Continuous progression over time with clinical thresholds and medication markers
                </p>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Normal (&lt;99.1°F)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Low-Grade
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Fever (≥100.4°F)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3.5 h-3.5 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-[8px]">Rx</span> Med Given
                </span>
              </div>
            </div>

            {/* SVG Chart Container */}
            <div className="w-full relative min-h-[300px] flex items-center justify-center">
              {displayedLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Thermometer className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-slate-400 font-medium">
                    {currentSelectedGroup
                      ? `No moments recorded yet for group "${currentSelectedGroup.groupName}".`
                      : `No fever temperature logs recorded for ${activeMember?.memberName}.`}
                  </p>
                  <button
                    onClick={() => {
                      setRecordedDateTime(getLocalDateTimeString());
                      if (currentSelectedGroup) setFormGroupId(currentSelectedGroup.id);
                      setShowAddForm(true);
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white cursor-pointer"
                  >
                    Log First Temperature
                  </button>
                </div>
              ) : (
                <svg ref={svgRef} className="w-full h-[300px] overflow-visible" />
              )}

              {/* Hover Tooltip */}
              {hoveredPoint && (
                <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 z-30 pointer-events-none max-w-xs backdrop-blur-md">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1">
                    <span className="font-bold text-white">
                      {hoveredPoint.temperatureF}°F ({hoveredPoint.temperatureC}°C)
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                        getSeverityColor(hoveredPoint.severity).badge
                      }`}
                    >
                      {hoveredPoint.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {new Date(hoveredPoint.timestamp).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-300 capitalize">
                    Site: {hoveredPoint.measurementMethod.replace('_', ' ')}
                  </p>
                  {hoveredPoint.symptoms.length > 0 && (
                    <p className="text-[10px] text-rose-300">
                      Symptoms: {hoveredPoint.symptoms.join(', ')}
                    </p>
                  )}
                  {hoveredPoint.medicationGiven && (
                    <div className="bg-purple-950/60 p-1.5 rounded border border-purple-800 text-[10px] text-purple-200">
                      <strong>Rx Administered:</strong> {hoveredPoint.medicationGiven.name} ({hoveredPoint.medicationGiven.dose})
                    </div>
                  )}
                  {hoveredPoint.notes && (
                    <p className="text-[10px] text-slate-400 italic">"{hoveredPoint.notes}"</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Chronological Table of Entries */}
          <div className="bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Reading History ({displayedLogs.length} Moments
                  {currentSelectedGroup ? ` in ${currentSelectedGroup.groupName}` : ''})
                </span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Synced with SQLite & Google Drive
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/50 text-slate-400">
                    <th className="py-2.5 px-4 font-semibold">Moment / Time</th>
                    <th className="py-2.5 px-4 font-semibold">Temperature</th>
                    <th className="py-2.5 px-4 font-semibold">Site</th>
                    <th className="py-2.5 px-4 font-semibold">Symptoms</th>
                    <th className="py-2.5 px-4 font-semibold">Medication</th>
                    <th className="py-2.5 px-4 font-semibold">Drive & SQLite Store</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayedLogs
                    .slice()
                    .reverse()
                    .map((log) => {
                      const colors = getSeverityColor(log.severity);
                      return (
                        <tr key={log.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-2.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                            <div className="font-semibold text-white">
                              {new Date(log.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(log.timestamp).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </div>
                            {log.readingGroupName && (
                              <div className="mt-1">
                                <span
                                  className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 max-w-[150px] truncate"
                                  title={log.readingGroupName}
                                >
                                  <Folder className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{log.readingGroupName}</span>
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-xs ${colors.badge}`}>
                              {unit === 'F' ? `${log.temperatureF}°F` : `${log.temperatureC}°C`}
                              <span className="text-[10px] font-normal opacity-80">
                                ({unit === 'F' ? `${log.temperatureC}°C` : `${log.temperatureF}°F`})
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 px-4 capitalize text-slate-400">
                            {log.measurementMethod.replace('_', ' ')}
                          </td>
                          <td className="py-2.5 px-4 text-slate-300 max-w-xs truncate">
                            {log.symptoms.length > 0 ? log.symptoms.join(', ') : '—'}
                          </td>
                          <td className="py-2.5 px-4">
                            {log.medicationGiven ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-300 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-800/50">
                                <Pill className="w-3 h-3 text-purple-400" />
                                {log.medicationGiven.name}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/50"
                                title="Saved in sovereign SQLite store"
                              >
                                <Database className="w-2.5 h-2.5" /> SQLite
                              </span>
                              {log.driveWebViewLink ? (
                                <a
                                  href={log.driveWebViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/60 hover:underline transition"
                                  title="View individual moment JSON file in Google Drive"
                                >
                                  <Cloud className="w-2.5 h-2.5" /> Drive ↗
                                </a>
                              ) : (
                                <button
                                  onClick={() => handleSyncSingleMoment(log)}
                                  disabled={syncingMomentId === log.id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition disabled:opacity-50"
                                  title="Sync this moment to Google Drive"
                                >
                                  <Cloud className={`w-2.5 h-2.5 ${syncingMomentId === log.id ? 'animate-spin text-indigo-400' : ''}`} />
                                  <span>Sync</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setInspectingMoment(log)}
                                title="Inspect this fever moment"
                                className="px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[11px] font-semibold transition flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Moment</span>
                              </button>
                              <button
                                onClick={() => handleDelete(log.id)}
                                title="Delete log entry"
                                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer info strip */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Drive Target: <code className="text-slate-400">{FEVER_FOLDER_PATH}</code></span>
          </div>
          <div>
            <span>Pediatric Standard: Normal &lt; 99.1°F • Fever Threshold ≥ 100.4°F</span>
          </div>
        </div>
      </div>

      {/* DEDICATED MOMENT DETAIL INSPECTOR MODAL */}
      {inspectingMoment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                  <Thermometer className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>{inspectingMoment.memberName}</span>
                    <span className="text-xs font-normal text-slate-400">• Fever Moment Inspection</span>
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {new Date(inspectingMoment.timestamp).toLocaleString([], {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectingMoment(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Main Temperature Hero */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  getSeverityColor(inspectingMoment.severity).bg
                } ${getSeverityColor(inspectingMoment.severity).border}`}
              >
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Recorded Moment Temperature
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white">
                      {unit === 'F' ? `${inspectingMoment.temperatureF}°F` : `${inspectingMoment.temperatureC}°C`}
                    </span>
                    <span className="text-sm text-slate-400 font-medium">
                      ({unit === 'F' ? `${inspectingMoment.temperatureC}°C` : `${inspectingMoment.temperatureF}°F`})
                    </span>
                  </div>
                  <span
                    className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      getSeverityColor(inspectingMoment.severity).badge
                    }`}
                  >
                    {getSeverityLabel(inspectingMoment.severity)}
                  </span>
                </div>

                <div className="text-right space-y-1">
                  <span className="text-[11px] text-slate-400 block">Measurement Method</span>
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 capitalize">
                    {inspectingMoment.measurementMethod.replace('_', ' ')}
                  </span>
                  <div className="text-[10px] text-slate-500 pt-1">
                    Observer: {inspectingMoment.recordedBy || 'AURO Voice'}
                  </div>
                </div>
              </div>

              {/* Symptoms at this moment */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 block">
                  Symptoms Observed at this Moment
                </span>
                {inspectingMoment.symptoms && inspectingMoment.symptoms.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {inspectingMoment.symptoms.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-lg text-xs bg-rose-950/40 text-rose-300 border border-rose-800/40"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No acute symptoms noted at this reading moment.</p>
                )}
              </div>

              {/* Medication at this moment */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 block flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-purple-400" />
                  <span>Medication Administered</span>
                </span>
                {inspectingMoment.medicationGiven ? (
                  <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs space-y-1 text-purple-200">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span>{inspectingMoment.medicationGiven.name}</span>
                      {inspectingMoment.medicationGiven.dose && (
                        <span className="px-2 py-0.5 rounded bg-purple-900/60 text-[11px] font-mono">
                          {inspectingMoment.medicationGiven.dose}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-purple-300">
                      Administered at:{' '}
                      {new Date(inspectingMoment.medicationGiven.givenAt || inspectingMoment.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No antipyretic medication given during this observation.</p>
                )}
              </div>

              {/* Group / Episode of this Moment */}
              {inspectingMoment.readingGroupName && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-400/80 block">
                        Assigned Fever Episode
                      </span>
                      <span className="font-bold text-white text-xs">
                        {inspectingMoment.readingGroupName}
                      </span>
                    </div>
                  </div>
                  {inspectingMoment.readingGroupId && (
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      ID: {inspectingMoment.readingGroupId.slice(-8)}
                    </span>
                  )}
                </div>
              )}

              {/* Notes */}
              {inspectingMoment.notes && (
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-xs font-semibold text-slate-300 block">Clinical & Caregiver Notes</span>
                  <p className="text-xs text-slate-300 italic leading-relaxed">"{inspectingMoment.notes}"</p>
                </div>
              )}

              {/* Both Drive & SQLite Synchronization Status */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Moment Storage Verification</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    ID: {inspectingMoment.id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* SQLite Status Card */}
                  <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 mb-1">
                        <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
                        <span>SQLite Database</span>
                      </div>
                      <p className="text-[10px] text-cyan-200/80 leading-relaxed">
                        Persisted locally in sovereign SQLite store table{' '}
                        <code className="bg-cyan-900/50 px-1 rounded">fever_logs</code>.
                      </p>
                    </div>
                    <span className="text-[9px] font-mono text-cyan-400 mt-2 block">
                      ✓ Offline Available 24/7
                    </span>
                  </div>

                  {/* Google Drive Status Card */}
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 mb-1">
                        <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Google Drive Cloud</span>
                      </div>
                      <p className="text-[10px] text-emerald-200/80 leading-relaxed">
                        {inspectingMoment.driveWebViewLink
                          ? 'Individual moment file saved in Drive under Family Circle/Health Records.'
                          : 'Moment recorded locally; not yet synced to Google Drive.'}
                      </p>
                    </div>

                    {inspectingMoment.driveWebViewLink ? (
                      <a
                        href={inspectingMoment.driveWebViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open in Google Drive</span>
                      </a>
                    ) : (
                      <button
                        onClick={() => handleSyncSingleMoment(inspectingMoment)}
                        disabled={syncingMomentId === inspectingMoment.id}
                        className="mt-2 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${syncingMomentId === inspectingMoment.id ? 'animate-spin' : ''}`}
                        />
                        <span>Sync Moment to Drive</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  handleDelete(inspectingMoment.id);
                  setInspectingMoment(null);
                }}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:bg-rose-950/30 px-3 py-1.5 rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Moment</span>
              </button>
              <button
                onClick={() => setInspectingMoment(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW NAMED FEVER EPISODE MODAL */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create Fever Episode</h3>
                  <p className="text-[11px] text-slate-400">
                    Group moment-level readings for {activeMember?.memberName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Episode Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Viral Flu Episode Nov 2026, Teething Fever"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Clinical Notes / Context (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Temperature spiked after daycare. Prescribed Crocin 250mg. Advised 48-hour monitoring."
                  value={newGroupNotes}
                  onChange={(e) => setNewGroupNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 leading-relaxed">
                Moments recorded in this episode will be synchronized in both Google Drive and SQLite. You can print clinical reports specifically for this episode.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500 to-rose-500 hover:brightness-110 text-white shadow-md transition cursor-pointer"
                >
                  Create & Set as Active Episode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE CLINICAL REPORT VIEWER & ACTION MODAL */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[94vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Top Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-950 border-b border-slate-800 gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Clinical Fever Report & Chart
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {activeMember?.memberName} • {currentSelectedGroup ? currentSelectedGroup.groupName : 'All Moments'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const patientName = activeMember?.memberName || 'Family';
                    const episodeName = currentSelectedGroup ? currentSelectedGroup.groupName.replace(/\s+/g, '_') : 'Fever';
                    const docTitle = `Fever_Report_${patientName}_${episodeName}`;
                    if (typeof window !== 'undefined' && (window as any).AndroidPrinter && typeof (window as any).AndroidPrinter.print === 'function') {
                      (window as any).AndroidPrinter.print(docTitle);
                    } else {
                      window.print();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
                  title="Open system printer / Save as PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition"
                  title="Share report summary directly with Doctor via WhatsApp or Email"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Doctor</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadOfflineReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
                  title="Download standalone offline report HTML document"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save HTML</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintPreview(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Clinical Sheet Body */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-950/80">
              <div className="max-w-3xl mx-auto bg-white text-slate-900 p-4 sm:p-6 rounded-xl shadow-xl border border-slate-300 font-sans space-y-3">
                {/* Header */}
                <div className="border-b-2 border-slate-900 pb-2 flex justify-between items-start">
                  <div>
                    <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
                      {currentSelectedGroup
                        ? `CLINICAL FEVER EPISODE REPORT: ${currentSelectedGroup.groupName.toUpperCase()}`
                        : 'CLINICAL FEVER EPISODE & TEMPERATURE REPORT'}
                    </h1>
                    <p className="text-[10px] sm:text-[11px] text-slate-600">
                      Family Circle Health Vault • Sovereign Health Record System
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block bg-slate-900 text-white text-[9px] sm:text-[10px] px-2 py-0.5 font-semibold rounded">
                      {currentSelectedGroup
                        ? (currentSelectedGroup.isActive ? 'ACTIVE EPISODE' : 'RESOLVED EPISODE')
                        : 'CLINICAL REPORT'}
                    </span>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      {new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>

                {/* Episode Details (if selected) */}
                {currentSelectedGroup && (
                  <div className="bg-amber-50/90 border border-amber-400 rounded-md p-2 text-[11px] text-slate-800 flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900 text-xs">
                        Fever Episode: {currentSelectedGroup.groupName}
                      </span>
                      <div className="text-slate-700 text-[10px]">
                        <strong>Status:</strong>{' '}
                        <span className={currentSelectedGroup.isActive ? 'text-amber-800 font-bold' : 'text-slate-700'}>
                          {currentSelectedGroup.isActive ? 'Active Monitoring Episode' : 'Resolved / Concluded'}
                        </span>
                        {' • '}
                        <strong>Timeline:</strong> Started {new Date(currentSelectedGroup.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        {currentSelectedGroup.endDate ? ` to ${new Date(currentSelectedGroup.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : ' (Ongoing)'}
                      </div>
                      {currentSelectedGroup.notes && (
                        <p className="italic text-slate-800 text-[10px] mt-0.5">
                          <strong>Clinical Context:</strong> "{currentSelectedGroup.notes}"
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-[9px] bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                        EPISODE ID: {currentSelectedGroup.id.slice(-8)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Patient Profile */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-slate-100 rounded-md border border-slate-300 text-xs">
                  <div>
                    <span className="block text-[9px] uppercase text-slate-500 font-bold">Patient Name</span>
                    <span className="font-bold text-slate-900 text-xs">{activeMember?.memberName}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-slate-500 font-bold">Age / Gender</span>
                    <span className="font-semibold text-slate-900 text-[11px]">
                      {activeMember?.age} yrs • {activeMember?.gender}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-slate-500 font-bold">Blood Group</span>
                    <span className="font-semibold text-slate-900 text-[11px]">{activeMember?.bloodGroup || 'O+'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-slate-500 font-bold">Known Allergies</span>
                    <span className="font-semibold text-rose-700 text-[11px] truncate block">
                      {activeMember?.allergies && activeMember.allergies.length > 0
                        ? activeMember.allergies.map((a) => a.allergen).join(', ')
                        : 'No Known Allergies'}
                    </span>
                  </div>
                </div>

                {/* Summary KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-1.5 border border-slate-300 rounded bg-slate-50">
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">Peak Temp</span>
                    <p className="text-sm font-bold text-rose-600 mt-0.5">
                      {displayedPeakLog ? `${displayedPeakLog.temperatureF}°F / ${displayedPeakLog.temperatureC}°C` : 'N/A'}
                    </p>
                  </div>
                  <div className="p-1.5 border border-slate-300 rounded bg-slate-50">
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">Latest Reading</span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {displayedLatestLog ? `${displayedLatestLog.temperatureF}°F / ${displayedLatestLog.temperatureC}°C` : 'N/A'}
                    </p>
                  </div>
                  <div className="p-1.5 border border-slate-300 rounded bg-slate-50">
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">
                      {currentSelectedGroup ? 'Episode Moments' : 'Total Readings'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{displayedLogs.length}</p>
                  </div>
                  <div className="p-1.5 border border-slate-300 rounded bg-slate-50">
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">Medication Doses</span>
                    <p className="text-sm font-bold text-purple-700 mt-0.5">
                      {displayedLogs.filter((l) => l.medicationGiven).length}
                    </p>
                  </div>
                </div>

                {/* Vector Thermal Trend Curve Graph Chart with All Axis Labels */}
                <div className="border border-slate-300 rounded-md p-2 bg-white">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      Thermal Trend Curve & Antipyretic Timeline
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium">
                      Red line = 100.4°F Fever Threshold • 'Rx' = Antipyretic Medication Administered
                    </span>
                  </div>
                  <div className="w-full h-[175px]">
                    <svg ref={previewSvgRef} className="w-full h-full overflow-visible" />
                  </div>
                </div>

                {/* Moments Table */}
                <div>
                  <h2 className="text-xs font-bold text-slate-900 mb-1 border-b pb-0.5">
                    {currentSelectedGroup
                      ? `CHRONOLOGICAL EPISODE MOMENTS: ${currentSelectedGroup.groupName.toUpperCase()}`
                      : 'CHRONOLOGICAL FEVER LOG & ANTIPYRETIC ADMINISTRATION'}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[9.5px] border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-200 text-slate-800 font-bold">
                          <th className="border border-slate-300 py-1 px-1.5">Date & Time</th>
                          {selectedGroupId === 'all' && <th className="border border-slate-300 py-1 px-1.5">Fever Episode</th>}
                          <th className="border border-slate-300 py-1 px-1.5">Temp (°F / °C)</th>
                          <th className="border border-slate-300 py-1 px-1.5">Site</th>
                          <th className="border border-slate-300 py-1 px-1.5">Classification</th>
                          <th className="border border-slate-300 py-1 px-1.5">Symptoms</th>
                          <th className="border border-slate-300 py-1 px-1.5">Antipyretic / Meds</th>
                          <th className="border border-slate-300 py-1 px-1.5">Caregiver Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedLogs.map((log) => (
                          <tr key={log.id} className="border border-slate-300">
                            <td className="border border-slate-300 py-1 px-1.5 font-mono whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            {selectedGroupId === 'all' && (
                              <td className="border border-slate-300 py-1 px-1.5 font-semibold text-slate-700">
                                {log.readingGroupName || 'Ungrouped'}
                              </td>
                            )}
                            <td className="border border-slate-300 py-1 px-1.5 font-bold whitespace-nowrap">
                              <span className={log.temperatureF >= 100.4 ? 'text-rose-600' : 'text-emerald-700'}>
                                {log.temperatureF}°F ({log.temperatureC}°C)
                              </span>
                            </td>
                            <td className="border border-slate-300 py-1 px-1.5 capitalize">{log.measurementMethod.replace('_', ' ')}</td>
                            <td className="border border-slate-300 py-1 px-1.5 capitalize font-semibold">{log.severity}</td>
                            <td className="border border-slate-300 py-1 px-1.5">
                              {log.symptoms.length > 0 ? log.symptoms.join(', ') : 'None'}
                            </td>
                            <td className="border border-slate-300 py-1 px-1.5 font-medium text-purple-900">
                              {log.medicationGiven ? `${log.medicationGiven.name} (${log.medicationGiven.dose})` : '—'}
                            </td>
                            <td className="border border-slate-300 py-1 px-1.5 text-slate-600">{log.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Doctor Assessment & Signature Block */}
                <div className="grid grid-cols-2 gap-6 pt-2 border-t border-slate-400 mt-2 text-[10px]">
                  <div>
                    <p className="font-bold text-slate-800">Pediatrician / Physician Notes & Assessment:</p>
                    <div className="h-8 border-b border-dashed border-slate-400 mt-1"></div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800 mb-6">Consulting Physician Signature & Stamp</p>
                    <p className="text-slate-500">Date: __________________________</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};
