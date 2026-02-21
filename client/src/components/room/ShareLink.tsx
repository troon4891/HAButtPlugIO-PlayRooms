import { useState } from "react";
import { Link2, Copy, Check, Trash2 } from "lucide-react";
import { share, type ShareLink as ShareLinkType } from "../../lib/api";

interface ShareLinkProps {
  roomId: string;
  links: ShareLinkType[];
  onLinksChange: (links: ShareLinkType[]) => void;
}

export default function ShareLink({ roomId, links, onLinksChange }: ShareLinkProps) {
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCreate() {
    const link = await share.create(roomId);
    onLinksChange([...links, link]);
  }

  async function handleRevoke(token: string) {
    await share.revoke(token);
    onLinksChange(links.filter((l) => l.token !== token));
  }

  async function handleCopy(token: string) {
    const url = `${window.location.origin}/join/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary-400" /> Share Links
        </h3>
        <button onClick={handleCreate} className="btn-primary text-sm">
          Generate Link
        </button>
      </div>

      {links.length === 0 ? (
        <p className="text-slate-400 text-sm">No share links. Generate one to invite guests.</p>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
              <code className="flex-1 text-xs truncate text-slate-300">
                {window.location.origin}/join/{link.token}
              </code>
              <button onClick={() => handleCopy(link.token)} className="text-primary-400 hover:text-primary-300 p-1">
                {copied === link.token ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <button onClick={() => handleRevoke(link.token)} className="text-red-400 hover:text-red-300 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
