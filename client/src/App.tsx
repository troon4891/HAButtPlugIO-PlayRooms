import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import RoomHost from "./pages/RoomHost";
import RoomGuest from "./pages/RoomGuest";
import Lobby from "./pages/Lobby";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/room/:id" element={<RoomHost />} />
        <Route path="/join/:token" element={<Lobby />} />
        <Route path="/room/:id/guest" element={<RoomGuest />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}
