import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Search, StopCircle } from "lucide-react";
import { devices as devicesApi, health, type DeviceState } from "../lib/api";

export default function Settings() {
  const [deviceList, setDeviceList] = useState<DeviceState[]>([]);
  const [scanning, setScanning] = useState(false);
  const [buttplugConnected, setButtplugConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [deviceData, healthData] = await Promise.all([devicesApi.list(), health()]);
      setDeviceList(deviceData);
      setButtplugConnected(healthData.buttplug);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartScan() {
    try {
      await devicesApi.startScan();
      setScanning(true);
      // Refresh device list periodically while scanning
      const interval = setInterval(async () => {
        const data = await devicesApi.list();
        setDeviceList(data);
      }, 2000);
      setTimeout(() => {
        clearInterval(interval);
        setScanning(false);
      }, 30000);
    } catch (err) {
      console.error("Scan failed:", err);
    }
  }

  async function handleStopScan() {
    try {
      await devicesApi.stopScan();
      setScanning(false);
    } catch (err) {
      console.error("Stop scan failed:", err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center gap-3 mb-8">
        <Link to="/" className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

      {/* Connection Status */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-3">Buttplug.io Connection</h2>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${buttplugConnected ? "bg-green-400" : "bg-red-400"}`} />
          <span>{buttplugConnected ? "Connected to Intiface Engine" : "Not connected"}</span>
          <button onClick={loadData} className="btn-secondary p-2 ml-auto" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Device Scanner */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Devices</h2>
          {scanning ? (
            <button onClick={handleStopScan} className="btn-danger flex items-center gap-2 text-sm">
              <StopCircle className="w-4 h-4" /> Stop Scanning
            </button>
          ) : (
            <button
              onClick={handleStartScan}
              disabled={!buttplugConnected}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Search className="w-4 h-4" /> Scan for Devices
            </button>
          )}
        </div>

        {deviceList.length === 0 ? (
          <p className="text-slate-400 text-sm">No devices found. Start a scan to discover devices.</p>
        ) : (
          <div className="space-y-2">
            {deviceList.map((device) => (
              <div key={device.id} className="flex items-center justify-between bg-slate-700 rounded-lg px-4 py-3">
                <div>
                  <span className="font-medium">{device.name}</span>
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
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {device.batteryLevel !== null && (
                    <span className="text-sm text-slate-400">{Math.round(device.batteryLevel * 100)}%</span>
                  )}
                  <div className={`w-2.5 h-2.5 rounded-full ${device.connected ? "bg-green-400" : "bg-red-400"}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* About */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-2">About</h2>
        <p className="text-sm text-slate-400">
          PlayRooms v1.0.0 — A Home Assistant add-on for Buttplug.io device management with shareable Play Rooms.
        </p>
      </div>
    </div>
  );
}
