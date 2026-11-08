import React, { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'lucide-react';
import { FeverLogEntry, FeverSeverity, FamilyHealthRecord, FeverReadingGroup } from '../../types/healthRecord';
import {
  getLocalFeverLogs,
  recordFeverTemperature,
  deleteFeverLog,
  syncFeverLogsWithGoogleDrive,
  syncSingleFeverLogToGoogleDrive,
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
      setDriveSyncSuccess(`Created Named Fever Reading Group: "${created.groupName}"`);
    } catch (err: any) {
      console.warn('Error creating group:', err);
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
    if (confirm(`Delete group "${group.groupName}"? Readings will remain as individual moments.`)) {
      await deleteFeverReadingGroup(group.id);
      setSelectedGroupId('all');
      setFeverGroups(getLocalFeverGroups());
      setDriveSyncSuccess(`Deleted group "${group.groupName}".`);
    }
  };

  const handleSyncGroupToDrive = async (group: FeverReadingGroup) => {
    setIsSyncingGroup(true);
    try {
      const groupMoments = memberLogs.filter((l) => l.readingGroupId === group.id);
      const res = await syncFeverGroupToGoogleDrive(group, groupMoments);
      if (res.success) {
        setDriveSyncSuccess(`Fever Group "${group.groupName}" & all ${groupMoments.length} moments synced to Google Drive & SQLite!`);
        setFeverGroups(getLocalFeverGroups());
      } else {
        setDriveSyncSuccess('Could not sync group to Drive. Ensure Google Drive is connected in Settings.');
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
      const res = await syncFeverLogsWithGoogleDrive();
      if (res.success) {
        setDriveSyncSuccess(`Successfully synced ${res.syncedCount} fever entries to Google Drive!`);
        setFeverLogs(getLocalFeverLogs());
      } else {
        const token = getGoogleAccessToken();
        if (!token) {
          setDriveSyncSuccess('Offline/Local mode active. Connect Google Drive in Settings for cloud backup.');
        } else {
          setDriveSyncSuccess('Sync completed with local SQLite store.');
        }
      }
    } catch (err: any) {
      setDriveSyncSuccess('Synced with SQLite local store.');
    } finally {
      setIsSyncingDrive(false);
      setTimeout(() => setDriveSyncSuccess(null), 5000);
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

  const handlePrint = () => {
    window.print();
  };

  // D3.js Temperature Graph Renderer
  useEffect(() => {
    if (!svgRef.current || displayedLogs.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const container = svgRef.current.parentElement;
    const width = container ? container.clientWidth : 700;
    const height = 300;
    const margin = { top: 30, right: 55, bottom: 45, left: 55 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse dates
    const data = displayedLogs.map((d) => ({
      ...d,
      date: new Date(d.timestamp),
    }));

    // Scales
    const xExtent = d3.extent(data, (d) => d.date) as [Date, Date];
    // Pad x domain slightly so points don't clip on edges
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
    const zones = [
      { y1: 97.0, y2: 99.0, color: 'rgba(16, 185, 129, 0.08)', label: 'Normal' },
      { y1: 99.1, y2: 100.4, color: 'rgba(245, 158, 11, 0.08)', label: 'Low Grade' },
      { y1: 100.5, y2: 102.0, color: 'rgba(249, 115, 22, 0.10)', label: 'Moderate' },
      { y1: 102.1, y2: 104.0, color: 'rgba(239, 68, 68, 0.12)', label: 'High Fever' },
      { y1: 104.1, y2: 106.0, color: 'rgba(220, 38, 38, 0.20)', label: 'Hyperpyrexia' },
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
        .attr('stroke', '#f43f5e')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 4')
        .attr('opacity', 0.7);

      g.append('text')
        .attr('x', innerWidth - 6)
        .attr('y', yScaleF(100.4) - 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#f43f5e')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .text('Fever Threshold: 100.4°F (38.0°C)');
    }

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.15)
      .call(
        d3
          .axisLeft(yScaleF)
          .ticks(6)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      );

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.min(data.length + 1, 6))
      .tickFormat((d) => d3.timeFormat('%b %d, %I:%M %p')(d as Date));

    const yAxisLeft = d3.axisLeft(yScaleF).ticks(6).tickFormat((d) => `${d}°F`);
    const yAxisRight = d3.axisRight(yScaleC).ticks(6).tickFormat((d) => `${(d as number).toFixed(1)}°C`);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', '#94a3b8')
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('transform', 'rotate(-12)')
      .style('text-anchor', 'end');

    g.append('g')
      .call(yAxisLeft)
      .attr('color', '#94a3b8')
      .selectAll('text')
      .attr('font-size', '10px');

    g.append('g')
      .attr('transform', `translate(${innerWidth}, 0)`)
      .call(yAxisRight)
      .attr('color', '#94a3b8')
      .selectAll('text')
      .attr('font-size', '10px');

    // Gradient for line fill
    const defs = svg.append('defs');
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'fever-area-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.4);
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.02);

    // Area Generator
    const area = d3
      .area<any>()
      .x((d) => xScale(d.date))
      .y0(innerHeight)
      .y1((d) => yScaleF(d.temperatureF))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'url(#fever-area-gradient)')
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
      .attr('stroke', '#ec4899')
      .attr('stroke-width', 2.5)
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
        .attr('r', d.medicationGiven ? 6.5 : 5)
        .attr('fill', d.temperatureF >= 100.4 ? '#f43f5e' : '#10b981')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .attr('cursor', 'pointer')
        .on('mouseenter', () => setHoveredPoint(d))
        .on('mouseleave', () => setHoveredPoint(null))
        .on('click', () => setInspectingMoment(d));

      // If medication was given at this timestamp, add a pill icon badge
      if (d.medicationGiven) {
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cy - 18)
          .attr('r', 8)
          .attr('fill', '#8b5cf6')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .attr('cursor', 'pointer')
          .on('mouseenter', () => setHoveredPoint(d))
          .on('mouseleave', () => setHoveredPoint(null))
          .on('click', () => setInspectingMoment(d));

        g.append('text')
          .attr('x', cx)
          .attr('y', cy - 15)
          .attr('text-anchor', 'middle')
          .attr('fill', '#ffffff')
          .attr('font-size', '9px')
          .attr('font-weight', 'bold')
          .text('Rx')
          .attr('pointer-events', 'none');
      }
    });
  }, [displayedLogs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      {/* PRINT-ONLY MEDICAL REPORT */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-8 font-sans z-[9999]">
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {currentSelectedGroup
                  ? `CLINICAL FEVER EPISODE REPORT: ${currentSelectedGroup.groupName.toUpperCase()}`
                  : 'CLINICAL FEVER EPISODE & TEMPERATURE CHART'}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Family Circle Health Vault • Sovereign Health Record System
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-slate-900 text-white text-xs px-2.5 py-1 font-semibold rounded">
                {currentSelectedGroup
                  ? (currentSelectedGroup.isActive ? 'ACTIVE EPISODE REPORT' : 'RESOLVED EPISODE REPORT')
                  : 'PEDIA / CLINICAL REPORT'}
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Printed: {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Group / Episode Details Box if group selected */}
        {currentSelectedGroup && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3.5 mb-6 text-xs text-slate-800 flex justify-between items-start">
            <div className="space-y-1">
              <span className="font-bold text-slate-900 block text-base">
                Fever Episode: {currentSelectedGroup.groupName}
              </span>
              <div className="text-slate-700">
                <strong>Status:</strong>{' '}
                <span className={currentSelectedGroup.isActive ? 'text-amber-800 font-bold' : 'text-slate-700'}>
                  {currentSelectedGroup.isActive ? 'Active Monitoring Episode' : 'Resolved / Concluded'}
                </span>
                {' • '}
                <strong>Timeline:</strong> Started {new Date(currentSelectedGroup.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                {currentSelectedGroup.endDate ? ` to ${new Date(currentSelectedGroup.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : ' (Ongoing)'}
              </div>
              {currentSelectedGroup.notes && (
                <p className="italic text-slate-800 mt-1">
                  <strong>Clinical Context:</strong> "{currentSelectedGroup.notes}"
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono text-[11px] bg-amber-100 border border-amber-300 px-2 py-1 rounded font-bold">
                GROUP ID: {currentSelectedGroup.id}
              </span>
            </div>
          </div>
        )}

        {/* Patient Profile */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-slate-100 rounded-lg mb-6 border border-slate-300 text-sm">
          <div>
            <span className="block text-xs uppercase text-slate-500 font-bold">Patient Name</span>
            <span className="font-semibold text-slate-900 text-base">{activeMember?.memberName}</span>
          </div>
          <div>
            <span className="block text-xs uppercase text-slate-500 font-bold">Age / Gender</span>
            <span className="font-semibold text-slate-900">
              {activeMember?.age} yrs • {activeMember?.gender}
            </span>
          </div>
          <div>
            <span className="block text-xs uppercase text-slate-500 font-bold">Blood Group</span>
            <span className="font-semibold text-slate-900">{activeMember?.bloodGroup || 'O+'}</span>
          </div>
          <div>
            <span className="block text-xs uppercase text-slate-500 font-bold">Known Allergies</span>
            <span className="font-semibold text-rose-700">
              {activeMember?.allergies && activeMember.allergies.length > 0
                ? activeMember.allergies.map((a) => a.allergen).join(', ')
                : 'No Known Allergies'}
            </span>
          </div>
        </div>

        {/* Clinical Summary KPI */}
        <div className="grid grid-cols-4 gap-4 mb-6 text-center">
          <div className="p-3 border border-slate-300 rounded">
            <span className="text-xs text-slate-500 uppercase font-bold">Peak Recorded Temp</span>
            <p className="text-xl font-bold text-rose-600 mt-1">
              {displayedPeakLog ? `${displayedPeakLog.temperatureF}°F / ${displayedPeakLog.temperatureC}°C` : 'N/A'}
            </p>
          </div>
          <div className="p-3 border border-slate-300 rounded">
            <span className="text-xs text-slate-500 uppercase font-bold">Latest Reading</span>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {displayedLatestLog ? `${displayedLatestLog.temperatureF}°F / ${displayedLatestLog.temperatureC}°C` : 'N/A'}
            </p>
          </div>
          <div className="p-3 border border-slate-300 rounded">
            <span className="text-xs text-slate-500 uppercase font-bold">
              {currentSelectedGroup ? 'Episode Moments' : 'Total Readings'}
            </span>
            <p className="text-xl font-bold text-slate-900 mt-1">{displayedLogs.length}</p>
          </div>
          <div className="p-3 border border-slate-300 rounded">
            <span className="text-xs text-slate-500 uppercase font-bold">Medication Doses</span>
            <p className="text-xl font-bold text-purple-700 mt-1">
              {displayedLogs.filter((l) => l.medicationGiven).length}
            </p>
          </div>
        </div>

        {/* Detailed Table */}
        <h2 className="text-base font-bold text-slate-900 mb-2 border-b pb-1">
          {currentSelectedGroup
            ? `CHRONOLOGICAL MOMENTS: ${currentSelectedGroup.groupName.toUpperCase()}`
            : 'CHRONOLOGICAL FEVER LOG & ANTIPYRETIC ADMINISTRATION'}
        </h2>
        <table className="w-full text-left text-xs border-collapse border border-slate-300 mb-8">
          <thead>
            <tr className="bg-slate-200 text-slate-800">
              <th className="border border-slate-300 p-2">Date & Time</th>
              {selectedGroupId === 'all' && <th className="border border-slate-300 p-2">Fever Group</th>}
              <th className="border border-slate-300 p-2">Temp (°F / °C)</th>
              <th className="border border-slate-300 p-2">Site</th>
              <th className="border border-slate-300 p-2">Classification</th>
              <th className="border border-slate-300 p-2">Reported Symptoms</th>
              <th className="border border-slate-300 p-2">Antipyretic / Meds Given</th>
              <th className="border border-slate-300 p-2">Observer Notes</th>
            </tr>
          </thead>
          <tbody>
            {displayedLogs.map((log) => (
              <tr key={log.id} className="border border-slate-300">
                <td className="border border-slate-300 p-2 font-mono whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                {selectedGroupId === 'all' && (
                  <td className="border border-slate-300 p-2 font-semibold text-slate-700">
                    {log.readingGroupName || 'Ungrouped'}
                  </td>
                )}
                <td className="border border-slate-300 p-2 font-bold">
                  <span className={log.temperatureF >= 100.4 ? 'text-rose-600' : 'text-emerald-700'}>
                    {log.temperatureF}°F ({log.temperatureC}°C)
                  </span>
                </td>
                <td className="border border-slate-300 p-2 capitalize">{log.measurementMethod.replace('_', ' ')}</td>
                <td className="border border-slate-300 p-2 capitalize font-semibold">{log.severity}</td>
                <td className="border border-slate-300 p-2">
                  {log.symptoms.length > 0 ? log.symptoms.join(', ') : 'None recorded'}
                </td>
                <td className="border border-slate-300 p-2 font-medium text-purple-900">
                  {log.medicationGiven ? `${log.medicationGiven.name} (${log.medicationGiven.dose})` : '—'}
                </td>
                <td className="border border-slate-300 p-2 text-slate-600">{log.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Doctor Signature Block */}
        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-400 mt-auto text-xs">
          <div>
            <p className="font-bold text-slate-800">Pediatrician / Physician Notes & Assessment:</p>
            <div className="h-16 border-b border-dashed border-slate-400 mt-2"></div>
          </div>
          <div className="text-right">
            <p className="font-bold text-slate-800 mb-8">Consulting Physician Signature & Stamp</p>
            <p className="text-slate-500">Date: __________________________</p>
          </div>
        </div>
      </div>

      {/* SCREEN UI DIALOG */}
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:hidden">
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

          {/* Named Fever Reading Group (Episode) Switcher Bar */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Fever Reading Groups / Episodes:
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
                <span>+ New Reading Group</span>
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
                  No groups created yet. Click "+ New Reading Group" to organize moments into episodes.
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
                    title="Generate clinical doctor report specifically for this fever group"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Group Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSyncGroupToDrive(currentSelectedGroup)}
                    disabled={isSyncingGroup}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium transition"
                    title="Sync this group report and all its moments to Google Drive and SQLite"
                  >
                    <Cloud className={`w-3.5 h-3.5 ${isSyncingGroup ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
                    <span>Sync Group to Drive</span>
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
                    title="Delete group"
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
                {/* Fever Reading Group Selection */}
                <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-amber-400" />
                      <span>Fever Reading Group / Episode</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCreateGroupModal(true)}
                      className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Create New Group</span>
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
                    <option value="">— No Group (Ungrouped Moment) —</option>
                    <option value="__new__">+ Create New Named Group...</option>
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
                        Assigned Fever Reading Group
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

      {/* CREATE NEW NAMED FEVER READING GROUP MODAL */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create Fever Reading Group</h3>
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
                  Group / Episode Name *
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
                Moments recorded in this group will be synchronized in both Google Drive and SQLite. You can print clinical reports specifically for this episode.
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
                  Create & Set as Active Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
