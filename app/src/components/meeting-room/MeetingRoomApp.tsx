import { useEffect, useState } from "react";
import { useMeetingStore } from "@/stores/meeting-store";
import type { Meeting } from "@/stores/meeting-store";

const card = {
  background: "rgba(14,16,23,0.55)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
} as const;

const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "var(--pn-text-primary)",
  width: "100%",
  outline: "none",
  fontSize: 13,
} as const;

const btnPrimary = {
  background: "#2DD4A8",
  color: "#000",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
} as const;

const STATUS_COLORS: Record<Meeting["status"], string> = {
  scheduled: "#6B95F0",
  in_progress: "#F59E0B",
  completed: "#2DD4A8",
  cancelled: "#f87171",
};

export function MeetingRoomApp() {
  const { meetings, loading, error, loadViaRest, createMeeting, deleteMeeting } =
    useMeetingStore();

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formStartsAt, setFormStartsAt] = useState("");
  const [formEndsAt, setFormEndsAt] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    loadViaRest();
  }, [loadViaRest]);

  const now = new Date();
  const sevenDaysFromNow = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  );

  const upcoming = [...meetings]
    .filter((m) => {
      const d = new Date(m.starts_at);
      return (
        m.status === "scheduled" && d >= now && d <= sevenDaysFromNow
      );
    })
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );

  const past = [...meetings]
    .filter(
      (m) =>
        m.status === "completed" ||
        m.status === "cancelled" ||
        new Date(m.starts_at) < now,
    )
    .sort(
      (a, b) =>
        new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
    );

  const handleCreate = async () => {
    if (!formTitle.trim() || !formStartsAt) return;
    try {
      const startsAtIso = new Date(formStartsAt).toISOString();
      await createMeeting({
        title: formTitle.trim(),
        scheduled_at: startsAtIso,
        starts_at: startsAtIso,
        ends_at: formEndsAt
          ? new Date(formEndsAt).toISOString()
          : undefined,
        location: formLocation.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
      setFormTitle("");
      setFormStartsAt("");
      setFormEndsAt("");
      setFormLocation("");
      setFormNotes("");
      setShowForm(false);
    } catch (err) {
      console.warn("Failed to create meeting:", err);
    }
  };

  const renderMeeting = (meeting: Meeting) => (
    <div key={meeting.id} style={{ ...card, marginBottom: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span
              style={{
                color: "var(--pn-text-primary)",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {meeting.title}
            </span>
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: `${STATUS_COLORS[meeting.status]}20`,
                color: STATUS_COLORS[meeting.status],
              }}
            >
              {meeting.status}
            </span>
          </div>
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            {new Date(meeting.starts_at).toLocaleString()}
            {meeting.location ? ` \u00B7 ${meeting.location}` : ""}
          </div>
        </div>
        <button
          onClick={() => deleteMeeting(meeting.id)}
          style={{
            background: "none",
            border: "none",
            color: "#f87171",
            cursor: "pointer",
            fontSize: 11,
          }}
        >
          Delete
        </button>
      </div>
      {meeting.attendees.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 11,
            }}
          >
            {meeting.attendees.length} attendee
            {meeting.attendees.length !== 1 ? "s" : ""}
          </span>
          {meeting.attendees.map((attendee) => (
            <span
              key={attendee}
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 600,
                background: "rgba(107,149,240,0.1)",
                color: "#6B95F0",
              }}
            >
              {attendee}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  if (loading && meetings.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "var(--pn-text-secondary)", fontSize: 13 }}>
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            color: "var(--pn-text-primary)",
            fontSize: 16,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Meeting Room
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: showForm
              ? "rgba(239,68,68,0.12)"
              : "rgba(107,149,240,0.12)",
            color: showForm ? "#ef4444" : "#6B95F0",
          }}
        >
          {showForm ? "Cancel" : "+ New Meeting"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            color: "#ef4444",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {showForm && (
        <div style={card}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Meeting title *"
              style={inputStyle}
            />
            <input
              value={formStartsAt}
              onChange={(e) => setFormStartsAt(e.target.value)}
              type="datetime-local"
              style={inputStyle}
            />
            <input
              value={formEndsAt}
              onChange={(e) => setFormEndsAt(e.target.value)}
              type="datetime-local"
              placeholder="End time"
              style={inputStyle}
            />
            <input
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder="Location"
              style={inputStyle}
            />
          </div>
          <textarea
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Notes"
            rows={2}
            style={{ ...inputStyle, marginBottom: 10, resize: "vertical" }}
          />
          <button onClick={handleCreate} style={btnPrimary}>
            Schedule Meeting
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {meetings.length === 0 && (
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 13,
              textAlign: "center",
              marginTop: 32,
            }}
          >
            No meetings yet
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <div
              style={{
                color: "var(--pn-text-secondary)",
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 8,
              }}
            >
              Upcoming (next 7 days)
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {upcoming.map(renderMeeting)}
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <div
              style={{
                color: "var(--pn-text-secondary)",
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 8,
              }}
            >
              Past
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {past.map(renderMeeting)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
