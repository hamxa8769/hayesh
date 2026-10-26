const ROOM_NAME_PATTERN = /^hayesh-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

/** `hayesh-<uuid>` -> meeting id, or null when the name is not in that form. */
export function meetingIdFromRoomName(roomName: string): string | null {
  const match = ROOM_NAME_PATTERN.exec(roomName)
  return match ? match[1].toLowerCase() : null
}

/** The LiveKit room name for a meeting row. */
export function roomNameForMeeting(meeting: { id: string; room_url: string | null }): string {
  return meeting.room_url || `hayesh-${meeting.id}`
}
