import { Router, Request, Response } from "express";
import * as roomService from "./room.service.js";

export const roomRouter = Router();

roomRouter.get("/", (_req: Request, res: Response) => {
  const rooms = roomService.listRooms();
  res.json(rooms.map((r) => ({ ...r, widgets: JSON.parse(r.widgets) })));
});

roomRouter.get("/:id", (req: Request, res: Response) => {
  const room = roomService.getRoom(req.params.id);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json({ ...room, widgets: JSON.parse(room.widgets) });
});

roomRouter.post("/", (req: Request, res: Response) => {
  const { name, accessMode, challengeType, maxGuests, widgets } = req.body;

  if (!name || !accessMode) {
    res.status(400).json({ error: "name and accessMode are required" });
    return;
  }

  const room = roomService.createRoom({
    name,
    accessMode,
    challengeType,
    maxGuests: maxGuests ?? 4,
    widgets: widgets ?? [],
  });

  res.status(201).json({ ...room, widgets: JSON.parse(room.widgets) });
});

roomRouter.put("/:id", (req: Request, res: Response) => {
  const room = roomService.updateRoom(req.params.id, req.body);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json({ ...room, widgets: JSON.parse(room.widgets) });
});

roomRouter.delete("/:id", (req: Request, res: Response) => {
  const deleted = roomService.deleteRoom(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.status(204).send();
});
