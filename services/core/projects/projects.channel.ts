import { registerChannelHandler } from '../../realtime/server.js';
import { getProject, listProjects } from './projects.service.js';

export function registerProjectsChannel(): void {
  registerChannelHandler('projects:*', (topic, event, _payload, reply) => {
    switch (event) {
      case 'phx_join':
        if (topic === 'projects:lobby') {
          reply({ projects: listProjects() });
          return;
        }

        reply({ project: getProject(topic.split(':')[1] ?? '') });
        return;

      default:
        reply({ error: 'unknown_event' });
    }
  });
}
