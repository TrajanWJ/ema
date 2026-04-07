import { create } from "zustand";
import { joinChannel } from "../api/socket";
import type { Channel } from "phoenix";
import type { Actor, PhaseTransition } from "../api/hq";
import * as hq from "../api/hq";

export type { Actor, PhaseTransition };

interface ActorStore {
  actors: Actor[];
  phases: Record<string, PhaseTransition[]>;
  loading: boolean;
  connected: boolean;
  channel: Channel | null;

  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  createActor: (data: Partial<Actor>) => Promise<Actor>;
  transitionPhase: (actorId: string, toPhase: string, reason?: string) => Promise<void>;
  listPhases: (actorId: string) => Promise<void>;
}

export const useActorStore = create<ActorStore>((set, get) => ({
  actors: [],
  phases: {},
  loading: false,
  connected: false,
  channel: null,

  async loadViaRest() {
    set({ loading: true });
    try {
      const data = await hq.getActors();
      set({ actors: data.actors, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async connect() {
    try {
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
              a.id === payload.actor.id ? payload.actor : a
            ),
            phases: {
              ...state.phases,
              [payload.actor.id]: [
                payload.transition,
                ...(state.phases[payload.actor.id] ?? []),
              ],
            },
          }));
        }
      );
    } catch {
      await get().loadViaRest();
    }
  },

  async createActor(data) {
    const result = await hq.createActor(data);
    set((state) => ({ actors: [result.actor, ...state.actors] }));
    return result.actor;
  },

  async transitionPhase(actorId, toPhase, reason) {
    await hq.transitionActorPhase(actorId, toPhase, reason);
  },

  async listPhases(actorId) {
    const data = await hq.getActorPhases(actorId);
    set((state) => ({
      phases: { ...state.phases, [actorId]: data.transitions },
    }));
  },
}));
