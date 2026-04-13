import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Actor, PhaseTransition } from "@/types/actors";

interface ActorsState {
  actors: readonly Actor[];
  phases: Record<string, PhaseTransition[]>;
  loading: boolean;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  transitionPhase: (
    actorId: string,
    toPhase: string,
    reason?: string,
  ) => Promise<void>;
  listPhases: (actorId: string) => Promise<void>;
}

export const useActorsStore = create<ActorsState>((set) => ({
  actors: [],
  phases: {},
  loading: false,
  connected: false,
  channel: null,

  async loadViaRest() {
    set({ loading: true });
    try {
      const data = await api.get<{ actors: Actor[] }>("/actors");
      set({ actors: data.actors, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async connect() {
    const { channel, response } = await joinChannel("actors:lobby");
    const data = response as { actors: Actor[] };
    set({ channel, connected: true, actors: data.actors });

    channel.on("actor_created", (actor: Actor) => {
      set((state) => ({ actors: [actor, ...state.actors] }));
    });

    channel.on("actor_updated", (updated: Actor) => {
      set((state) => ({
        actors: state.actors.map((a) => (a.id === updated.id ? updated : a)),
      }));
    });

    channel.on("actor_deleted", (payload: { id: string }) => {
      set((state) => ({
        actors: state.actors.filter((a) => a.id !== payload.id),
      }));
    });

    channel.on(
      "phase_transitioned",
      (payload: { actor: Actor; transition: PhaseTransition }) => {
        set((state) => ({
          actors: state.actors.map((a) =>
            a.id === payload.actor.id ? payload.actor : a,
          ),
          phases: {
            ...state.phases,
            [payload.actor.id]: [
              payload.transition,
              ...(state.phases[payload.actor.id] ?? []),
            ],
          },
        }));
      },
    );
  },

  async transitionPhase(actorId, toPhase, reason) {
    await api.post(`/actors/${actorId}/transition`, {
      to_phase: toPhase,
      reason,
    });
  },

  async listPhases(actorId) {
    const data = await api.get<{ transitions: PhaseTransition[] }>(
      `/actors/${actorId}/phases`,
    );
    set((state) => ({
      phases: { ...state.phases, [actorId]: data.transitions },
    }));
  },
}));
