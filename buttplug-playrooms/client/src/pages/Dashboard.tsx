import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Trash2, ExternalLink, Settings, Wifi, WifiOff } from "lucide-react";
import { rooms, health, type Room } from "../lib/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [buttplugConnected, setButtplugConnected] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAccessMode, setNewAccessMode] = useState<"open" | "challenge">("open");
  const [newMaxGuests, setNewMaxGuests] = useState(4);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [roomData, healthData] = await Promise.all([rooms.list(), health()]);
      setRoomList(roomData);
      setButtplugConnected(healthData.buttplug);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const room = await rooms.create({
        name: newName.trim(),
        accessMode: newAccessMode,
        maxGuests: newMaxGuests,
        widgets: [
          { type: "toybox", enabled: true, settings: {} },
          { type: "textchat", enabled: true, settings: {} },
        ],
      });
      setRoomList((prev) => [...prev, room]);
      setShowCreate(false);
      setNewName("");
      navigate(`/room/${room.id}`);
    } catch (err) {
      console.error("Failed to create room:", err);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this room? This cannot be undone.")) return;
    try {
      await rooms.delete(id);
      setRoomList((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to delete room:", err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">PlayRooms</h1>
          <div className="flex items-center gap-2 mt-1 text-sm">
            {buttplugConnected ? (
              <span className="flex items-center gap-1 text-green-400">
                <Wifi className="w-4 h-4" /> Buttplug.io Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-yellow-400">
                <WifiOff className="w-4 h-4" /> Buttplug.io Disconnected
              </span>
            )}
          </div>
        </div>
        <Link to="/settings" className="btn-secondary flex items-center gap-2">
          <Settings className="w-4 h-4" /> Settings
        </Link>
      </header>

      <div className="mb-6">
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Room
        </button>
      </div>

      {showCreate && (
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Create Play Room</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Room Name</label>
              <input
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Play Room"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Access Mode</label>
              <select
                className="input"
                value={newAccessMode}
                onChange={(e) => setNewAccessMode(e.target.value as "open" | "challenge")}
              >
                <option value="open">Open (anyone with link can join)</option>
                <option value="challenge">Challenge (code or approval required)</option>
              </select>
            </div>
            <div>
              <label className="label">Max Guests (1-4)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={4}
                value={newMaxGuests}
                onChange={(e) => setNewMaxGuests(Number(e.target.value))}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} className="btn-primary">Create</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {roomList.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">
          <p className="text-lg">No Play Rooms yet</p>
          <p className="text-sm mt-1">Create your first room to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {roomList.map((room) => (
            <div key={room.id} className="card flex items-center justify-between">
              <div>
                <Link to={`/room/${room.id}`} className="text-lg font-semibold hover:text-primary-400 transition-colors">
                  {room.name}
                </Link>
                <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                  <span className="capitalize">{room.accessMode} access</span>
                  <span>Max {room.maxGuests} guests</span>
                  <span>{room.widgets.filter((w) => w.enabled).length} widgets</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/room/${room.id}`} className="btn-secondary p-2" title="Open Room">
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button onClick={() => handleDelete(room.id)} className="btn-danger p-2" title="Delete Room">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
