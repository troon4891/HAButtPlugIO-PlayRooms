import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  StopCircle,
  Power,
  PowerOff,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  devices as devicesApi,
  engine as engineApi,
  protocols as protocolsApi,
  health,
  type DiscoveredDevice,
  type EngineStatus,
  type Protocol,
} from "../lib/api";

export default function Settings() {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({ running: false, clientConnected: false });
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);
  const [protocolList, setProtocolList] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [engineLoading, setEngineLoading] = useState(false);
  const [showDenied, setShowDenied] = useState(false);
  const [showProtocols, setShowProtocols] = useState(false);
  const [version, setVersion] = useState("");
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadEngineStatus = useCallback(async () => {
    try {
      const status = await engineApi.status();
      setEngineStatus(status);
      return status;
    } catch {
      return { running: false, clientConnected: false };
    }
  }, []);

  const loadDiscovered = useCallback(async () => {
    try {
      const data = await devicesApi.discovered();
      setDiscovered(data);
    } catch {
      // may fail if engine not running
    }
  }, []);

  const loadProtocols = useCallback(async () => {
    try {
      const data = await protocolsApi.list();
      setProtocolList(data);
    } catch (err) {
      console.error("Failed to load protocols:", err);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const [, , healthData] = await Promise.all([
          loadEngineStatus(),
          loadDiscovered(),
          health(),
        ]);
        setVersion(healthData.version);
        await loadProtocols();
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [loadEngineStatus, loadDiscovered, loadProtocols]);

  // Cleanup scan interval on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  async function handleStartEngine() {
    setEngineLoading(true);
    try {
      await engineApi.start();
      await loadEngineStatus();
    } catch (err) {
      console.error("Failed to start engine:", err);
    } finally {
      setEngineLoading(false);
    }
  }

  async function handleStopEngine() {
    setEngineLoading(true);
    try {
      // Stop scanning first if active
      if (scanning) {
        await devicesApi.stopScan();
        setScanning(false);
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
      }
      await engineApi.stop();
      setEngineStatus({ running: false, clientConnected: false });
    } catch (err) {
      console.error("Failed to stop engine:", err);
    } finally {
      setEngineLoading(false);
    }
  }

  async function handleStartScan() {
    try {
      await devicesApi.startScan();
      setScanning(true);
      // Refresh discovered list periodically while scanning
      scanIntervalRef.current = setInterval(async () => {
        await loadDiscovered();
      }, 2000);
      // Auto-stop after 30 seconds
      setTimeout(() => {
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        setScanning(false);
        loadDiscovered();
      }, 30000);
    } catch (err) {
      console.error("Scan failed:", err);
    }
  }

  async function handleStopScan() {
    try {
      await devicesApi.stopScan();
      setScanning(false);
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      await loadDiscovered();
    } catch (err) {
      console.error("Stop scan failed:", err);
    }
  }

  async function handleApprove(id: string) {
    try {
      await devicesApi.approve(id);
      await loadDiscovered();
    } catch (err) {
      console.error("Approve failed:", err);
    }
  }

  async function handleDeny(id: string) {
    try {
      await devicesApi.deny(id);
      await loadDiscovered();
    } catch (err) {
      console.error("Deny failed:", err);
    }
  }

  async function handleReset(id: string) {
    try {
      await devicesApi.reset(id);
      await loadDiscovered();
    } catch (err) {
      console.error("Reset failed:", err);
    }
  }

  async function handleToggleProtocol(name: string, enabled: boolean) {
    try {
      await protocolsApi.setEnabled(name, enabled);
      setProtocolList((prev) =>
        prev.map((p) => (p.protocolName === name ? { ...p, enabled } : p))
      );
    } catch (err) {
      console.error("Toggle protocol failed:", err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const pendingDevices = discovered.filter((d) => d.status === "pending");
  const approvedDevices = discovered.filter((d) => d.status === "approved");
  const deniedDevices = discovered.filter((d) => d.status === "denied");

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center gap-3 mb-8">
        <Link to="/" className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

      {/* Pillar 1: Engine Controls */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-3">Intiface Engine</h2>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${engineStatus.running ? "bg-green-400" : "bg-red-400"}`} />
          <div className="flex-1">
            <span className="font-medium">
              Engine: {engineStatus.running ? "Running" : "Stopped"}
            </span>
            <span className="text-slate-400 text-sm ml-3">
              Client: {engineStatus.clientConnected ? "Connected" : "Not connected"}
            </span>
          </div>
          {engineStatus.running ? (
            <button
              onClick={handleStopEngine}
              disabled={engineLoading}
              className="btn-danger flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <PowerOff className="w-4 h-4" />
              {engineLoading ? "Stopping..." : "Stop Engine"}
            </button>
          ) : (
            <button
              onClick={handleStartEngine}
              disabled={engineLoading}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Power className="w-4 h-4" />
              {engineLoading ? "Starting..." : "Start Engine"}
            </button>
          )}
        </div>
      </div>

      {/* Device Scanner */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Device Scanner</h2>
          {scanning ? (
            <button onClick={handleStopScan} className="btn-danger flex items-center gap-2 text-sm">
              <StopCircle className="w-4 h-4" /> Stop Scanning
            </button>
          ) : (
            <button
              onClick={handleStartScan}
              disabled={!engineStatus.running || !engineStatus.clientConnected}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Search className="w-4 h-4" /> Scan for Devices
            </button>
          )}
        </div>
        {!engineStatus.running && (
          <p className="text-slate-400 text-sm">Start the engine above to scan for devices.</p>
        )}
        {engineStatus.running && !scanning && discovered.length === 0 && (
          <p className="text-slate-400 text-sm">No devices found. Start a scan to discover devices.</p>
        )}
        {scanning && (
          <div className="flex items-center gap-2 text-sm text-purple-300">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
            Scanning for devices...
          </div>
        )}
      </div>

      {/* Pillar 2: Discovered Devices */}
      {discovered.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-3">Discovered Devices</h2>

          {/* Pending devices */}
          {pendingDevices.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-yellow-300 mb-2">Pending Approval</h3>
              <div className="space-y-2">
                {pendingDevices.map((device) => (
                  <DeviceRow
                    key={device.id}
                    device={device}
                    onApprove={handleApprove}
                    onDeny={handleDeny}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Approved devices */}
          {approvedDevices.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-green-300 mb-2">Approved</h3>
              <div className="space-y-2">
                {approvedDevices.map((device) => (
                  <DeviceRow
                    key={device.id}
                    device={device}
                    onDeny={handleDeny}
                    onReset={handleReset}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Denied devices (collapsible) */}
          {deniedDevices.length > 0 && (
            <div>
              <button
                onClick={() => setShowDenied(!showDenied)}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 mb-2"
              >
                {showDenied ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Show denied devices ({deniedDevices.length})
              </button>
              {showDenied && (
                <div className="space-y-2">
                  {deniedDevices.map((device) => (
                    <DeviceRow key={device.id} device={device} onReset={handleReset} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pillar 3: Protocol Allowlist */}
      <div className="card mb-6">
        <button
          onClick={() => {
            if (!showProtocols) loadProtocols();
            setShowProtocols(!showProtocols);
          }}
          className="flex items-center justify-between w-full"
        >
          <h2 className="text-lg font-semibold">Allowed Protocols</h2>
          {showProtocols ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
        </button>

        {showProtocols && (
          <div className="mt-3">
            <p className="text-sm text-slate-400 mb-3">
              Only devices matching enabled protocols will appear during scanning.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {protocolList.map((proto) => (
                <label
                  key={proto.protocolName}
                  className="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-600"
                >
                  <input
                    type="checkbox"
                    checked={proto.enabled}
                    onChange={(e) => handleToggleProtocol(proto.protocolName, e.target.checked)}
                    className="w-4 h-4 rounded accent-purple-500"
                  />
                  <span className="text-sm">{proto.displayName}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* About */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-2">About</h2>
        <p className="text-sm text-slate-400">
          PlayRooms {version ? `v${version}` : ""} — A Home Assistant add-on for Buttplug.io device management with shareable Play Rooms.
        </p>
      </div>
    </div>
  );
}

// --- Device Row Component ---

function DeviceRow({
  device,
  onApprove,
  onDeny,
  onReset,
}: {
  device: DiscoveredDevice;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
  onReset?: (id: string) => void;
}) {
  const statusIcon = {
    approved: <CheckCircle className="w-4 h-4 text-green-400" />,
    denied: <XCircle className="w-4 h-4 text-red-400" />,
    pending: <Clock className="w-4 h-4 text-yellow-400" />,
  }[device.status];

  return (
    <div className="flex items-center justify-between bg-slate-700 rounded-lg px-4 py-3">
      <div className="flex items-center gap-3 flex-1">
        {statusIcon}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{device.name}</span>
            {device.connected && (
              <span className="text-xs bg-green-600/30 text-green-300 px-1.5 py-0.5 rounded">Connected</span>
            )}
          </div>
          <div className="flex gap-2 mt-1">
            {device.capabilities.vibrate && (
              <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded">Vibrate</span>
            )}
            {device.capabilities.rotate && (
              <span className="text-xs bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded">Rotate</span>
            )}
            {device.capabilities.linear && (
              <span className="text-xs bg-green-600/30 text-green-300 px-2 py-0.5 rounded">Linear</span>
            )}
            {device.capabilities.battery && (
              <span className="text-xs bg-amber-600/30 text-amber-300 px-2 py-0.5 rounded">Battery</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-3">
        {device.status === "pending" && onApprove && (
          <button
            onClick={() => onApprove(device.approvalId)}
            className="btn-primary text-xs px-3 py-1"
          >
            Approve
          </button>
        )}
        {device.status === "pending" && onDeny && (
          <button
            onClick={() => onDeny(device.approvalId)}
            className="btn-danger text-xs px-3 py-1"
          >
            Deny
          </button>
        )}
        {device.status === "approved" && onDeny && (
          <button
            onClick={() => onDeny(device.approvalId)}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
          >
            Revoke
          </button>
        )}
        {device.status === "denied" && onReset && (
          <button
            onClick={() => onReset(device.approvalId)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>
    </div>
  );
}
