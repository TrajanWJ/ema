import { registerChannelHandler } from '../../realtime/server.js';
import {
  addTaskComment,
  createTask,
  getTask,
  listTasks,
  transitionTask,
} from './tasks.service.js';
import { broadcast } from '../../realtime/server.js';

function taskListForTopic(topic: string) {
  if (topic === 'tasks:lobby') {
    return listTasks();
  }

  const [, projectId] = topic.split(':');
  return projectId ? listTasks({ projectId }) : [];
}

export function registerTasksChannel(): void {
  registerChannelHandler('tasks:*', (topic, event, payload, reply) => {
    switch (event) {
      case 'phx_join':
        reply({ tasks: taskListForTopic(topic) });
        return;

      case 'create': {
        const data = (payload ?? {}) as Record<string, unknown>;
        if (typeof data.title !== 'string' || data.title.trim().length === 0) {
          reply({ error: 'title_required' });
          return;
        }

        const task = createTask({
          title: data.title,
          description: typeof data.description === 'string' ? data.description : null,
          status: typeof data.status === 'string' ? data.status : undefined,
          priority:
            typeof data.priority === 'string' || typeof data.priority === 'number'
              ? data.priority
              : undefined,
          project_id: typeof data.project_id === 'string' ? data.project_id : null,
        });

        broadcast('tasks:lobby', 'task_created', task);
        if (task.project_id) {
          broadcast(`tasks:${task.project_id}`, 'task_created', task);
          broadcast(`projects:${task.project_id}`, 'task_created', task);
        }

        reply({ task });
        return;
      }

      case 'transition': {
        const data = (payload ?? {}) as Record<string, unknown>;
        if (typeof data.id !== 'string' || typeof data.status !== 'string') {
          reply({ error: 'invalid_transition' });
          return;
        }

        const task = transitionTask(data.id, data.status);
        if (!task) {
          reply({ error: 'task_not_found' });
          return;
        }

        broadcast('tasks:lobby', 'task_updated', task);
        if (task.project_id) {
          broadcast(`tasks:${task.project_id}`, 'task_updated', task);
          broadcast(`projects:${task.project_id}`, 'task_updated', task);
        }

        reply({ task });
        return;
      }

      case 'comment': {
        const data = (payload ?? {}) as Record<string, unknown>;
        if (typeof data.id !== 'string' || typeof data.body !== 'string') {
          reply({ error: 'invalid_comment' });
          return;
        }

        const task = getTask(data.id);
        if (!task) {
          reply({ error: 'task_not_found' });
          return;
        }

        const comment = addTaskComment(data.id, data.body);
        const updatedTask = getTask(data.id) ?? task;
        broadcast('tasks:lobby', 'task_updated', updatedTask);
        if (updatedTask.project_id) {
          broadcast(`tasks:${updatedTask.project_id}`, 'task_updated', updatedTask);
          broadcast(`projects:${updatedTask.project_id}`, 'task_updated', updatedTask);
        }

        reply({ comment });
        return;
      }

      default:
        reply({ error: 'unknown_event' });
    }
  });
}
