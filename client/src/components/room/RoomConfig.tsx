import { useState } from "react";
import { Save } from "lucide-react";
import { rooms, type Room, type WidgetConfig } from "../../lib/api";

const WIDGET_TYPES = [
  { type: "toybox" as const, label: "Toy Box", description: "Buttplug.io device controls" },
  { type: "textchat" as const, label: "Text Chat", description: "Real-time text messaging" },
  { type: "webcam" as const, label: "Web Cam", description: "Host webcam stream" },
  { type: "videochat" as const, label: "Video Chat", description: "Multi-participant video" },
  { type: "voicechat" as const, label: "Voice Chat", description: "Push-to-talk or open mic" },
];

interface RoomConfigProps {
  room: Room;
  onSave: (room: Room) => void;
}

export default function RoomConfig({ room, onSave }: RoomConfigProps) {
  const [name, setName] = useState(room.name);
  const [accessMode, setAccessMode] = useState(room.accessMode);
  const [challengeType, setChallengeType] = useState(room.challengeType ?? "code");
  const [maxGuests, setMaxGuests] = useState(room.maxGuests);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(room.widgets);
  const [saving, setSaving] = useState(false);

  function toggleWidget(type: WidgetConfig["type"]) {
    setWidgets((prev) => {
      const existing = prev.find((w) => w.type === type);
      if (existing) {
        return prev.map((w) => (w.type === type ? { ...w, enabled: !w.enabled } : w));
      }
      return [...prev, { type, enabled: true, settings: {} }];
    });
  }

  function isWidgetEnabled(type: WidgetConfig["type"]): boolean {
    return widgets.find((w) => w.type === type)?.enabled ?? false;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await rooms.update(room.id, {
        name,
        accessMode,
        challengeType: accessMode === "challenge" ? challengeType : undefined,
        maxGuests,
        widgets,
      });
      onSave(updated);
    } catch (err) {
      console.error("Failed to save room:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Room Settings</h3>

      <div className="space-y-4">
        <div>
          <label className="label">Room Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="label">Access Mode</label>
          <select className="input" value={accessMode} onChange={(e) => setAccessMode(e.target.value as "open" | "challenge")}>
            <option value="open">Open</option>
            <option value="challenge">Challenge</option>
          </select>
        </div>

        {accessMode === "challenge" && (
          <div>
            <label className="label">Challenge Type</label>
            <select className="input" value={challengeType} onChange={(e) => setChallengeType(e.target.value as "code" | "approval")}>
              <option value="code">Access Code</option>
              <option value="approval">Host Approval</option>
            </select>
          </div>
        )}

        <div>
          <label className="label">Max Guests (1-4)</label>
          <input className="input" type="number" min={1} max={4} value={maxGuests} onChange={(e) => setMaxGuests(Number(e.target.value))} />
        </div>

        <div>
          <label className="label">Widgets</label>
          <div className="space-y-2">
            {WIDGET_TYPES.map((wt) => (
              <label key={wt.type} className="flex items-center gap-3 bg-slate-700/50 rounded-lg p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isWidgetEnabled(wt.type)}
                  onChange={() => toggleWidget(wt.type)}
                  className="rounded accent-primary-500"
                />
                <div>
                  <span className="font-medium text-sm">{wt.label}</span>
                  <p className="text-xs text-slate-400">{wt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
