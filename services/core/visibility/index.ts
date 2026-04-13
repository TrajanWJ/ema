/**
 * VisibilityHub public API.
 *
 * Callers that want to report activity should import `visibilityHub` (the
 * process-wide singleton) and call `startTopic` / `updateTopic` / `endTopic`.
 * Infrastructure code wires the HTTP routes (`registerRoutes`) and the
 * realtime channel (`attachVisibilityChannel`).
 */

export { VisibilityHub, visibilityHub } from './hub.js';
export { registerRoutes } from './routes.js';
export {
  attachVisibilityChannel,
  detachVisibilityChannel,
  VISIBILITY_TOPIC,
  VISIBILITY_EVENT,
} from './ws.js';
export type {
  ActiveTopic,
  FinalTopicState,
  TopicFilter,
  TopicKind,
  TopicState,
  Unsubscribe,
  VisibilityEvent,
  VisibilityEventHandler,
} from './types.js';
