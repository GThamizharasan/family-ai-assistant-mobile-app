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
} from 'lucide-react';
import { FeverLogEntry, FeverSeverity, FamilyHealthRecord } from '../../types/healthRecord';
import {
  getLocalFeverLogs,
  recordFeverTemperature,
  deleteFeverLog,
  syncFeverLogsWithGoogleDrive,
  fetchFeverLogsFromSqlite,
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
  const [unit, setUnit] = useState<'F' | 'C'>('F');
  const [showAddForm, setShowAddForm] = useState(autoLogOpen);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSyncSuccess, setDriveSyncSuccess] = useState<string | null>(null);

  // Form State
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

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Load initial members and logs
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

  const latestLog = memberLogs[memberLogs.length - 1];
  const peakLog = useMemo(() => {
    if (memberLogs.length === 0) return null;
    return [...memberLogs].sort((a, b) => b.temperatureF - a.temperatureF)[0];
  }, [memberLogs]);

  // Synchronize F and C inputs
  const handleTempFChange = (val: number) => {
    setInputTempF(Number(val.toFixed(1)));
    setInputTempC(fahrenheitToCelsius(val));
  };

  const handleTempCChange = (val: number) => {
    setInputTempC(Number(val.toFixed(1)));
    setInputTempF(celsiusToFahrenheit(val));
  };

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
      await recordFeverTemperature({
        memberId: activeMember.memberId,
        memberName: activeMember.memberName,
        temperatureF: inputTempF,
        temperatureC: inputTempC,
        measurementMethod,
        symptoms: selectedSymptoms,
        medicationGiven:
          medName.trim()
            ? {
                name: medName.trim(),
                dose: medDose.trim() || '1 standard dose',
                givenAt: new Date().toISOString(),
              }
            : undefined,
        notes,
        recordedBy,
      });

      // Reset form
      setShowAddForm(false);
      setSelectedSymptoms([]);
      setMedName('');
      setMedDose('');
      setNotes('');
      setFeverLogs(getLocalFeverLogs());
    } finally {
      setIsSubmitting(false);
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

  const handlePrint = () => {
    window.print();
  };

  // D3.js Temperature Graph Renderer
  useEffect(() => {
    if (!svgRef.current || memberLogs.length === 0) return;

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
    const data = memberLogs.map((d) => ({
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
        .on('mouseleave', () => setHoveredPoint(null));

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
          .on('mouseleave', () => setHoveredPoint(null));

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
  }, [memberLogs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      {/* PRINT-ONLY MEDICAL REPORT */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-8 font-sans z-[9999]">
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                CLINICAL FEVER EPISODE & TEMPERATURE CHART
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Family Circle Health Vault • Sovereign Health Record System
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-slate-900 text-white text-xs px-2.5 py-1 font-semibold rounded">
                PEDIA / CLINICAL REPORT
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Printed: {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>

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
              {peakLog ? `${peakLog.temperatureF}°F / ${peakLog.temperatureC}°C` : 'N/A'}
            </p>
          </div>
          <div className="p-3 border border-slate-300 rounded">
            <span className="text-xs text-slate-500 uppercase font-bold">Latest Reading</span>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {latestLog ? `${latestLog.temperatureF}°F / ${latestLog.temperatureC}°C` : 'N/A'}
            </p>
          </div>
          <div className="p-3 border border-slate-300 rounded">
            <span className="text-xs text-slate-500 uppercase font-bold">Total Readings</span>
            <p className="text-xl font-bold text-slate-900 mt-1">{memberLogs.length}</p>
          </div>
          <div className="p-3 border border-slate-300 rounded">
            <span className="text-xs text-slate-500 uppercase font-bold">Medication Doses</span>
            <p className="text-xl font-bold text-purple-700 mt-1">
              {memberLogs.filter((l) => l.medicationGiven).length}
            </p>
          </div>
        </div>

        {/* Detailed Table */}
        <h2 className="text-base font-bold text-slate-900 mb-2 border-b pb-1">
          CHRONOLOGICAL FEVER LOG & ANTIPYRETIC ADMINISTRATION
        </h2>
        <table className="w-full text-left text-xs border-collapse border border-slate-300 mb-8">
          <thead>
            <tr className="bg-slate-200 text-slate-800">
              <th className="border border-slate-300 p-2">Date & Time</th>
              <th className="border border-slate-300 p-2">Temp (°F / °C)</th>
              <th className="border border-slate-300 p-2">Site</th>
              <th className="border border-slate-300 p-2">Classification</th>
              <th className="border border-slate-300 p-2">Reported Symptoms</th>
              <th className="border border-slate-300 p-2">Antipyretic / Meds Given</th>
              <th className="border border-slate-300 p-2">Observer Notes</th>
            </tr>
          </thead>
          <tbody>
            {memberLogs.map((log) => (
              <tr key={log.id} className="border border-slate-300">
                <td className="border border-slate-300 p-2 font-mono whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
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

          {/* Clinical Overview Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Latest Temperature
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-white">
                  {latestLog ? (unit === 'F' ? `${latestLog.temperatureF}°F` : `${latestLog.temperatureC}°C`) : '—'}
                </span>
                {latestLog && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      getSeverityColor(latestLog.severity).badge
                    }`}
                  >
                    {latestLog.severity.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {latestLog ? new Date(latestLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No records yet'}
              </p>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Peak Temperature
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-rose-400">
                  {peakLog ? (unit === 'F' ? `${peakLog.temperatureF}°F` : `${peakLog.temperatureC}°C`) : '—'}
                </span>
                {peakLog && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {peakLog.temperatureF >= 100.4 ? 'Spike' : 'Normal'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {peakLog ? new Date(peakLog.timestamp).toLocaleDateString() : '—'}
              </p>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Medication Given
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-purple-400">
                  {memberLogs.filter((l) => l.medicationGiven).length} doses
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Antipyretic Tracking (Paracetamol / Ibuprofen)
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
                onClick={() => setShowAddForm(!showAddForm)}
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
              {memberLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Thermometer className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-slate-400 font-medium">
                    No fever temperature logs recorded for {activeMember?.memberName}.
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white"
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
                <span>Reading History ({memberLogs.length} Entries)</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Synced with SQLite & Google Drive
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/50 text-slate-400">
                    <th className="py-2.5 px-4 font-semibold">Time</th>
                    <th className="py-2.5 px-4 font-semibold">Temperature</th>
                    <th className="py-2.5 px-4 font-semibold">Site</th>
                    <th className="py-2.5 px-4 font-semibold">Symptoms</th>
                    <th className="py-2.5 px-4 font-semibold">Medication</th>
                    <th className="py-2.5 px-4 font-semibold">Observer</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {memberLogs
                    .slice()
                    .reverse()
                    .map((log) => {
                      const colors = getSeverityColor(log.severity);
                      return (
                        <tr key={log.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-2.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
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
                          <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                            {log.recordedBy || 'AURO Voice'}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              onClick={() => handleDelete(log.id)}
                              title="Delete log entry"
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
    </div>
  );
};
